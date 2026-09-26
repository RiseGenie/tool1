importScripts('idb-store.js');

const MAX_CANVAS_HEIGHT = 32000; // stay well under browser canvas height limits
const MAX_STEPS = 80; // safety cap for very long / infinite-scroll pages
const CAPTURE_GAP_MS = 350; // stay under captureVisibleTab's rate limit

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Functions injected into the page. Each must be self-contained: no
// references to background.js's outer scope, only its own args/globals. ---

function pageCapturePrepare() {
  const fixedEls = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const style = getComputedStyle(el);
    if (style.position === 'fixed' || style.position === 'sticky') {
      fixedEls.push({ el, prevVisibility: el.style.visibility });
      el.style.visibility = 'hidden';
    }
  }
  window.__pcFixedEls = fixedEls;

  const htmlEl = document.documentElement;
  window.__pcPrevScrollBehavior = htmlEl.style.scrollBehavior;
  htmlEl.style.scrollBehavior = 'auto';

  // Most pages scroll the window/document, but a fair number of modern
  // (often SPA-style) sites keep the document itself unscrollable and
  // instead scroll an inner container. Find whichever one actually has
  // scrollable range so capture works either way.
  function scrollRange(el) {
    return el.scrollHeight - el.clientHeight;
  }

  let target = document.scrollingElement || document.documentElement;
  let bestRange = scrollRange(target);

  if (bestRange <= 1) {
    const candidates = document.querySelectorAll('body *');
    for (const el of candidates) {
      const range = scrollRange(el);
      if (range <= 1) continue;
      const style = getComputedStyle(el);
      if (!/(auto|scroll)/.test(style.overflowY)) continue;
      if (range > bestRange) {
        bestRange = range;
        target = el;
      }
    }
  }

  window.__pcScrollTarget = target;
  window.__pcIsWindowScroll = target === document.scrollingElement || target === document.documentElement;
  window.__pcOriginalScrollX = window.__pcIsWindowScroll ? window.scrollX : target.scrollLeft;
  window.__pcOriginalScrollY = window.__pcIsWindowScroll ? window.scrollY : target.scrollTop;

  const rect = target.getBoundingClientRect();
  const totalHeight = Math.max(target.scrollHeight, target.clientHeight);
  const viewportHeight = window.__pcIsWindowScroll ? window.innerHeight : Math.round(rect.height);

  return {
    totalHeight,
    viewportWidth: window.innerWidth,
    viewportHeight,
    dpr: window.devicePixelRatio || 1,
    scrolledContainer: !window.__pcIsWindowScroll,
  };
}

async function pageCaptureScrollTo(y) {
  const target = window.__pcScrollTarget || document.scrollingElement || document.documentElement;
  if (window.__pcIsWindowScroll) {
    window.scrollTo(0, y);
  } else {
    target.scrollTop = y;
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await new Promise((resolve) => setTimeout(resolve, 120));
  return window.__pcIsWindowScroll ? window.scrollY : target.scrollTop;
}

function pageCaptureRestore() {
  const fixedEls = window.__pcFixedEls || [];
  for (const { el, prevVisibility } of fixedEls) {
    el.style.visibility = prevVisibility;
  }
  delete window.__pcFixedEls;

  document.documentElement.style.scrollBehavior = window.__pcPrevScrollBehavior || '';

  const target = window.__pcScrollTarget || document.scrollingElement || document.documentElement;
  if (window.__pcIsWindowScroll) {
    window.scrollTo(window.__pcOriginalScrollX || 0, window.__pcOriginalScrollY || 0);
  } else {
    target.scrollLeft = window.__pcOriginalScrollX || 0;
    target.scrollTop = window.__pcOriginalScrollY || 0;
  }
  delete window.__pcScrollTarget;
  delete window.__pcIsWindowScroll;
}

// --- Orchestration ---

async function execInTab(tabId, func, args = []) {
  const [{ result } = {}] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return result;
}

async function captureVisibleWithRetry(windowId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    } catch (err) {
      const message = String(err?.message || err);
      if (message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND') && attempt < 4) {
        await sleep(500 + attempt * 200);
        continue;
      }
      throw err;
    }
  }
}

async function captureFullPage(tab) {
  const tabId = tab.id;
  const metrics = await execInTab(tabId, pageCapturePrepare);

  try {
    const cappedHeight = Math.min(metrics.totalHeight, MAX_CANVAS_HEIGHT / metrics.dpr);
    const steps = Math.min(
      MAX_STEPS,
      Math.max(1, Math.ceil(cappedHeight / metrics.viewportHeight))
    );

    const slices = [];
    for (let i = 0; i < steps; i++) {
      const targetY = Math.min(i * metrics.viewportHeight, cappedHeight - metrics.viewportHeight);
      const actualY = await execInTab(tabId, pageCaptureScrollTo, [Math.max(0, targetY)]);
      if (i > 0) await sleep(CAPTURE_GAP_MS);
      const dataUrl = await captureVisibleWithRetry(tab.windowId);
      slices.push({ y: actualY, dataUrl });
    }

    await pcSaveCapture({
      slices,
      viewportWidth: metrics.viewportWidth,
      viewportHeight: metrics.viewportHeight,
      totalHeight: cappedHeight,
      dpr: metrics.dpr,
      truncated: cappedHeight < metrics.totalHeight,
      sourceUrl: tab.url,
      capturedAt: Date.now(),
    });
  } finally {
    await execInTab(tabId, pageCaptureRestore);
  }

  await chrome.tabs.create({ url: chrome.runtime.getURL('stitch.html') });
}

async function captureVisibleOnly(tab) {
  const dataUrl = await captureVisibleWithRetry(tab.windowId);
  await pcSaveCapture({
    slices: [{ y: 0, dataUrl }],
    viewportWidth: tab.width || null,
    viewportHeight: tab.height || null,
    totalHeight: null, // resolved from the image itself on the stitch page
    dpr: 1,
    truncated: false,
    sourceUrl: tab.url,
    capturedAt: Date.now(),
    visibleOnly: true,
  });
  await chrome.tabs.create({ url: chrome.runtime.getURL('stitch.html') });
}

function isCapturable(url) {
  return /^https?:|^file:/.test(url || '');
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'capture-full-page') {
    (async () => {
      try {
        const tab = await getActiveTab();
        if (!tab?.id || !isCapturable(tab.url)) {
          sendResponse({ error: 'This page cannot be captured.' });
          return;
        }
        await captureFullPage(tab);
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ error: String(err?.message || err) });
      }
    })();
    return true;
  }

  if (message?.type === 'capture-visible') {
    (async () => {
      try {
        const tab = await getActiveTab();
        if (!tab?.id || !isCapturable(tab.url)) {
          sendResponse({ error: 'This page cannot be captured.' });
          return;
        }
        await captureVisibleOnly(tab);
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ error: String(err?.message || err) });
      }
    })();
    return true;
  }

  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'capture-full-page') return;
  const tab = await getActiveTab();
  if (!tab?.id || !isCapturable(tab.url)) return;
  try {
    await captureFullPage(tab);
  } catch (err) {
    // Nothing to show the user from a keyboard shortcut; the popup path
    // surfaces errors instead.
  }
});
