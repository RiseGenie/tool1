# Font X-Ray — Type System Inspector

A Chrome extension (Manifest V3) that lets you hover any text on a page to
see its exact typography — font family, size, weight, line-height, and
letter-spacing — the way devtools shows it, but without opening devtools.
It also scans an entire page and compiles a de-duplicated "type system"
report of every text style in use, exportable as CSS custom properties or
JSON. A companion tool to ColorSnap.

## Features

- **Hover to inspect**: an on-page overlay highlights the element under
  your cursor and shows a live tooltip with `font-family`, `font-size`,
  `font-weight`, `line-height` (as a unitless ratio), `letter-spacing`,
  `text-transform`, and computed text `color`. Click any element to pin it
  into a running side panel — no devtools tab needed.
- **Scan whole page**: walks every visible text node on the page, groups
  them by identical typographic signature, and returns a sorted report
  (most-used style first) with a sample of the text and a rough selector
  for reference.
- **Export**: copy the report as `:root` CSS custom properties (ready to
  drop into a design-tokens file) or raw JSON.
- **Keyboard shortcut** (`Ctrl+Shift+F` / `Cmd+Shift+F`, configurable at
  `chrome://extensions/shortcuts`) toggles the hover inspector directly,
  without opening the popup.

## Installing (unpacked, for development)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `chrome-font-xray` folder.
4. Pin the extension and click its icon (or use the shortcut) to start
   inspecting.

## How it works

- The popup sends a message to the background service worker, which
  injects `content.js` into the active tab.
- `fontXrayScanPage()` walks the DOM with a `TreeWalker`, reads
  `getComputedStyle` for each text-bearing element, and de-duplicates by a
  signature of font family/size/weight/style/line-height/letter-spacing/
  text-transform/color.
- `fontXrayStartInspector()` builds a small in-page overlay (highlight box
  + tooltip + a docked panel) that keeps running independently of the
  popup — since the popup closes as soon as focus moves to the page, all
  pinning state lives in the page and syncs to `chrome.storage.local` so
  the popup picks it up next time it's opened.
- User-supplied page text and font names are inserted via `textContent`/
  `style.setProperty` rather than `innerHTML`, so a page's own content
  can't inject markup into the extension's UI.

## Project structure

```
manifest.json     Extension manifest (MV3)
background.js     Service worker: orchestrates scanning/inspecting, message routing
content.js        Injected into the page: DOM walker + hover inspector overlay
popup.html/.css/.js   Popup UI: report list, CSS/JSON export
icons/            Generated PNG icons (16/32/48/128)
```

## Permissions used

| Permission | Why |
|---|---|
| `activeTab` | Inspect/scan only the tab the user is interacting with. |
| `scripting` | Inject `content.js` to read computed styles in the page. |
| `storage` | Persist the last scan report and pinned styles. |
| `clipboardWrite` | Copy the report as CSS or JSON. |

## Notes

- Scanning is capped to visible, non-empty text nodes outside
  `script`/`style`/`noscript`/`template`/`svg`.
- Like ColorSnap, this can't run on `chrome://` pages or the Chrome Web
  Store — script injection is blocked there by the browser itself.
- Everything runs locally; no data leaves the browser.
