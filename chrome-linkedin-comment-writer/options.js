const apiKeyInput = document.getElementById('api-key');
const toggleKeyBtn = document.getElementById('toggle-key');
const keyStatus = document.getElementById('key-status');
const modelSelect = document.getElementById('model');
const personaInput = document.getElementById('persona');
const nicheInput = document.getElementById('niche');
const saveBtn = document.getElementById('save');
const savedHint = document.getElementById('saved-hint');

toggleKeyBtn.addEventListener('click', () => {
  const show = apiKeyInput.type === 'password';
  apiKeyInput.type = show ? 'text' : 'password';
  toggleKeyBtn.textContent = show ? 'Hide' : 'Show';
});

saveBtn.addEventListener('click', async () => {
  const niche = nicheInput.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  await chrome.storage.local.set({
    apiKey: apiKeyInput.value.trim(),
    model: modelSelect.value,
    persona: personaInput.value.trim(),
    niche,
  });
  savedHint.textContent = 'Saved.';
  setTimeout(() => { savedHint.textContent = ''; }, 1800);
});

const DEFAULT_NICHE = ['GoHighLevel', 'GHL', 'digital marketing', 'business automation', 'workflows', 'marketing automation', 'AI', 'AI agent', 'strategy'];

(async function init() {
  const { apiKey = '', model = 'claude-sonnet-5', persona = '', niche } = await chrome.storage.local.get(['apiKey', 'model', 'persona', 'niche']);
  apiKeyInput.value = apiKey;
  modelSelect.value = model;
  personaInput.value = persona;
  nicheInput.value = (niche === undefined ? DEFAULT_NICHE : niche).join(', ');
  keyStatus.textContent = apiKey ? 'Key saved.' : 'No key set yet.';
})();
