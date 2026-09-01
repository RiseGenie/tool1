const els = {
  swatch: document.getElementById('swatch'),
  hex: document.getElementById('hex'),
  rgb: document.getElementById('rgb'),
  hsl: document.getElementById('hsl'),
  pick: document.getElementById('pick'),
  hint: document.getElementById('hint'),
  grid: document.getElementById('history-grid'),
  emptyHint: document.getElementById('empty-hint'),
  clear: document.getElementById('clear'),
  shortcut: document.getElementById('shortcut'),
};

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function render(hex) {
  if (!hex) {
    els.swatch.style.setProperty('--swatch-color', 'transparent');
    els.hex.value = '';
    els.rgb.value = '';
    els.hsl.value = '';
    return;
  }
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  els.swatch.style.setProperty('--swatch-color', hex);
  els.hex.value = hex.toUpperCase();
  els.rgb.value = `rgb(${rgb.join(', ')})`;
  els.hsl.value = `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`;
}

function renderHistory(history) {
  els.grid.innerHTML = '';
  els.emptyHint.style.display = history.length ? 'none' : 'block';
  for (const hex of history) {
    const div = document.createElement('div');
    div.className = 'history-swatch';
    div.style.background = hex;
    div.title = hex.toUpperCase();
    div.addEventListener('click', () => render(hex));
    els.grid.appendChild(div);
  }
}

async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied';
    button.classList.add('copied');
    setTimeout(() => {
      button.textContent = 'Copy';
      button.classList.remove('copied');
    }, 1000);
  } catch (err) {
    // Clipboard permissions can fail silently; ignore.
  }
}

document.querySelectorAll('.copy').forEach((btn) => {
  btn.addEventListener('click', () => {
    const field = btn.dataset.copy;
    const value = document.getElementById(field).value;
    if (value) copy(value, btn);
  });
});

els.clear.addEventListener('click', async () => {
  await chrome.storage.local.set({ history: [] });
  renderHistory([]);
});

els.pick.addEventListener('click', async () => {
  els.pick.disabled = true;
  els.hint.textContent = 'Move to the page and click a pixel…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'pick-color' });
    if (response?.error) {
      els.hint.textContent = response.error;
    } else if (response?.picked) {
      render(response.picked.hex);
      els.hint.textContent = 'Copied to clipboard.';
      const { history = [] } = await chrome.storage.local.get('history');
      renderHistory(history);
    } else {
      els.hint.textContent = 'Cancelled.';
    }
  } catch (err) {
    els.hint.textContent = 'Could not open the picker on this page.';
  } finally {
    els.pick.disabled = false;
  }
});

(async function init() {
  const { history = [], lastPicked } = await chrome.storage.local.get(['history', 'lastPicked']);
  renderHistory(history);
  render(lastPicked || history[0] || null);

  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((c) => c.name === 'pick-color')?.shortcut;
  if (shortcut) els.shortcut.textContent = shortcut;
})();
