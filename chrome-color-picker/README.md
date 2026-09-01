# ColorSnap — Chrome Color Picker

A Chrome extension (Manifest V3) that lets you pick any color from any web
page — or anywhere on your screen, using the browser's native `EyeDropper`
API — and copy it as HEX, RGB, or HSL.

## Features

- **Pick from anywhere on screen** via the native `EyeDropper` API (Chrome
  95+). This isn't limited to the current tab: you can sample a pixel from
  another window, an image, a video, or the desktop.
- **Magnifier fallback** for browsers/contexts where `EyeDropper` isn't
  available: a zoomed loupe overlay lets you click any pixel of the current
  tab to sample it.
- **HEX / RGB / HSL** values shown side by side, each with a one-click copy
  button.
- **Color history** (last 24 picks) stored locally via `chrome.storage`, so
  you can revisit or re-copy a previous color.
- **Keyboard shortcut** (`Ctrl+Shift+U` / `Cmd+Shift+U` on Mac, configurable
  at `chrome://extensions/shortcuts`) to pick a color without opening the
  popup — the result is copied to the clipboard automatically and confirmed
  with a system notification.

## Installing (unpacked, for development)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `chrome-color-picker` folder.
4. Pin the extension and click its icon, or use the keyboard shortcut, to
   start picking colors.

## How it works

- The popup's "Pick a color" button sends a message to the background
  service worker, which injects `content.js` into the active tab.
- `content.js` opens the native `EyeDropper` when supported. If it's not
  available, it falls back to a full-viewport canvas overlay built from a
  screenshot of the visible tab (`chrome.tabs.captureVisibleTab`), with a
  magnifying loupe that follows the cursor.
- The picked color is saved to `chrome.storage.local` (history + last pick)
  and copied to the clipboard.

## Project structure

```
manifest.json     Extension manifest (MV3)
background.js     Service worker: orchestrates picking, history, clipboard, notifications
content.js        Injected into the page: EyeDropper + magnifier fallback
popup.html/.css/.js   Popup UI: swatch, HEX/RGB/HSL fields, history grid
icons/            Generated PNG icons (16/32/48/128)
```

## Permissions used

| Permission | Why |
|---|---|
| `activeTab` | Capture a screenshot and inject the picker only on the tab the user is interacting with. |
| `scripting` | Inject `content.js` to run the picker in the page. |
| `storage` | Persist color history and the last picked color. |
| `clipboardWrite` | Copy the picked color to the clipboard. |
| `notifications` | Confirm a pick made via the keyboard shortcut. |

## Notes

- `EyeDropper` is not supported on `chrome://` pages or the Chrome Web
  Store; the extension can't inject scripts there either, so picking is
  limited to regular `http(s)`/`file` pages.
- No data ever leaves the browser — everything runs locally.
