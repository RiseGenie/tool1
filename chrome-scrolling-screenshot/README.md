# Full Page Scrolling Screenshot

A Chrome extension (Manifest V3) that captures an entire scrollable web
page as one long screenshot — not just what's visible in the viewport —
then lets you preview, copy, or download it as a PNG.

## Features

- **Full-page capture**: scrolls the page section by section, captures
  each section, and stitches them into a single image at full device
  resolution.
- **Fixed/sticky headers handled**: elements with `position: fixed` or
  `position: sticky` (nav bars, cookie banners, "back to top" buttons)
  are hidden during capture so they don't repeat in every section, then
  restored afterward.
- **Visible-area-only mode**: a quick single-viewport screenshot when you
  don't need the whole page.
- **Result page**: opens in a new tab with a scrollable preview, a
  **Download PNG** button, and a **Copy to clipboard** button.
- **Keyboard shortcut** (`Ctrl+Shift+S` / `Cmd+Shift+S`, configurable at
  `chrome://extensions/shortcuts`) for full-page capture without opening
  the popup.

## Installing (unpacked, for development)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `chrome-scrolling-screenshot`
   folder.
4. Open any page, click the extension icon, and choose **Capture full
   page** or **Capture visible area only**.

## How it works

- `background.js` orchestrates the capture: it injects a small set of
  self-contained functions into the page via `chrome.scripting.executeScript`
  to measure the page, hide fixed/sticky elements, and scroll to each
  section in turn. Between each scroll it calls
  `chrome.tabs.captureVisibleTab` (with a short delay and retry/backoff on
  Chrome's rate limit) to grab that section as a PNG data URL.
- Once every section is captured, the original scroll position and any
  hidden elements are restored on the page, and the slices are handed off
  to a new tab (`stitch.html`) via **IndexedDB** (`idb-store.js`) — not
  `chrome.storage`, since a tall page's full-resolution PNG slices can
  easily exceed `chrome.storage.session`'s ~10MB quota, while IndexedDB
  has effectively no such ceiling.
- `stitch.js` loads every slice as an `Image`, draws each one onto a
  single `<canvas>` at its real scroll offset (later slices simply
  overwrite the overlapping region of earlier ones, which is harmless
  since it's the same static content), and exports the result as a PNG
  blob for preview, download, and clipboard copy.
- Very long or effectively infinite-scroll pages are capped (roughly
  32,000px of captured height, ~80 sections) to stay within canvas size
  limits and avoid the capture running forever; if a page is cut off, the
  result page shows a note saying so.

## Project structure

```
manifest.json     Extension manifest (MV3)
background.js       Service worker: scroll/capture orchestration
idb-store.js         Shared IndexedDB helper (background.js + stitch.js)
popup.html/.css/.js  Toolbar popup: trigger full-page or visible-area capture
stitch.html/.css/.js Result page: stitches slices, preview, download, copy
icons/              Generated PNG icons (16/32/48/128)
```

## Permissions used

| Permission | Why |
|---|---|
| `activeTab` | Capture and script only the tab the user invoked the extension on. |
| `scripting` | Inject the measure/scroll/hide-fixed-elements/restore functions into the page. |

No `host_permissions`, no network requests anywhere in the code — the
whole capture-and-stitch pipeline runs locally in the browser.

## Known limitations

- Pages that lazily load content only as it scrolls into view may not
  render fully in time for each section's capture; a future improvement
  could add a longer settle delay or detect in-flight image loads.
- Extremely tall or infinite-scroll pages are capped rather than captured
  in full (see above).
- A handful of pages use unusual scroll containers (an inner `<div>` that
  scrolls instead of the page itself) that this extension doesn't detect
  — it scrolls `window`, which covers the vast majority of sites.
