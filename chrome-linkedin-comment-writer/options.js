const apiKeyInput = document.getElementById('api-key');
const toggleKeyBtn = document.getElementById('toggle-key');
const keyStatus = document.getElementById('key-status');
const modelSelect = document.getElementById('model');
const personaInput = document.getElementById('persona');
const saveBtn = document.getElementById('save');
const savedHint = document.getElementById('saved-hint');

toggleKeyBtn.addEventListener('click', () => {
  const show = apiKeyInput.type === 'password';
  apiKeyInput.type = show ? 'text' : 'password';
  toggleKeyBtn.textContent = show ? 'Hide' : 'Show';
});

saveBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    apiKey: apiKeyInput.value.trim(),
    model: modelSelect.value,
    persona: personaInput.value.trim(),
  });
  savedHint.textContent = 'Saved.';
  setTimeout(() => { savedHint.textContent = ''; }, 1800);
});

(async function init() {
  const { apiKey = '', model = 'claude-sonnet-5', persona = '' } = await chrome.storage.local.get(['apiKey', 'model', 'persona']);
  apiKeyInput.value = apiKey;
  modelSelect.value = model;
  personaInput.value = persona;
  keyStatus.textContent = apiKey ? 'Key saved.' : 'No key set yet.';
})();
