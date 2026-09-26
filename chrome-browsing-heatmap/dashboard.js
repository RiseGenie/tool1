const CELL = 11;
const GAP = 3;
const WEEKDAY_LABELS = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let days = {};
let rangeMode = 'last90';
let selectedKey = hmDateKey(Date.now());

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

async function loadData() {
  const { days: storedDays = {} } = await chrome.storage.local.get('days');
  const { session } = await chrome.storage.session.get('session');
  days = JSON.parse(JSON.stringify(storedDays));

  if (session) {
    const key = hmDateKey(session.startedAt);
    const elapsed = Date.now() - session.startedAt;
    const bucket = days[key] || { total: 0, domains: {} };
    bucket.total += elapsed;
    bucket.domains[session.domain] = (bucket.domains[session.domain] || 0) + elapsed;
    days[key] = bucket;
  }
}

function computeRange(mode) {
  const today = startOfDay(Date.now());
  if (mode === 'last90') {
    return { start: addDays(today, -89), end: today };
  }
  if (mode === 'year') {
    return { start: new Date(today.getFullYear(), 0, 1), end: today };
  }
  // all time
  const keys = Object.keys(days).sort();
  const first = keys.length ? new Date(`${keys[0]}T00:00:00`) : addDays(today, -89);
  return { start: first, end: today };
}

function buildWeeks(start, end) {
  const gridStart = addDays(start, -start.getDay());
  const gridEnd = addDays(end, 6 - end.getDay());
  const weeks = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const inRange = cursor >= start && cursor <= end;
      const key = hmDateKey(cursor.getTime());
      week.push({ date: new Date(cursor), key, inRange, total: days[key]?.total || 0 });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function levelFor(value, max) {
  if (!value || max <= 0) return 0;
  const ratio = value / max;
  if (ratio <= 0.02) return 1;
  if (ratio <= 0.25) return 2;
  if (ratio <= 0.6) return 3;
  return 4;
}

function renderGrid() {
  const { start, end } = computeRange(rangeMode);
  const weeks = buildWeeks(start, end);

  let max = 0;
  for (const week of weeks) for (const d of week) if (d.inRange) max = Math.max(max, d.total);

  const grid = document.getElementById('grid');
  const months = document.getElementById('months');
  const weekdays = document.getElementById('weekdays');
  grid.innerHTML = '';
  months.innerHTML = '';
  weekdays.innerHTML = '';

  for (let row = 0; row < 7; row++) {
    weekdays.appendChild(el('div', 'weekday-label', WEEKDAY_LABELS[row] || ''));
  }

  const tooltip = document.getElementById('tooltip');
  let lastMonth = -1;

  weeks.forEach((week, weekIndex) => {
    const firstOfWeek = week[0].date;
    const month = firstOfWeek.getMonth();
    if (month !== lastMonth && week.some((d) => d.inRange)) {
      const label = el('div', 'month-label', MONTH_NAMES[month]);
      label.style.left = `${weekIndex * (CELL + GAP)}px`;
      months.appendChild(label);
      lastMonth = month;
    }

    for (const day of week) {
      const cell = el('div', 'day-cell');
      if (!day.inRange) {
        cell.classList.add('out-of-range');
      } else {
        cell.classList.add(`level-${levelFor(day.total, max)}`);
        if (day.key === selectedKey) cell.classList.add('selected');
        cell.dataset.key = day.key;

        cell.addEventListener('mouseenter', (e) => {
          const top = domainsFor(day.key)[0];
          tooltip.innerHTML = '';
          const strong = el('strong', null, day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
          const line = el('div', null, day.total ? `${hmFormatDuration(day.total)} tracked${top ? ` · mostly ${top[0]}` : ''}` : 'No activity');
          tooltip.appendChild(strong);
          tooltip.appendChild(line);
          tooltip.style.display = 'block';
          positionTooltip(e);
        });
        cell.addEventListener('mousemove', positionTooltip);
        cell.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
        cell.addEventListener('click', () => {
          selectedKey = day.key;
          renderGrid();
          renderDayPanel();
        });
      }
      grid.appendChild(cell);
    }
  });
}

function positionTooltip(e) {
  const tooltip = document.getElementById('tooltip');
  const margin = 14;
  let left = e.clientX + margin;
  if (left + 220 > window.innerWidth) left = e.clientX - 220 - margin;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.min(e.clientY + margin, window.innerHeight - 80)}px`;
}

function domainsFor(key) {
  const bucket = days[key];
  if (!bucket) return [];
  return Object.entries(bucket.domains).sort((a, b) => b[1] - a[1]);
}

function renderDayPanel() {
  const title = document.getElementById('day-title');
  const totalEl = document.getElementById('day-total');
  const list = document.getElementById('domain-list');
  const emptyEl = document.getElementById('day-empty');

  const isToday = selectedKey === hmDateKey(Date.now());
  title.textContent = isToday ? 'Today' : hmFormatDate(selectedKey);

  const bucket = days[selectedKey] || { total: 0, domains: {} };
  totalEl.textContent = hmFormatDuration(bucket.total);

  const entries = domainsFor(selectedKey);
  list.innerHTML = '';
  emptyEl.style.display = entries.length ? 'none' : 'block';
  const max = entries.length ? entries[0][1] : 1;

  for (const [domain, ms] of entries) {
    const row = el('div', 'domain-row');
    row.appendChild(el('span', 'domain-name', domain));
    const track = el('div', 'domain-bar-track');
    const fill = el('div', 'domain-bar-fill');
    fill.style.width = `${Math.max(3, Math.round((ms / max) * 100))}%`;
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el('span', 'domain-time', hmFormatDuration(ms)));
    list.appendChild(row);
  }
}

function renderStats() {
  const { start, end } = computeRange(rangeMode);
  const keys = [];
  let cursor = start;
  while (cursor <= end) {
    keys.push(hmDateKey(cursor.getTime()));
    cursor = addDays(cursor, 1);
  }

  let totalMs = 0;
  let daysTracked = 0;
  let busiestKey = null;
  let busiestMs = 0;

  for (const key of keys) {
    const ms = days[key]?.total || 0;
    totalMs += ms;
    if (ms > 0) daysTracked += 1;
    if (ms > busiestMs) { busiestMs = ms; busiestKey = key; }
  }

  let currentStreak = 0;
  for (let i = keys.length - 1; i >= 0; i--) {
    if ((days[keys[i]]?.total || 0) > 0) currentStreak += 1;
    else break;
  }

  let longestStreak = 0;
  let run = 0;
  for (const key of keys) {
    if ((days[key]?.total || 0) > 0) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }

  const stats = [
    { label: 'Total time', value: hmFormatDuration(totalMs) },
    { label: 'Days tracked', value: String(daysTracked) },
    { label: 'Current streak', value: `${currentStreak} day${currentStreak === 1 ? '' : 's'}` },
    { label: 'Longest streak', value: `${longestStreak} day${longestStreak === 1 ? '' : 's'}` },
    { label: 'Busiest day', value: busiestKey ? hmFormatDuration(busiestMs) : '—' },
  ];

  const container = document.getElementById('stats');
  container.innerHTML = '';
  for (const s of stats) {
    const card = el('div', 'stat');
    card.appendChild(el('div', 'stat-value', s.value));
    card.appendChild(el('div', 'stat-label', s.label));
    container.appendChild(card);
  }
}

function renderAll() {
  renderStats();
  renderGrid();
  renderDayPanel();
}

document.getElementById('range-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-range]');
  if (!btn) return;
  rangeMode = btn.dataset.range;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === btn));
  renderStats();
  renderGrid();
});

document.getElementById('export').addEventListener('click', async () => {
  const { days: storedDays = {}, firstTrackedDate } = await chrome.storage.local.get(['days', 'firstTrackedDate']);
  const blob = new Blob([JSON.stringify({ firstTrackedDate, days: storedDays }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `browsing-heatmap-${hmDateKey(Date.now())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('clear').addEventListener('click', async () => {
  if (!confirm('This permanently deletes all locally stored browsing time data. Continue?')) return;
  await chrome.storage.local.clear();
  await chrome.storage.session.clear();
  days = {};
  selectedKey = hmDateKey(Date.now());
  renderAll();
});

(async function init() {
  await loadData();
  renderAll();
  setInterval(async () => {
    await loadData();
    renderAll();
  }, 30000);
})();
