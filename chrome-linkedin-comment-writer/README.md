# Comment Copilot for LinkedIn

A Chrome extension (Manifest V3) that reads the LinkedIn post you're looking
at, lets you pick a tone, and drafts a comment directly into LinkedIn's own
comment box — using your own Claude API key. **It never posts anything for
you** — you always review the draft and click LinkedIn's own Comment button
yourself.

## Why draft-only, not auto-post

LinkedIn's User Agreement restricts automated interaction with the platform
(auto-posting, auto-commenting, scraping at scale). This tool stays firmly
on the safe side of that line: it reads the post you're already viewing (no
scraping beyond the current page) and writes text into the comment box for
a human to review and submit — the same category of assistive tool as a
grammar checker or an autocomplete, not a bot. It's built to be used by one
person on their own account, not run unattended across many accounts.

## Features

- **In-context toolbar**: a small tone-picker + "Draft comment" button
  appears above every comment box you click into on LinkedIn — no popup,
  no context switch.
- **Tone presets**: Supportive, Insightful, Curious, Contrarian,
  Congratulatory, Witty, or a free-text Custom instruction.
- **Persona**: an optional bio in Settings so drafts sound like a specific
  person, not a generic AI comment.
- **Bring your own Claude API key** — stored only in `chrome.storage.local`
  on your machine, sent only to `api.anthropic.com`, never to any
  third-party server. Model is configurable (Haiku 4.5 / Sonnet 5 / Opus 5).
- **No em dashes.** Drafts are prompted to never use "—"/"–", with a
  post-processing pass that strips any that slip through, since they're
  one of the most common AI writing tells.
- **Niche highlighting.** Set a few topic keywords in Settings and matching
  posts get a small "In your niche" badge as they show up in your own
  feed, so you're not scrolling past the ones worth commenting on. This
  only looks at posts already rendered on the page as you browse normally,
  it never searches, scrapes, or fetches anything on its own.
- **Never auto-submits, never auto-likes.** The draft lands in the comment
  box; you edit and click LinkedIn's own Comment button. This extension
  intentionally does not do fully unattended engagement (scheduled or
  background auto-liking/auto-commenting on "trending" posts) — LinkedIn's
  User Agreement prohibits automated engagement, and accounts running that
  kind of automation get rate-limited, restricted, or banned. The niche
  badge gets you to the right posts faster; a human still reads the post
  and clicks the button.

## Installing (unpacked, for development)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `chrome-linkedin-comment-writer`
   folder.
4. Click the extension icon → **Open Settings** → paste a Claude API key
   from [console.anthropic.com](https://console.anthropic.com/settings/keys)
   → Save.
5. Open LinkedIn, click into any post's comment box, pick a tone, and click
   **✨ Draft comment**.

## How it works

- `content.js` is declaratively injected on `linkedin.com` (no per-page
  activation needed). A `MutationObserver` watches for comment editors
  (`div[contenteditable="true"][role="textbox"]` inside anything with
  "comment" in its class name or aria-label — LinkedIn's exact class names
  churn often, so this is intentionally a loose, resilient heuristic
  rather than hardcoded selectors) and injects a toolbar above each one.
- On "Draft comment", it walks up to the enclosing post container and
  extracts the post's visible text and author name directly from the page
  (excluding the comment box itself and any existing comments), then sends
  that plus your chosen tone to the background service worker.
- `background.js` calls the Anthropic Messages API
  (`POST https://api.anthropic.com/v1/messages`) directly from the
  extension using your stored API key, with
  `anthropic-dangerous-direct-browser-access: true` (Anthropic's documented
  header for calling the API straight from a browser). Raw `fetch` is used
  instead of the Anthropic SDK because this is a build-step-free extension
  (an MV3 service worker can't easily load an npm-bundled SDK without
  adding a bundler) — same architecture as ColorSnap and Font X-Ray.
- The draft is inserted into the comment box with
  `document.execCommand('insertText', …)` after selecting the box's
  existing content, which fires the real input events LinkedIn's editor
  listens for (a plain `textContent` assignment would not reliably work
  with its editor).

## Project structure

```
manifest.json      Extension manifest (MV3)
shared-tones.js      Tone presets, shared by background.js and content.js
background.js         Service worker: calls the Claude API with the stored key
content.js             Injected on linkedin.com: toolbar, post extraction, draft insertion
content.css             Toolbar styling
options.html/.css/.js   Settings: API key, model, persona
popup.html/.css/.js     Toolbar-icon popup: setup status + link to Settings
icons/                Generated PNG icons (16/32/48/128)
```

## Permissions used

| Permission | Why |
|---|---|
| `storage` | Persist your API key, model choice, persona, niche keywords, and last-used tone locally. |
| `host_permissions: api.anthropic.com` | Call the Claude API directly from the extension. |
| Content script on `linkedin.com` | Inject the in-page toolbar, badge matching posts, and read the post you're viewing. |

## Limitations & privacy notes

- Requires your own Anthropic API key and a small amount of API spend per
  draft (a short comment is a few hundred tokens either way).
- LinkedIn's DOM structure changes over time; if the toolbar stops
  appearing on some post layouts, the selector heuristics in `content.js`
  may need updating.
- Post text is sent to Anthropic's API as part of the request (that's how
  the draft gets written) — nothing else about you or your account is
  read, sent, or stored anywhere but your own browser and Anthropic's API.
  A post's own text could in principle contain adversarial instructions
  aimed at the model ("prompt injection"); since the only thing that can
  happen is a low-quality draft appearing for your review before you post
  it, the impact is bounded — but always read a draft before sending it.
