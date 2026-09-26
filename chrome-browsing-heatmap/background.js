// Tracks active-tab domain time entirely locally. No network requests are
// ever made by this extension.
//
// MV3 service workers are killed after ~30s idle, so we can't rely on a
// running setInterval to accumulate time. Instead every relevant event
// (tab switch, url change, window focus change, idle-state change, and a
// 1-minute alarm heartbeat) flushes elapsed time since the last checkpoint
// into chrome.storage.local, then starts a fresh checkpoint. Worst case we
// lose under a minute of data if Chrome is killed uncleanly.

const HEARTBEAT_MINUTES = 1;
const MAX_SESSION_GAP_MS = 5 * 60 * 1000; // cap credit across sleep/suspend gaps
const RETENTION_DAYS = 400;
const IGNORED_PROTOCOLS = new Set([
  'chrome:', 'edge:', 'about:', 'chrome-extension:', 'devtools:', 'view-source:', 'chrome-search:',
]);

function domainFromUrl(url) {
  try {
    const u = new URL(url);
    if (IGNORED_PROTOCOLS.has(u.protocol)) return null;
    let host = u.hostname;
    if (!host) return null;
    if (host.startsWith('www.')) host = host.slice(4);
    return host;
  } catch {
    return null;
  }
}

function dateKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getSession() {
  const { session } = await chrome.storage.session.get('session');
  return session || null;
}

async function setSession(session) {
  await chrome.storage.session.set({ session });
}

// Credits `domain` with time from startTs to endTs, splitting the interval
// across midnight so each calendar day gets the right share.
async function addTime(domain, startTs, endTs) {
  if (!domain || endTs <= startTs) return;
  const { days = {} } = await chrome.storage.local.get('days');

  let cursor = startTs;
  while (cursor < endTs) {
    const d = new Date(cursor);
    const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const segmentEnd = Math.min(endTs, nextMidnight);
    const key = dateKey(cursor);
    const bucket = days[key] || { total: 0, domains: {} };
    const dur = segmentEnd - cursor;
    bucket.total += dur;
    bucket.domains[domain] = (bucket.domains[domain] || 0) + dur;
    days[key] = bucket;
    cursor = segmentEnd;
  }

  await chrome.storage.local.set({ days });

  const { firstTrackedDate } = await chrome.storage.local.get('firstTrackedDate');
  const startKey = dateKey(startTs);
  if (!firstTrackedDate || startKey < firstTrackedDate) {
    await chrome.storage.local.set({ firstTrackedDate: startKey });
  }
}

async function flush(now = Date.now()) {
  const session = await getSession();
  if (!session || !session.domain || !session.startedAt) return;
  let end = now;
  if (now - session.startedAt > MAX_SESSION_GAP_MS) {
    end = session.startedAt + MAX_SESSION_GAP_MS;
  }
  await addTime(session.domain, session.startedAt, end);
}

async function pruneOldDays() {
  const { days = {} } = await chrome.storage.local.get('days');
  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  let changed = false;
  for (const key of Object.keys(days)) {
    if (new Date(`${key}T00:00:00`).getTime() < cutoff) {
      delete days[key];
      changed = true;
    }
  }
  if (changed) await chrome.storage.local.set({ days });
}

async function getActiveDomain() {
  try {
    const state = await chrome.idle.queryState(60);
    if (state !== 'active') return null;

    const win = await chrome.windows.getLastFocused({ populate: true });
    if (!win || !win.focused) return null;
    const tab = (win.tabs || []).find((t) => t.active);
    if (!tab || !tab.url) return null;
    return domainFromUrl(tab.url);
  } catch {
    return null;
  }
}

async function refresh() {
  const now = Date.now();
  await flush(now);
  const domain = await getActiveDomain();
  await setSession(domain ? { domain, startedAt: now } : null);
}

chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(() => refresh());
chrome.tabs.onActivated.addListener(() => refresh());
chrome.tabs.onUpdated.addListener((_tabId, info) => {
  if (info.status === 'complete' || info.url) refresh();
});
chrome.tabs.onRemoved.addListener(() => refresh());
chrome.windows.onFocusChanged.addListener(() => refresh());

chrome.alarms.create('heartbeat', { periodInMinutes: HEARTBEAT_MINUTES });
chrome.alarms.create('prune', { periodInMinutes: 60 * 12 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'heartbeat') refresh();
  if (alarm.name === 'prune') pruneOldDays();
});

chrome.runtime.onStartup.addListener(() => refresh());
chrome.runtime.onInstalled.addListener(() => refresh());
