# Browser capability matrix

**Only what was actually observed is marked ✅/❌.** Everything else is marked *not tested* — do not read those cells as support claims.
The recorder also detects capabilities at runtime and shows the result before capture (“What this browser can do”).

## Observed (automated, `scripts/e2e.sh`)

Environment: headless Chromium 153 (Playwright build) on Linux, fake camera/microphone devices, real tab capture of a second tab,
phone emulation = Chromium with the Pixel 7 profile (touch, 412×915, mobile UA). **This is emulation, not a physical phone.**

| Capability | Chromium 153 (desktop, headless) | Chromium, Pixel 7 emulation |
|---|---|---|
| Record a *different tab* (`getDisplayMedia`) | ✅ (auto-selected by title) | n/a |
| Camera + microphone (fake devices) | ✅ | n/a |
| Camera bubble composited into saved video | ✅ (pixel sampled in the processed MP4) | n/a |
| Mic + captured-audio mix → single AAC track | ◐ output has one AAC audio track (asserted); the audio *content* was not analysed, and the tab-audio path was not asserted | n/a |
| Pause / resume (timer stops while paused) | ✅ | n/a |
| “Stop sharing” → recording saved | ✅ simulated by dispatching the track’s `ended` event | n/a |
| All capture tracks released after stop | ✅ | n/a |
| MediaRecorder → local IndexedDB recovery across reload | ✅ | n/a |
| Resumable upload after interruption | ✅ | n/a |
| MP4 (H.264/AAC) playback, seeking, captions track | ✅ | ✅ |
| Transcript click-to-seek, comments, keyboard control | ✅ | ✅ (keyboard via emulated device) |
| axe-core WCAG 2.0/2.1 A/AA scan | ✅ 0 serious/critical (recorder setup state, video page, guest page) | ✅ guest page |

## Not tested (no browser/device available in the authoring environment)

| Browser | Expected, per documented platform behaviour — *unverified* |
|---|---|
| Chrome / Edge desktop (headed, real picker) | Tab audio via “Share tab audio”; system audio only on Windows + entire screen. Real **Stop sharing** button not exercised. |
| Firefox desktop | `getDisplayMedia` available; no tab/system audio capture; MediaRecorder WebM. |
| Safari macOS | `getDisplayMedia` available; MediaRecorder produces MP4 (handled by the worker); no tab audio. |
| iOS Safari / Android Chrome (real devices) | Recording is not a supported mobile workflow. **Playback** is designed for it (inline, `playsinline`, H.264/AAC MP4) but untested on hardware. |
| Document Picture-in-Picture floating controls | Not built in Phase 1. |

## Known browser limits (by design of the platform)
* The browser — not this app — draws the picker and the “Stop sharing” bar; the app can only react to it.
* Camera and microphone indicators are controlled by the OS/browser.
* Tab/system audio availability depends on browser, OS and which surface the user picks. The app says so in the UI when none was shared.
* Background tabs: compositing is driven by a Web Worker timer so the camera bubble keeps rendering while the user presents another tab. Observed working in Chromium.

## Phase 2 additions (observed, Chromium only)
| Capability | Chromium 153 desktop | Chromium, Pixel 7 emulation |
|---|---|---|
| Client review page: request changes / approve, history | ✅ | ✅ |
| Guest request page: file upload (MP4), content rejection, camera reply (fake device) | — | ✅ |
| Privacy panel, SOP editor, bug report form (axe: 0 serious/critical) | ✅ | — |
| Guest screen recording from the request page (picker) | ◐ code shared with the main recorder; not separately exercised | not tested |
