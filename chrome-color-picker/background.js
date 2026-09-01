const MAX_HISTORY = 24;

async function saveToHistory(hex) {
  const { history = [] } = await chrome.storage.local.get('history');
  const next = [hex, ...history.filter((h) => h !== hex)].slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ history: next, lastPicked: hex });
}

async function pickColorInTab(tabId) {
  let screenshotDataUrl = null;
  try {
    screenshotDataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
  } catch (err) {
    // Ignore — EyeDropper doesn't need it, and it's only a fallback source.
  }

  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (dataUrl) => window.colorSnapPickColor(dataUrl),
    args: [screenshotDataUrl],
  });
  return result || null;
}

async function performPick(tabId) {
  const picked = await pickColorInTab(tabId);
  if (!picked) return null;

  await saveToHistory(picked.hex);

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (hex) => {
        navigator.clipboard.writeText(hex).catch(() => {});
      },
      args: [picked.hex],
    });
  } catch (err) {
    // Clipboard write is best-effort.
  }

  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Color copied',
      message: `${picked.hex} copied to clipboard`,
    });
  }

  return picked;
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'pick-color') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !/^https?:|^file:/.test(tab.url || '')) return;
  try {
    await performPick(tab.id);
  } catch (err) {
    // Page may not allow script injection (e.g. chrome:// URLs) — nothing to do.
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'pick-color') return false;
  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !/^https?:|^file:/.test(tab.url || '')) {
        sendResponse({ error: 'This page does not allow color picking.' });
        return;
      }
      const picked = await performPick(tab.id);
      sendResponse({ picked });
    } catch (err) {
      sendResponse({ error: String(err?.message || err) });
    }
  })();
  return true; // keep the message channel open for the async response
});
