// Injected into the page via chrome.scripting.executeScript.

function fontXrayReadStyle(el) {
  const cs = getComputedStyle(el);
  const fontSize = parseFloat(cs.fontSize);
  const lineHeightRaw = cs.lineHeight;
  const lineHeight = lineHeightRaw === 'normal' ? null : parseFloat(lineHeightRaw);
  const letterSpacing = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
  return {
    fontFamily: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    fontFamilyFull: cs.fontFamily,
    fontSize: Math.round(fontSize * 100) / 100,
    fontWeight: cs.fontWeight,
    fontStyle: cs.fontStyle,
    lineHeight: lineHeight === null ? 'normal' : Math.round((lineHeight / fontSize) * 100) / 100,
    letterSpacing: Math.round(letterSpacing * 100) / 100,
    textTransform: cs.textTransform,
    color: cs.color,
  };
}

function fontXraySignature(style) {
  return [
    style.fontFamily,
    style.fontSize,
    style.fontWeight,
    style.fontStyle,
    style.lineHeight,
    style.letterSpacing,
    style.textTransform,
    style.color,
  ].join('|');
}

function fontXraySelectorFor(el) {
  if (!el || el.nodeType !== 1) return '';
  let s = el.tagName.toLowerCase();
  if (el.id) s += `#${el.id}`;
  else if (el.classList.length) s += `.${el.classList[0]}`;
  return s;
}

function fontXrayIsVisible(el) {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// Walk the page and collect every distinct typographic style in use.
function fontXrayScanPage() {
  const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG']);
  const seenElements = new Set();
  const entries = new Map();

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || skipTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node;
  while ((node = walker.nextNode())) {
    const el = node.parentElement;
    if (seenElements.has(el)) continue;
    seenElements.add(el);
    if (!fontXrayIsVisible(el)) continue;

    const style = fontXrayReadStyle(el);
    const key = fontXraySignature(style);
    const text = node.nodeValue.trim().slice(0, 60);

    if (entries.has(key)) {
      entries.get(key).count += 1;
    } else {
      entries.set(key, {
        ...style,
        count: 1,
        sampleText: text,
        sampleSelector: fontXraySelectorFor(el),
      });
    }
  }

  return Array.from(entries.values()).sort((a, b) => b.count - a.count);
}

// Interactive hover inspector: highlights the element under the cursor,
// shows a live tooltip with its type properties, and lets the user click
// to pin entries into a running in-page report panel.
function fontXrayStartInspector() {
  if (window.__fontXrayStop) {
    window.__fontXrayStop();
    return 'stopped';
  }

  const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const pinned = new Map();

  const highlight = document.createElement('div');
  highlight.style.cssText = `
    position: fixed; pointer-events: none; z-index: 2147483645;
    border: 2px solid #6366f1; background: rgba(99,102,241,.12);
    border-radius: 3px; display: none; transition: none;
  `;

  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position: fixed; z-index: 2147483647; pointer-events: none;
    background: rgba(20,20,24,.95); color: #fff; border-radius: 8px;
    padding: 8px 10px; font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    box-shadow: 0 4px 16px rgba(0,0,0,.35); display: none; max-width: 300px;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    width: 260px; max-height: 70vh; overflow: auto;
    background: #fff; color: #1a1a1a; border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0,0,0,.25); border: 1px solid rgba(0,0,0,.08);
    font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #eee;">
      <strong style="font-size:12px;">Font X-Ray</strong>
      <button id="fx-stop" style="border:none;background:#111;color:#fff;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">Done</button>
    </div>
    <div style="padding:8px 12px;color:#888;font-size:11px;">Hover text, click to pin a style.</div>
    <div id="fx-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;"></div>
  `;

  document.documentElement.appendChild(highlight);
  document.documentElement.appendChild(tooltip);
  document.documentElement.appendChild(panel);

  function renderList() {
    const list = panel.querySelector('#fx-list');
    list.innerHTML = '';
    for (const entry of pinned.values()) {
      const row = document.createElement('div');
      row.style.cssText = 'border:1px solid #eee;border-radius:8px;padding:6px 8px;';

      const title = document.createElement('div');
      title.style.cssText = 'font-weight:600;font-size:11px;margin-bottom:2px;';
      title.textContent = `${entry.fontFamily} · ${entry.fontSize}px`;

      const meta = document.createElement('div');
      meta.style.cssText = 'color:#888;font-size:10px;font-family:ui-monospace,monospace;';
      meta.textContent = `weight ${entry.fontWeight} · lh ${entry.lineHeight} · ls ${entry.letterSpacing}px`;

      row.appendChild(title);
      row.appendChild(meta);
      list.appendChild(row);
    }
  }

  function elementUnder(x, y) {
    highlight.style.display = 'none';
    tooltip.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    return el;
  }

  function onMove(e) {
    const el = elementUnder(e.clientX, e.clientY);
    if (!el || skipTags.has(el.tagName) || panel.contains(el)) return;

    const rect = el.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = rect.left + 'px';
    highlight.style.top = rect.top + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';

    const style = fontXrayReadStyle(el);
    tooltip.textContent = '';
    const rows = [
      [style.fontFamily, 'font-weight:600;margin-bottom:4px;'],
      [`size: ${style.fontSize}px   weight: ${style.fontWeight}`, ''],
      [`line-height: ${style.lineHeight}   letter-spacing: ${style.letterSpacing}px`, ''],
      [`transform: ${style.textTransform}   color: ${style.color}`, ''],
      ['click to pin', 'margin-top:4px;color:#9ca3af;'],
    ];
    for (const [text, css] of rows) {
      const row = document.createElement('div');
      if (css) row.style.cssText = css;
      row.textContent = text;
      tooltip.appendChild(row);
    }
    tooltip.style.display = 'block';
    const ttW = 260, margin = 14;
    let left = e.clientX + margin;
    if (left + ttW > window.innerWidth) left = e.clientX - ttW - margin;
    tooltip.style.left = left + 'px';
    tooltip.style.top = Math.min(e.clientY + margin, window.innerHeight - 120) + 'px';

    onMove._current = { el, style };
  }

  function onClick(e) {
    if (panel.contains(e.target)) return;
    if (!onMove._current) return;
    e.preventDefault();
    e.stopPropagation();
    const { el, style } = onMove._current;
    const key = fontXraySignature(style);
    if (!pinned.has(key)) {
      pinned.set(key, {
        ...style,
        count: 1,
        sampleText: (el.textContent || '').trim().slice(0, 60),
        sampleSelector: fontXraySelectorFor(el),
      });
      renderList();
      chrome.runtime.sendMessage({ type: 'font-xray-pin', entry: pinned.get(key) }).catch(() => {});
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') cleanup();
  }

  function cleanup() {
    highlight.remove();
    tooltip.remove();
    panel.remove();
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    window.__fontXrayStop = null;
  }

  panel.querySelector('#fx-stop').addEventListener('click', cleanup);
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);

  window.__fontXrayStop = cleanup;
  return 'started';
}
