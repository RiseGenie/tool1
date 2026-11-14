// Runtime capability detection. Nothing is assumed from the user-agent string: we probe real APIs and report what is
// available BEFORE capture, with honest notes about things the browser only reveals after the user picks a source.

export type Capability = { id: string; label: string; ok: boolean; note?: string };
export type Capabilities = {
  canRecordScreen: boolean;
  canRecordCamera: boolean;
  canPersistLocally: boolean;
  mimeType: string;
  items: Capability[];
};

const MIMES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"];

export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function detectCapabilities(): Capabilities {
  const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  const supported = (md?.getSupportedConstraints?.() ?? {}) as Record<string, boolean>;
  const mime = pickMimeType();
  const secure = typeof window !== "undefined" && window.isSecureContext;
  const hasMR = typeof MediaRecorder !== "undefined" && !!mime;
  const screen = !!md?.getDisplayMedia && hasMR && secure;
  const cam = !!md?.getUserMedia && hasMR && secure;
  const idb = typeof indexedDB !== "undefined";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));

  const items: Capability[] = [
    { id: "secure", label: "Secure connection (HTTPS)", ok: secure, note: secure ? undefined : "Browsers only allow capture on HTTPS or localhost." },
    {
      id: "screen",
      label: "Screen, window and tab capture",
      ok: screen,
      note: screen ? (mobile ? "Mobile browsers rarely support this; recording is designed for desktop." : undefined) : "Not available here. Use a current desktop Chrome, Edge, Firefox or Safari.",
    },
    { id: "camera", label: "Camera and microphone", ok: cam, note: cam ? undefined : "Camera/microphone capture is not available in this context." },
    { id: "format", label: "Recording format", ok: hasMR, note: hasMR ? mime.split(";")[0] : "MediaRecorder is not available." },
    {
      id: "system-audio",
      label: "Tab / system audio",
      ok: screen && (supported.systemAudio === true || /Chrome|Edg/.test(ua)),
      note: "Depends on your browser, OS and what you share. Chrome/Edge: tick “Share tab audio” (tabs) or “Share system audio” (Windows, entire screen). Firefox and Safari do not capture it.",
    },
    {
      id: "recovery",
      label: "Crash recovery (local storage)",
      ok: idb,
      note: idb ? "Saved in this browser while recording. Clearing site data, private windows or low disk space can remove it." : "Local recovery is unavailable; recordings stay in memory until uploaded.",
    },
  ];
  return { canRecordScreen: screen, canRecordCamera: cam, canPersistLocally: idb, mimeType: mime, items };
}
