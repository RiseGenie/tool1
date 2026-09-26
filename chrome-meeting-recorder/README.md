# Meeting Recorder & Notes

A Chrome extension (Manifest V3) that records a meeting's screen, live-transcribes it, generates an AI summary and highlighted to-dos, and emails the whole thing to you automatically.

## Features

- **One-click-ish recording**: click the extension icon, then **Start Recording** to pick a screen, window, or tab to share (Chrome requires that second click as a security gesture — the picker can't be skipped).
- **Live transcript**: uses Chrome's built-in speech recognition while recording, so you can see the transcript build in real time.
- **AI summary & to-dos**: on stop, the transcript is sent to Claude (your own Anthropic API key) to produce structured meeting notes, a short summary, and highlighted, bullet-point action items.
- **Auto-email**: notes, summary, to-dos, and the full transcript are emailed via [Resend](https://resend.com) (your own API key) from `info@risegenie.com` to `risegenie@gmail.com` by default — both addresses are editable in Settings.
- **Local recording download**: the screen recording itself (`.webm`) is not attached to the email (recordings are usually far too large for email) — it's offered as a one-click local download instead.
- Recording and download work even without API keys configured; AI notes and email are skipped (with a clear notice) until you add them.

## Installing (unpacked, for development)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `chrome-meeting-recorder` folder.
4. Click the extension icon once to open Settings (gear icon in the recorder window) and add:
   - Your **Anthropic API key** ([console.anthropic.com](https://console.anthropic.com/settings/keys)).
   - Your **Resend API key** ([resend.com](https://resend.com)), with `risegenie.com` verified as a sending domain in your Resend account — Resend will reject the send otherwise.
   - From/To addresses (pre-filled with `info@risegenie.com` → `risegenie@gmail.com`).

## Using it

1. Click the extension icon. This opens a small floating recorder window (not the usual popup, since screen-share prompts close ordinary toolbar popups).
2. Click **Start Recording** and pick the screen, window, or tab you want captured.
3. The window shows a live timer and live transcript while you meet. It stays floating over your other windows — leave it be during the call.
4. Click **Stop & Generate Notes** (or use Chrome's native "Stop sharing" bar, which triggers the same flow) when the meeting ends.
5. The extension generates notes/summary/to-dos, emails them, and shows the results inline, with buttons to download the recording and retry the email if it failed.

## How it works

- `background.js` opens `recorder.html` in a dedicated `chrome.windows.create` popup window (not the toolbar's `default_popup`, which Chrome closes when a native screen-share picker takes focus).
- `recorder.js` calls `navigator.mediaDevices.getDisplayMedia()` for the screen/window/tab capture and pipes it into a `MediaRecorder` to build the `.webm` file, entirely in memory for the length of the meeting.
- In parallel, the Web Speech API (`SpeechRecognition`, continuous mode with auto-restart on Chrome's periodic silence timeouts) builds a live transcript from your microphone.
- On stop, the transcript is sent directly from the browser to Anthropic's Messages API (`claude-sonnet-5`, using your own key with `anthropic-dangerous-direct-browser-access`) asking for structured JSON: meeting notes, a summary, and to-dos.
- The results are emailed via a direct browser call to Resend's API (your own key, declared in `host_permissions` so the extension can call it without needing the target server's CORS headers).
- Nothing touches a backend server anywhere — all API calls happen directly from the extension using credentials you provide and that stay in `chrome.storage.local`.

## Project structure

```
manifest.json      Extension manifest (MV3)
background.js       Service worker: opens/focuses the recorder window
recorder.html/.css/.js   The recording UI, capture, transcription, AI notes, email
options.html/.css/.js    Settings: API keys and from/to email addresses
icons/              Generated PNG icons (16/32/48/128)
```

## Permissions used

| Permission | Why |
|---|---|
| `storage` | Store API keys and email settings locally. |
| `host_permissions: api.anthropic.com` | Call Claude directly from the browser for the AI summary/to-dos. |
| `host_permissions: api.resend.com` | Send the notes email directly from the browser. |

No content scripts, no `activeTab`/`scripting` — the recorder page itself handles screen capture and transcription; it never touches the meeting page's DOM.

## Known limitations

- **Not a literal single click.** Chrome's screen-share picker requires a fresh user gesture inside the document requesting it, so a second click ("Start Recording" inside the floating window) is unavoidable after clicking the toolbar icon.
- **Transcription quality depends on your mic, not the shared screen's audio.** The Web Speech API listens to your microphone, not the captured display stream — so it transcribes your side of the conversation reliably, but other participants' audio (routed through your speakers/headphones or the meeting app) is picked up only as much as your mic happens to catch it. For accurate multi-participant transcripts, a server-side transcription service (e.g. Whisper) processing the actual recorded audio would be needed instead.
- **Requires an internet connection** for both Chrome's speech recognition service and the Anthropic/Resend API calls.
- **Email sending requires your own verified Resend domain.** Resend will reject sends from an unverified `from` address; this extension doesn't verify domains for you.
- **Large recordings.** Very long meetings produce large in-memory `.webm` blobs before download; extremely long recordings (multiple hours) may strain browser memory.
