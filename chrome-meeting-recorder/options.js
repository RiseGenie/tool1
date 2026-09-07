const fields = ['anthropicApiKey', 'resendApiKey', 'fromEmail', 'fromName', 'toEmail'];

const DEFAULTS = {
  anthropicApiKey: '',
  resendApiKey: '',
  fromEmail: 'info@risegenie.com',
  fromName: 'RiseGenie Meeting Recorder',
  toEmail: 'risegenie@gmail.com',
};

const statusEl = document.getElementById('status');

async function load() {
  const stored = await chrome.storage.local.get(fields);
  for (const field of fields) {
    document.getElementById(field).value = stored[field] ?? DEFAULTS[field];
  }
}

async function save() {
  const values = {};
  for (const field of fields) {
    values[field] = document.getElementById(field).value.trim();
  }
  await chrome.storage.local.set(values);
  statusEl.textContent = 'Saved.';
  statusEl.classList.add('success');
  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.classList.remove('success');
  }, 2000);
}

document.getElementById('save').addEventListener('click', save);
load();
