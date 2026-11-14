// Browser recording engine: screen + webcam bubble + mic/system audio -> MediaRecorder.

export type RecordMode = "screen-cam" | "screen" | "cam";
export type CamPosition = "bottom-left" | "bottom-right" | "top-left" | "top-right";
export type CamSize = "s" | "m" | "l";

export type RecorderOptions = {
  mode: RecordMode;
  mic: boolean;
  camPosition: CamPosition;
  camSize: CamSize;
  /** An already-open webcam stream. The caller keeps ownership of it. */
  camStream?: MediaStream | null;
  /** Called when the user ends capture from the browser's own "Stop sharing" UI. */
  onCaptureEnded?: () => void;
};

export type RecordingResult = {
  blob: Blob;
  duration: number;
  mimeType: string;
  thumbnail?: string;
};

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function recordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function screenCaptureSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

/** setInterval that keeps firing when the tab is in the background (Workers aren't throttled). */
function backgroundSafeInterval(fn: () => void, ms: number): () => void {
  try {
    const url = URL.createObjectURL(
      new Blob([`setInterval(()=>postMessage(0),${ms})`], { type: "text/javascript" }),
    );
    const worker = new Worker(url);
    worker.onmessage = fn;
    return () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
  }
}

function makeVideo(stream: MediaStream): HTMLVideoElement {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.srcObject = stream;
  void v.play().catch(() => {});
  return v;
}

const CAM_SIZE: Record<CamSize, number> = { s: 0.2, m: 0.28, l: 0.38 };

export class ClipRecorder {
  private opts: RecorderOptions;
  private screen: MediaStream | null = null;
  private mic: MediaStream | null = null;
  private cam: MediaStream | null = null;
  private ownsCam = false;
  private audioCtx: AudioContext | null = null;
  private stopTicker: (() => void) | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType = "";
  private canvas: HTMLCanvasElement | null = null;
  private frameSource: HTMLVideoElement | CanvasImageSource | null = null;
  private thumbnail: string | undefined;
  private thumbTimer: number | undefined;

  private startedAt = 0;
  private accumulated = 0;
  private paused = false;
  private active = false;

  private constructor(opts: RecorderOptions) {
    this.opts = opts;
  }

  /** Must be called from a user gesture (click) so the browser lets us open the screen picker. */
  static async create(opts: RecorderOptions): Promise<ClipRecorder> {
    const r = new ClipRecorder(opts);
    try {
      await r.acquire();
    } catch (e) {
      r.release();
      throw e;
    }
    return r;
  }

  private async acquire() {
    const { mode, mic } = this.opts;
    const wantsScreen = mode !== "cam";
    const wantsCam = mode !== "screen";

    if (wantsScreen) {
      this.screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: true, // system / tab audio, when the browser offers it
      });
      this.screen.getVideoTracks()[0]?.addEventListener("ended", () => this.opts.onCaptureEnded?.());
    }

    if (wantsCam) {
      if (this.opts.camStream && this.opts.camStream.getVideoTracks().some((t) => t.readyState === "live")) {
        this.cam = this.opts.camStream;
      } else {
        this.cam = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        });
        this.ownsCam = true;
      }
      if (!wantsScreen) {
        this.cam.getVideoTracks()[0]?.addEventListener("ended", () => this.opts.onCaptureEnded?.());
      }
    }

    if (mic) {
      try {
        this.mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        this.mic = null; // continue without a microphone rather than failing the whole recording
      }
    }
  }

  /** The stream the user is recording, for in-page preview. */
  private buildOutputStream(): MediaStream {
    const out = new MediaStream();

    // ---- video ----
    if (this.opts.mode === "screen") {
      const track = this.screen!.getVideoTracks()[0];
      out.addTrack(track);
      this.frameSource = makeVideo(new MediaStream([track]));
    } else if (this.opts.mode === "cam") {
      const track = this.cam!.getVideoTracks()[0];
      out.addTrack(track.clone());
      this.frameSource = makeVideo(new MediaStream([track]));
    } else {
      const screenTrack = this.screen!.getVideoTracks()[0];
      const screenVideo = makeVideo(new MediaStream([screenTrack]));
      const camVideo = makeVideo(new MediaStream([this.cam!.getVideoTracks()[0]]));
      const s = screenTrack.getSettings();
      const scale = Math.min(1, 1920 / (s.width || 1920));
      const W = Math.round((s.width || 1280) * scale);
      const H = Math.round((s.height || 720) * scale);
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d", { alpha: false })!;
      const d = Math.round(H * CAM_SIZE[this.opts.camSize]);
      const margin = Math.round(H * 0.03);
      const x = this.opts.camPosition.endsWith("left") ? margin : W - d - margin;
      const y = this.opts.camPosition.startsWith("top") ? margin : H - d - margin;

      const draw = () => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        if (screenVideo.videoWidth) ctx.drawImage(screenVideo, 0, 0, W, H);
        if (camVideo.videoWidth) {
          const vw = camVideo.videoWidth;
          const vh = camVideo.videoHeight;
          const side = Math.min(vw, vh);
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.45)";
          ctx.shadowBlur = d * 0.08;
          ctx.beginPath();
          ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fillStyle = "#fff";
          ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.beginPath();
          ctx.arc(x + d / 2, y + d / 2, d / 2 - Math.max(3, d * 0.025), 0, Math.PI * 2);
          ctx.clip();
          // Mirror like a selfie view, cropped to a centered square.
          ctx.translate(x + d, y);
          ctx.scale(-1, 1);
          ctx.drawImage(camVideo, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, d, d);
          ctx.restore();
        }
      };
      draw();
      this.stopTicker = backgroundSafeInterval(draw, 1000 / 30);
      this.canvas = canvas;
      this.frameSource = canvas;
      const track = canvas.captureStream(30).getVideoTracks()[0];
      out.addTrack(track);
    }

    // ---- audio ----
    const sources: MediaStream[] = [];
    if (this.mic && this.mic.getAudioTracks().length) sources.push(this.mic);
    if (this.screen && this.screen.getAudioTracks().length) sources.push(this.screen);
    if (sources.length) {
      const ctx = new AudioContext();
      this.audioCtx = ctx;
      const dest = ctx.createMediaStreamDestination();
      for (const s of sources) {
        const node = ctx.createMediaStreamSource(new MediaStream(s.getAudioTracks()));
        node.connect(dest);
      }
      out.addTrack(dest.stream.getAudioTracks()[0]);
    }
    return out;
  }

  get hasMic(): boolean {
    return !!this.mic;
  }

  get hasSystemAudio(): boolean {
    return !!this.screen && this.screen.getAudioTracks().length > 0;
  }

  /** Begin recording now. */
  start() {
    const stream = this.buildOutputStream();
    this.mimeType = pickMimeType();
    this.recorder = new MediaRecorder(stream, {
      ...(this.mimeType ? { mimeType: this.mimeType } : {}),
      videoBitsPerSecond: 4_000_000,
      audioBitsPerSecond: 128_000,
    });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.recorder.start(1000);
    this.startedAt = performance.now();
    this.accumulated = 0;
    this.paused = false;
    this.active = true;
    // Grab a thumbnail shortly after the start, once frames are flowing.
    this.thumbTimer = window.setTimeout(() => (this.thumbnail = this.grabFrame()), 1200);
  }

  get elapsed(): number {
    if (!this.active) return this.accumulated / 1000;
    return (this.accumulated + (this.paused ? 0 : performance.now() - this.startedAt)) / 1000;
  }

  get isPaused() {
    return this.paused;
  }

  pause() {
    if (!this.active || this.paused || this.recorder?.state !== "recording") return;
    this.recorder.pause();
    this.accumulated += performance.now() - this.startedAt;
    this.paused = true;
  }

  resume() {
    if (!this.active || !this.paused) return;
    this.recorder?.resume();
    this.startedAt = performance.now();
    this.paused = false;
  }

  private grabFrame(): string | undefined {
    const src = this.frameSource;
    if (!src) return undefined;
    try {
      const vw = src instanceof HTMLVideoElement ? src.videoWidth : (src as HTMLCanvasElement).width;
      const vh = src instanceof HTMLVideoElement ? src.videoHeight : (src as HTMLCanvasElement).height;
      if (!vw || !vh) return undefined;
      const w = 480;
      const h = Math.round((w * vh) / vw);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(src, 0, 0, w, h);
      return c.toDataURL("image/jpeg", 0.72);
    } catch {
      return undefined;
    }
  }

  stop(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      const rec = this.recorder;
      if (!rec || rec.state === "inactive") {
        this.release();
        reject(new Error("Not recording"));
        return;
      }
      const duration = this.elapsed;
      const thumb = this.thumbnail ?? this.grabFrame();
      rec.onstop = () => {
        const mime = this.mimeType || rec.mimeType || "video/webm";
        const blob = new Blob(this.chunks, { type: mime.split(";")[0] });
        this.active = false;
        this.release();
        resolve({ blob, duration, mimeType: mime.split(";")[0], thumbnail: thumb });
      };
      rec.onerror = () => {
        this.release();
        reject(new Error("Recording failed"));
      };
      rec.stop();
    });
  }

  /** Throw the recording away. */
  cancel() {
    this.active = false;
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.release();
  }

  private release() {
    window.clearTimeout(this.thumbTimer);
    this.stopTicker?.();
    this.stopTicker = null;
    this.screen?.getTracks().forEach((t) => t.stop());
    this.mic?.getTracks().forEach((t) => t.stop());
    if (this.ownsCam) this.cam?.getTracks().forEach((t) => t.stop());
    void this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.screen = this.mic = null;
    this.recorder = null;
    this.canvas = null;
    this.frameSource = null;
  }
}
