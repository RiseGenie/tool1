# Browsing Heatmap Mirror

A Chrome extension (Manifest V3) that builds a private, local-only
GitHub-contribution-graph-style picture of how much time you spend on each
website. Unlike RescueTime, Toggl, or similar tools, there's no account, no
server, and no data ever leaves your browser — everything lives in
`chrome.storage.local`.

## Features

- **Passive tracking**: counts time on the active tab's domain whenever
  Chrome is focused and you're not idle (idle detection via the `idle`
  API), with no setup beyond installing the extension.
- **Contribution-style heatmap**: a GitHub-style calendar grid (`dashboard.html`)
  colored by how much time you spent each day, with month labels, hover
  tooltips, and a "Last 90 days / This year / All time" range switch.
- **Per-day domain breakdown**: click any day in the grid to see exactly
  which sites made up that day, with a bar chart and durations.
- **Stats**: total time, days tracked, current streak, longest streak, and
  busiest day for the selected range.
- **Popup summary**: today's total and top domains at a glance, with a live
  "currently tracking `example.com`" indicator, from the toolbar icon.
- **Export / clear**: download all data as JSON at any time, or permanently
  delete it — both fully in your control, no account to close.

## Installing (unpacked, for development)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `chrome-browsing-heatmap` folder.
4. Browse normally — the popup (toolbar icon) shows today's summary, and
   its **Open Dashboard** button opens the full heatmap.

## How it works

- `background.js` is the only piece that runs continuously (as an MV3
  service worker). Because service workers are killed after ~30 seconds of
  inactivity, it doesn't rely on a running timer to accumulate time.
  Instead, every relevant event — tab switch, URL change, window focus
  change, idle-state change, and a 1-minute `chrome.alarms` heartbeat —
  flushes elapsed time since the last checkpoint into
  `chrome.storage.local`, then starts a fresh checkpoint. Worst case, an
  unclean browser exit loses under a minute of data.
- Time is stored per calendar day as `{ total, domains: { domain: ms } }`,
  keyed by `YYYY-MM-DD`, with intervals that cross midnight split across
  the two days.
- A gap longer than 5 minutes since the last checkpoint (laptop sleep,
  suspended tab) is capped rather than fully credited, so a resumed
  session doesn't inflate a domain's total.
- `dashboard.js` reads that data straight out of `chrome.storage.local`
  (plus the in-progress session from `chrome.storage.session` for a live
  "today" figure) and renders the calendar grid, stats, and per-day
  breakdown entirely client-side.
- Data older than 400 days is pruned automatically to keep storage bounded.

## Project structure

```
manifest.json      Extension manifest (MV3)
background.js       Service worker: domain/idle tracking, storage writes, pruning
shared.js            Small date/duration formatting helpers shared by the UI pages
popup.html/.css/.js      Toolbar popup: today's summary + live tracking indicator
dashboard.html/.css/.js  Full-page heatmap, stats, per-day breakdown, export/clear
icons/               Generated PNG icons (16/32/48/128)
```

## Permissions used

| Permission | Why |
|---|---|
| `tabs` | Read the active tab's URL to attribute time to a domain — this is a passive background tracker, not something the user triggers per tab, so the narrower `activeTab` permission isn't sufficient. |
| `idle` | Detect when the user is away so idle time isn't counted. |
| `alarms` | A 1-minute heartbeat to keep saving data despite the service worker being killed between events, plus a periodic data-retention prune. |
| `storage` | Persist daily domain totals (`chrome.storage.local`) and the in-progress tracking session (`chrome.storage.session`). |

## Privacy

- No `host_permissions`, no `fetch`/`XMLHttpRequest` calls anywhere in the
  code, no analytics, no remote config. Only the `hostname` of the active
  tab's URL is ever read — full URLs, page titles, and content are never
  touched.
- `chrome://`, `about:`, extension pages, and other internal URLs are
  excluded from tracking.
- All data stays in `chrome.storage.local`/`chrome.storage.session`, which
  Chrome keeps on-device; nothing is synced or transmitted. The **Clear all
  data** button in the dashboard deletes everything immediately.
