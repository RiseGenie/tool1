const els = {
  nowTracking: document.getElementById('now-tracking'),
  nowText: document.getElementById('now-text'),
  total: document.getElementById('total'),
  list: document.getElementById('list'),
  emptyHint: document.getElementById('empty-hint'),
  openDashboard: document.getElementById('open-dashboard'),
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function render() {
  const todayKey = hmDateKey(Date.now());
  const { days = {} } = await chrome.storage.local.get('days');
  const { session } = await chrome.storage.session.get('session');

  const bucket = days[todayKey] || { total: 0, domains: {} };
  const domains = { ...bucket.domains };
  let total = bucket.total;

  const liveDomain = session?.domain || null;
  let liveElapsed = 0;
  if (session && hmDateKey(session.startedAt) === todayKey) {
    liveElapsed = Date.now() - session.startedAt;
    domains[session.domain] = (domains[session.domain] || 0) + liveElapsed;
    total += liveElapsed;
  }

  els.total.textContent = hmFormatDuration(total);

  if (liveDomain) {
    els.nowTracking.classList.add('active');
    els.nowText.textContent = `Tracking ${liveDomain}`;
  } else {
    els.nowTracking.classList.remove('active');
    els.nowText.textContent = 'Not currently tracking';
  }

  const sorted = Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 6);
  els.list.innerHTML = '';
  els.emptyHint.style.display = sorted.length ? 'none' : 'block';
  const max = sorted.length ? sorted[0][1] : 1;

  for (const [domain, ms] of sorted) {
    const row = el('div', 'row');
    row.appendChild(el('span', 'row-domain', domain));
    const track = el('div', 'row-bar-track');
    const fill = el('div', 'row-bar-fill');
    fill.style.width = `${Math.max(4, Math.round((ms / max) * 100))}%`;
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el('span', 'row-time', hmFormatDuration(ms)));
    els.list.appendChild(row);
  }
}

els.openDashboard.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

render();
setInterval(render, 1000);
