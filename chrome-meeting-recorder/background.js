const RECORDER_URL = chrome.runtime.getURL('recorder.html');

async function focusExistingRecorder() {
  const tabs = await chrome.tabs.query({ url: RECORDER_URL + '*' });
  if (!tabs.length) return false;
  const tab = tabs[0];
  await chrome.windows.update(tab.windowId, { focused: true });
  await chrome.tabs.update(tab.id, { active: true });
  return true;
}

chrome.action.onClicked.addListener(async () => {
  if (await focusExistingRecorder()) return;

  await chrome.windows.create({
    url: RECORDER_URL,
    type: 'popup',
    width: 420,
    height: 640,
  });
});
