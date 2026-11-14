// Browser recording engine: screen/tab/window + camera overlay + microphone + captured audio -> MediaRecorder slices.
import { pickMimeType } from "./capabilities";

export type RecordMode = "screen-cam" | "screen" | "cam";
export type Overlay = {
  visible: boolean;
  /** Center of the bubble, as a fraction (0..1) of the video frame. */
  x: number;
  y: number;
  /** Diameter as a fraction of the frame height. */
  size: number;
};
export const OVERLAY_CORNERS = {
  "top-left": { x: 0.09, y: 0.14 },
  "top-right": { x: 0.91, y: 0.14 },
  "bottom-left": { x: 0.09, y: 0.86 },
  "bottom-right": { x: 0.91, y: 0.86 },
} as const;

export type Notice = { level: "info" | "warn" | "error"; code: string; message: string };

export type EngineOptions = {
  mode: RecordMode;
  micDeviceId: string | null; // null = no microphone
  camDeviceId: string | null;
  captureAudio: boolean; // ask the browser for tab/system audio
  overlay: Overlay;
  height: 720 | 1080;
  /** Streams already open for preview; the engine adopts them. The caller must not stop them afterwards. */
  micStream?: MediaStream | null;
  camStream?: MediaStream | null;
  onSlice: (blob: Blob, seq: number) => void;
  onCaptureEnded: () => void;
  onNotice: (n: Notice) => void;
  onLevel?: (level: number) => void;
};

function backgroundInterval(fn: () => void, ms: number): () => void {
  try {
    const url = URL.createObjectURL(new Blob([`setInterval(()=>postMessage(0),${ms})`], { type: "text/javascript" }));
    const w = new Worker(url);
    w.onmessage = fn;
    return () => {
      w.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
  }
}

function video(stream: MediaStream): HTMLVideoElement {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.srcObject = stream;
  void v.play().catch(() => {});
  return v;
}

const live = (s?: MediaStream | null) => !!s && s.getTracks().some((t) => t.readyState === "live");

export class RecorderEngine {
  private screen: MediaStream | null = null;
  private mic: MediaStream | null = null;
  private cam: MediaStream | null = null;
  private ownsMic = false;
  private ownsCam = false;
  private out: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private micGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private stopDraw: (() => void) | null = null;
  private stopMeter: number | null = null;
  private rec: MediaRecorder | null = null;
  private seq = 0;
  private frame: HTMLCanvasElement | HTMLVideoElement | null = null;
  private overlay: Overlay;
  private micMuted = false;
  private startedAt = 0;
  private accumulated = 0;
  private state: "idle" | "recording" | "paused" | "stopped" = "idle";
  private ending = false;
  mimeType = "";
  surface: string | null = null; // "browser" | "window" | "monitor" as reported by the browser
  hasSystemAudio = false;
  hasMic = false;
  previewCanvas: HTMLCanvasElement | null = null;

  private constructor(private o: EngineOptions) {
    this.overlay = { ...o.overlay };
  }

  /** Must run inside a click handler: the browser requires a user gesture to open its screen picker. */
  static async create(o: EngineOptions): Promise<RecorderEngine> {
    const e = new RecorderEngine(o);
    try {
      await e.acquire();
      e.prepare();
    } catch (err) {
      e.release();
      throw err;
    }
    return e;
  }

  private async acquire() {
    const { mode } = this.o;
    if (mode !== "cam") {
      const md = navigator.mediaDevices;
      const sup = md.getSupportedConstraints() as Record<string, boolean>;
      const opts: Record<string, unknown> = {
        video: { frameRate: { ideal: 30, max: 30 }, width: { max: 1920 }, height: { max: 1080 } },
        audio: this.o.captureAudio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : false,
      };
      if (sup.systemAudio && this.o.captureAudio) opts.systemAudio = "include";
      if (sup.selfBrowserSurface) opts.selfBrowserSurface = "exclude"; // don't offer this tab (recording ourselves is a mirror-in-mirror)
      this.screen = await md.getDisplayMedia(opts as DisplayMediaStreamOptions);
      const vt = this.screen.getVideoTracks()[0];
      this.surface = (vt.getSettings() as { displaySurface?: string }).displaySurface ?? null;
      vt.addEventListener("ended", () => this.endedByBrowser());
      this.hasSystemAudio = this.screen.getAudioTracks().length > 0;
    }
    if (mode !== "screen") {
      if (live(this.o.camStream)) this.cam = this.o.camStream!;
      else {
        this.cam = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: this.o.camDeviceId ? { exact: this.o.camDeviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        this.ownsCam = true;
      }
      this.cam.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (mode === "cam") this.endedByBrowser();
        else {
          this.overlay.visible = false;
          this.o.onNotice({ level: "warn", code: "camera-lost", message: "Camera disconnected — recording continues without it." });
        }
      });
    }
    if (this.o.micDeviceId !== null) {
      try {
        if (live(this.o.micStream)) this.mic = this.o.micStream!;
        else {
          this.mic = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: this.o.micDeviceId ? { exact: this.o.micDeviceId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
          this.ownsMic = true;
        }
        this.hasMic = true;
        this.mic.getAudioTracks()[0]?.addEventListener("ended", () => {
          this.hasMic = false;
          this.o.onNotice({ level: "warn", code: "mic-lost", message: "Microphone disconnected — recording continues without your voice." });
        });
      } catch {
        this.o.onNotice({ level: "warn", code: "mic-unavailable", message: "Couldn’t access the microphone — recording without your voice." });
      }
    }
  }

  private prepare() {
    const out = new MediaStream();
    const { mode, height } = this.o;
    const maxH = height;
    if (mode === "screen") {
      const t = this.screen!.getVideoTracks()[0];
      out.addTrack(t);
      this.frame = video(new MediaStream([t]));
    } else if (mode === "cam") {
      const t = this.cam!.getVideoTracks()[0];
      out.addTrack(t.clone());
      this.frame = video(new MediaStream([t]));
    } else {
      const st = this.screen!.getVideoTracks()[0];
      const sv = video(new MediaStream([st]));
      const cv = video(new MediaStream([this.cam!.getVideoTracks()[0]]));
      const s = st.getSettings();
      const sw = s.width || 1280;
      const sh = s.height || 720;
      const scale = Math.min(1, maxH / sh);
      const W = Math.round((sw * scale) / 2) * 2;
      const H = Math.round((sh * scale) / 2) * 2;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d", { alpha: false })!;
      const draw = () => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        if (sv.videoWidth) ctx.drawImage(sv, 0, 0, W, H);
        const ov = this.overlay;
        if (ov.visible && cv.videoWidth) {
          const d = Math.round(H * ov.size);
          const x = Math.round(Math.min(Math.max(ov.x * W - d / 2, 0), W - d));
          const y = Math.round(Math.min(Math.max(ov.y * H - d / 2, 0), H - d));
          const vw = cv.videoWidth;
          const vh = cv.videoHeight;
          const side = Math.min(vw, vh);
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,.45)";
          ctx.shadowBlur = d * 0.08;
          ctx.beginPath();
          ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
          ctx.fillStyle = "#fff";
          ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.beginPath();
          ctx.arc(x + d / 2, y + d / 2, d / 2 - Math.max(3, d * 0.025), 0, Math.PI * 2);
          ctx.clip();
          ctx.translate(x + d, y);
          ctx.scale(-1, 1); // mirrored selfie view
          ctx.drawImage(cv, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, d, d);
          ctx.restore();
        }
      };
      draw();
      // A Worker ticks even when this tab is in the background (the user is usually presenting a different tab).
      this.stopDraw = backgroundInterval(draw, 1000 / 30);
      this.frame = canvas;
      this.previewCanvas = canvas;
      out.addTrack(canvas.captureStream(30).getVideoTracks()[0]);
    }

    // Audio: mic + captured tab/system audio mixed into one track.
    const hasScreenAudio = !!this.screen && this.screen.getAudioTracks().length > 0;
    if (this.hasMic || hasScreenAudio) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const dest = ctx.createMediaStreamDestination();
      if (this.hasMic && this.mic) {
        const src = ctx.createMediaStreamSource(new MediaStream(this.mic.getAudioTracks()));
        const gain = ctx.createGain();
        gain.gain.value = this.micMuted ? 0 : 1;
        this.micGain = gain;
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 512;
        src.connect(this.analyser);
        src.connect(gain).connect(dest);
      }
      if (hasScreenAudio) ctx.createMediaStreamSource(new MediaStream(this.screen!.getAudioTracks())).connect(ctx.createGain()).connect(dest);
      out.addTrack(dest.stream.getAudioTracks()[0]);
      if (this.analyser && this.o.onLevel) {
        const buf = new Uint8Array(this.analyser.fftSize);
        this.stopMeter = window.setInterval(() => {
          this.analyser!.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
          this.o.onLevel!(Math.min(1, peak * 1.6));
        }, 60);
      }
    }
    this.out = out;
    this.mimeType = pickMimeType();
  }

  private endedByBrowser() {
    if (this.ending) return;
    this.ending = true;
    this.o.onCaptureEnded();
  }

  // ----- recording lifecycle -----
  start() {
    const rec = new MediaRecorder(this.out!, {
      ...(this.mimeType ? { mimeType: this.mimeType } : {}),
      videoBitsPerSecond: this.o.height === 1080 ? 5_000_000 : 3_000_000,
      audioBitsPerSecond: 128_000,
    });
    this.seq = 0;
    rec.ondataavailable = (e) => {
      if (e.data.size) this.o.onSlice(e.data, this.seq++);
    };
    rec.start(1000);
    this.rec = rec;
    this.startedAt = performance.now();
    this.accumulated = 0;
    this.state = "recording";
  }

  get elapsedMs(): number {
    if (this.state === "idle") return 0;
    return this.accumulated + (this.state === "recording" ? performance.now() - this.startedAt : 0);
  }
  get status() {
    return this.state;
  }

  pause() {
    if (this.state !== "recording") return;
    this.rec!.pause();
    this.accumulated += performance.now() - this.startedAt;
    this.state = "paused";
  }
  resume() {
    if (this.state !== "paused") return;
    this.rec!.resume();
    this.startedAt = performance.now();
    this.state = "recording";
  }

  /** Discard the current take and begin a fresh one on the same capture (no new permission prompt). */
  restart() {
    const old = this.rec;
    if (old && old.state !== "inactive") {
      old.ondataavailable = null;
      old.onstop = null;
      old.stop();
    }
    this.start();
  }

  stop(): Promise<{ durationMs: number }> {
    return new Promise((resolve) => {
      const rec = this.rec;
      const durationMs = Math.round(this.elapsedMs);
      this.state = "stopped";
      if (!rec || rec.state === "inactive") {
        resolve({ durationMs });
        return;
      }
      rec.onstop = () => resolve({ durationMs }); // fires after the final dataavailable
      rec.stop();
    });
  }

  // ----- live controls -----
  setOverlay(patch: Partial<Overlay>) {
    this.overlay = { ...this.overlay, ...patch };
  }
  getOverlay() {
    return this.overlay;
  }
  setMicMuted(m: boolean) {
    this.micMuted = m;
    if (this.micGain) this.micGain.gain.value = m ? 0 : 1;
  }

  /** Stop every capture track and timer. Always safe to call more than once. */
  release() {
    this.stopDraw?.();
    this.stopDraw = null;
    if (this.stopMeter !== null) window.clearInterval(this.stopMeter);
    this.stopMeter = null;
    try {
      if (this.rec && this.rec.state !== "inactive") this.rec.stop();
    } catch {}
    this.screen?.getTracks().forEach((t) => t.stop());
    this.out?.getTracks().forEach((t) => t.stop());
    if (this.ownsMic) this.mic?.getTracks().forEach((t) => t.stop());
    if (this.ownsCam) this.cam?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.screen = null;
    this.rec = null;
    this.frame = null;
    this.state = "stopped";
  }

  /** For tests: report which capture tracks are still live. */
  liveTrackCount(): number {
    return [this.screen, this.out, this.ownsMic ? this.mic : null, this.ownsCam ? this.cam : null]
      .flatMap((s) => (s ? s.getTracks() : []))
      .filter((t) => t.readyState === "live").length;
  }
}
