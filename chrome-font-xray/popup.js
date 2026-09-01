const els = {
  inspect: document.getElementById('inspect'),
  scan: document.getElementById('scan'),
  hint: document.getElementById('hint'),
  title: document.getElementById('report-title'),
  list: document.getElementById('list'),
  emptyHint: document.getElementById('empty-hint'),
  copyCss: document.getElementById('copy-css'),
  copyJson: document.getElementById('copy-json'),
  clear: document.getElementById('clear'),
  shortcut: document.getElementById('shortcut'),
};

let currentEntries = [];

function keyOf(e) {
  return [e.fontFamily, e.fontSize, e.fontWeight, e.lineHeight, e.letterSpacing].join('|');
}

function mergeEntries(report, pinned) {
  const map = new Map();
  for (const e of report) map.set(keyOf(e), e);
  for (const e of pinned) if (!map.has(keyOf(e))) map.set(keyOf(e), e);
  return Array.from(map.values()).sort((a, b) => (b.count || 1) - (a.count || 1));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function render(entries) {
  currentEntries = entries;
  els.list.innerHTML = '';
  els.emptyHint.style.display = entries.length ? 'none' : 'block';
  els.title.textContent = entries.length ? `Type system — ${entries.length} style${entries.length === 1 ? '' : 's'}` : 'Type system';

  for (const e of entries) {
    const entry = el('div', 'entry');

    const top = el('div', 'entry-top');
    top.appendChild(el('span', 'entry-family', e.fontFamily));
    top.appendChild(el('span', 'entry-count', `${e.count || 1}×`));
    entry.appendChild(top);

    entry.appendChild(el('div', 'entry-meta', `${e.fontSize}px · ${e.fontWeight} · lh ${e.lineHeight} · ls ${e.letterSpacing}px`));

    const sample = el('div', 'entry-sample', e.sampleText || '');
    // Safe: these are numeric/CSS-token values from getComputedStyle, and
    // setProperty never parses its value as markup, unlike innerHTML.
    sample.style.setProperty('font-family', e.fontFamilyFull || e.fontFamily);
    sample.style.setProperty('font-size', `${Math.min(e.fontSize, 16)}px`);
    sample.style.setProperty('font-weight', e.fontWeight);
    entry.appendChild(sample);

    els.list.appendChild(entry);
  }
}

function toCssVars(entries) {
  return ':root {\n' + entries.map((e, i) => {
    const n = i + 1;
    return `  --type-${n}-font: ${e.fontFamilyFull || e.fontFamily};\n` +
      `  --type-${n}-size: ${e.fontSize}px;\n` +
      `  --type-${n}-weight: ${e.fontWeight};\n` +
      `  --type-${n}-line-height: ${e.lineHeight};\n` +
      `  --type-${n}-letter-spacing: ${e.letterSpacing}px;`;
  }).join('\n\n') + '\n}';
}

async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = original; }, 1000);
  } catch (err) {
    // Ignore clipboard failures.
  }
}

els.copyCss.addEventListener('click', () => {
  if (currentEntries.length) copy(toCssVars(currentEntries), els.copyCss);
});

els.copyJson.addEventListener('click', () => {
  if (currentEntries.length) copy(JSON.stringify(currentEntries, null, 2), els.copyJson);
});

els.clear.addEventListener('click', async () => {
  await chrome.storage.local.set({ lastReport: [], pinned: [] });
  render([]);
});

els.scan.addEventListener('click', async () => {
  els.scan.disabled = true;
  els.hint.textContent = 'Scanning the page…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'scan-fonts' });
    if (response?.error) {
      els.hint.textContent = response.error;
    } else {
      const { pinned = [] } = await chrome.storage.local.get('pinned');
      render(mergeEntries(response.report || [], pinned));
      els.hint.textContent = `Found ${response.report.length} distinct text style(s).`;
    }
  } catch (err) {
    els.hint.textContent = 'Could not scan this page.';
  } finally {
    els.scan.disabled = false;
  }
});

els.inspect.addEventListener('click', async () => {
  els.hint.textContent = 'Opening inspector on the page…';
  try {
    await chrome.runtime.sendMessage({ type: 'start-inspector' });
    // The popup will close as focus moves to the page — the on-page panel
    // takes over and keeps saving pins to storage.
  } catch (err) {
    els.hint.textContent = 'Could not open the inspector on this page.';
  }
});

(async function init() {
  const { lastReport = [], pinned = [] } = await chrome.storage.local.get(['lastReport', 'pinned']);
  render(mergeEntries(lastReport, pinned));

  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((c) => c.name === 'toggle-inspector')?.shortcut;
  if (shortcut) els.shortcut.textContent = shortcut;
})();
