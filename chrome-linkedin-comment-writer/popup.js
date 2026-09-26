const dot = document.getElementById('dot');
const statusText = document.getElementById('status-text');

(async function init() {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (apiKey) {
    dot.classList.add('ready');
    statusText.textContent = 'API key set — ready to draft.';
  } else {
    dot.classList.add('missing');
    statusText.textContent = 'Add your Claude API key to get started.';
  }
})();

document.getElementById('open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
