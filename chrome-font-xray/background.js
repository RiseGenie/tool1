function isInjectable(url) {
  return /^https?:|^file:/.test(url || '');
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

async function scanPage(tabId) {
  await ensureContentScript(tabId);
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.fontXrayScanPage(),
  });
  return result || [];
}

async function startInspector(tabId) {
  await ensureContentScript(tabId);
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.fontXrayStartInspector(),
  });
  return result;
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-inspector') return;
  const tab = await getActiveTab();
  if (!tab?.id || !isInjectable(tab.url)) return;
  try {
    await startInspector(tab.id);
  } catch (err) {
    // Page may not allow script injection (e.g. chrome:// URLs).
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'scan-fonts') {
    (async () => {
      try {
        const tab = await getActiveTab();
        if (!tab?.id || !isInjectable(tab.url)) {
          sendResponse({ error: 'This page does not allow scanning.' });
          return;
        }
        const report = await scanPage(tab.id);
        await chrome.storage.local.set({ lastReport: report, lastReportAt: Date.now() });
        sendResponse({ report });
      } catch (err) {
        sendResponse({ error: String(err?.message || err) });
      }
    })();
    return true;
  }

  if (message?.type === 'start-inspector') {
    (async () => {
      try {
        const tab = await getActiveTab();
        if (!tab?.id || !isInjectable(tab.url)) {
          sendResponse({ error: 'This page does not allow inspecting.' });
          return;
        }
        const status = await startInspector(tab.id);
        sendResponse({ status });
      } catch (err) {
        sendResponse({ error: String(err?.message || err) });
      }
    })();
    return true;
  }

  if (message?.type === 'font-xray-pin') {
    (async () => {
      const { pinned = [] } = await chrome.storage.local.get('pinned');
      const key = [
        message.entry.fontFamily,
        message.entry.fontSize,
        message.entry.fontWeight,
        message.entry.lineHeight,
        message.entry.letterSpacing,
      ].join('|');
      if (!pinned.some((e) => e.__key === key)) {
        pinned.unshift({ ...message.entry, __key: key });
        await chrome.storage.local.set({ pinned: pinned.slice(0, 50) });
      }
    })();
    return false;
  }

  return false;
});
