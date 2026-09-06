/* ==========================================================================
   Pindrop Weather — app orchestration
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const body = document.body;

  // ---- state ----------------------------------------------------------------
  const state = {
    units: (localStorage.getItem('pw-units') || 'C'),
    pinMode: true,
    marker: null,
    meMarker: null,
    forecast: null,
    place: null,
    mood: null,
    requestId: 0,
    tiles: 'day',
  };

  // ---- map ----------------------------------------------------------------------
  // Keyless Esri Canvas basemaps (light for day, dark for night) with separate label layers.
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
  const TILES = {
    day: ESRI + 'World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labels: ESRI + 'World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    night: ESRI + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    nightLabels: ESRI + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  };
  const MAX_ZOOM = 16;
  const map = L.map('map', {
    zoomControl: false,
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: MAX_ZOOM,
    zoomSnap: 0.25,
    attributionControl: false,
  }).setView([22, 10], 2.5);
  L.control.zoom({ position: 'bottomleft' }).addTo(map);

  const tileOpts = (extra) => Object.assign({ maxZoom: MAX_ZOOM, crossOrigin: true, className: 'tiles' }, extra);
  const baseDay = L.tileLayer(TILES.day, tileOpts({ className: 'tiles tiles-day' })).addTo(map);
  const baseNight = L.tileLayer(TILES.night, tileOpts({ opacity: 0, className: 'tiles tiles-night' })).addTo(map);
  const labelsDay = L.tileLayer(TILES.labels, tileOpts({ pane: 'overlayPane' })).addTo(map);
  const labelsNight = L.tileLayer(TILES.nightLabels, tileOpts({ pane: 'overlayPane', opacity: 0 })).addTo(map);

  function setTiles(mode) {
    if (state.tiles === mode) return;
    state.tiles = mode;
    const night = mode === 'night';
    fadeLayer(baseDay, night ? 0 : 1); fadeLayer(labelsDay, night ? 0 : 1);
    fadeLayer(baseNight, night ? 1 : 0); fadeLayer(labelsNight, night ? 1 : 0);
  }
  function fadeLayer(layer, target) {
    const from = layer.options.opacity, start = performance.now(), dur = 900;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      layer.setOpacity(from + (target - from) * t);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---- fx + cursor -----------------------------------------------------------------
  const mapFx = new FXCanvas($('fx'));
  const stageFx = new FXCanvas($('stageFx'));
  mapFx.setLayers(Moods.MOODS.ambient.mapFx);
  Cursor.init($('cursor'));
  Cursor.setTrail(Moods.MOODS.ambient.cursorTrail);

  // ---- pin marker --------------------------------------------------------------
  function pinIconHtml() {
    return `
      <div class="pin-shadow"></div>
      <div class="ring"></div><div class="ring r2"></div><div class="ring r3"></div>
      <div class="pin-body">
        <svg viewBox="0 0 44 58"><defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a65"/><stop offset="1" stop-color="#ff4081"/></linearGradient></defs>
          <path d="M22 2C11 2 2 10.6 2 21.4 2 36 22 56 22 56s20-20 20-34.6C42 10.6 33 2 22 2z" fill="url(#pg)"/>
          <circle cx="22" cy="21" r="8.5" fill="#fff"/><circle cx="22" cy="21" r="4" fill="#ff4081"/>
        </svg>
      </div>
      <div class="dust"></div><div class="dust"></div><div class="dust"></div><div class="dust"></div>`;
  }
  function dropPin(lat, lon) {
    if (state.marker) state.marker.remove();
    const icon = L.divIcon({ className: 'pin-icon', html: pinIconHtml(), iconSize: [44, 60], iconAnchor: [22, 56] });
    const m = L.marker([lat, lon], { icon, draggable: true, riseOnHover: true, keyboard: false }).addTo(map);
    m.on('dragstart', () => m.getElement().classList.add('is-dragging'));
    m.on('dragend', () => {
      m.getElement().classList.remove('is-dragging');
      const ll = m.getLatLng();
      // re-trigger the drop bounce and reload weather
      m.setIcon(L.divIcon({ className: 'pin-icon', html: pinIconHtml(), iconSize: [44, 60], iconAnchor: [22, 56] }));
      selectLocation(ll.lat, ll.lng, { fly: false });
    });
    state.marker = m;
  }

  // ---- location selection ---------------------------------------------------------
  async function selectLocation(lat, lon, opts) {
    opts = opts || {};
    const id = ++state.requestId;
    lat = Math.max(-85, Math.min(85, lat));
    lon = ((lon + 540) % 360) - 180;

    hideHint();
    openPanel(true);
    if (opts.fly !== false) {
      const targetZoom = opts.zoom || Math.max(map.getZoom(), 8);
      map.flyTo([lat, lon], targetZoom, { duration: opts.duration || 1.8, easeLinearity: 0.2 });
      // drop the pin once the camera arrives
      map.once('moveend', () => { if (id === state.requestId) dropPin(lat, lon); });
    } else if (!state.marker) {
      dropPin(lat, lon);
    }

    try {
      const [forecast, place] = await Promise.all([
        WeatherAPI.fetchForecast(lat, lon),
        opts.place ? Promise.resolve(opts.place) : WeatherAPI.reverseGeocode(lat, lon),
      ]);
      if (id !== state.requestId) return;
      state.forecast = forecast; state.place = place;
      state.mood = Moods.resolve(forecast);
      renderPanel();
      applyMood(state.mood);
    } catch (err) {
      console.error(err);
      if (id !== state.requestId) return;
      openPanel(false);
      toast('Could not reach the weather service. Check your connection and try again.');
    }
  }

  // ---- mood application ---------------------------------------------------------
  function applyMood(mood) {
    body.dataset.weather = mood.key;
    body.dataset.time = mood.night ? 'night' : 'day';
    setTiles(mood.night ? 'night' : 'day');
    mapFx.setLayers(mood.mapFx);
    stageFx.setLayers(mood.stageFx);
    Cursor.setTrail(mood.cursorTrail);

    const stage = $('stage');
    stage.style.setProperty('--stage-sky-a', mood.stage.skyA);
    stage.style.setProperty('--stage-sky-b', mood.stage.skyB);
    stage.style.background = `linear-gradient(180deg, ${mood.stage.skyA}, ${mood.stage.skyB})`;
    stage.querySelector('.stage-ground').style.background = mood.stage.ground;

    const scene = $('stageScene');
    scene.innerHTML = Characters.render(mood.scene);
    const cap = $('stageCaption');
    cap.textContent = mood.caption;
    cap.style.animation = 'none'; void cap.offsetWidth; cap.style.animation = '';
  }

  function resetAmbient() {
    body.dataset.weather = 'ambient';
    body.dataset.time = 'day';
    setTiles('day');
    mapFx.setLayers(Moods.MOODS.ambient.mapFx);
    stageFx.setLayers([]);
    Cursor.setTrail(Moods.MOODS.ambient.cursorTrail);
  }

  // ---- panel rendering ---------------------------------------------------------
  function openPanel(loading) {
    const p = $('panel');
    p.classList.add('is-open');
    p.classList.toggle('is-loading', !!loading);
    $('panelBody').hidden = !!loading;
  }
  function closePanel() {
    $('panel').classList.remove('is-open');
    state.requestId++;
    if (state.marker) { state.marker.remove(); state.marker = null; }
    resetAmbient();
    showHint();
  }

  const fmtT = (c) => state.units === 'F' ? Math.round(c * 9 / 5 + 32) : Math.round(c);
  const unit = () => '°' + state.units;
  const fmtWind = (kmh) => state.units === 'F' ? Math.round(kmh * 0.621371) + ' mph' : Math.round(kmh) + ' km/h';
  const compass = (d) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];
  const timeOf = (iso) => { const m = /T(\d{2}):(\d{2})/.exec(iso); return m ? m[1] + ':' + m[2] : '--:--'; };
  const hour12 = (iso) => { const h = +iso.slice(11, 13); return (h % 12 || 12) + (h < 12 ? 'am' : 'pm'); };
  const dayName = (d, i) => i === 0 ? 'Today' : new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });

  function localTimeLabel(f) {
    // Open-Meteo gives times in the location's zone; derive "now" from utcOffset.
    const now = new Date(Date.now() + f.utcOffset * 1000);
    const hh = now.getUTCHours(), mm = now.getUTCMinutes();
    return `${(hh % 12 || 12)}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'} local`;
  }

  function renderPanel() {
    const f = state.forecast, n = f.now, place = state.place, mood = state.mood;
    const d = WeatherAPI.describe(n.code, n.isDay);

    $('placeName').textContent = (place.countryCode ? WeatherAPI.flagFromCode(place.countryCode) + ' ' : '') + place.name;
    $('placeMeta').textContent = [place.meta, localTimeLabel(f), mood.season[0].toUpperCase() + mood.season.slice(1)].filter(Boolean).join(' · ');

    $('nowIcon').innerHTML = weatherIconSVG(d.cat, n.isDay);
    $('nowTemp').textContent = fmtT(n.temp);
    $('nowUnit').textContent = unit();
    $('nowDesc').textContent = d.label;
    $('nowFeels').textContent = `Feels like ${fmtT(n.feels)}${unit()}`;

    $('dHumidity').textContent = Math.round(n.humidity) + '%';
    $('dWind').textContent = fmtWind(n.wind) + ' ' + compass(n.windDir);
    $('dCloud').textContent = Math.round(n.cloud) + '%';
    $('dRain').textContent = (f.daily[0].rainChance != null ? f.daily[0].rainChance : 0) + '%';
    $('dSunrise').textContent = timeOf(f.daily[0].sunrise);
    $('dSunset').textContent = timeOf(f.daily[0].sunset);

    // hourly: from the current hour, next 12
    const nowHour = n.time.slice(0, 13);
    let start = f.hourly.findIndex(h => h.time.slice(0, 13) === nowHour);
    if (start < 0) start = 0;
    const hours = f.hourly.slice(start, start + 12);
    $('hourly').innerHTML = hours.map((h, i) => {
      const hd = WeatherAPI.describe(h.code, h.isDay);
      return `<div class="hour ${i === 0 ? 'is-now' : ''}" style="animation-delay:${i * 40}ms">
        <span class="h-time">${i === 0 ? 'Now' : hour12(h.time)}</span>
        <span class="h-ico">${hd.icon}</span>
        <span>${fmtT(h.temp)}°</span>
      </div>`;
    }).join('');

    // daily
    const allMin = Math.min(...f.daily.map(x => x.min)), allMax = Math.max(...f.daily.map(x => x.max));
    const span = Math.max(1, allMax - allMin);
    $('daily').innerHTML = f.daily.map((day, i) => {
      const dd = WeatherAPI.describe(day.code, true);
      const l = ((day.min - allMin) / span) * 100, r = ((day.max - allMin) / span) * 100;
      return `<div class="day" style="animation-delay:${i * 50}ms" title="${dd.label}">
        <span class="d-name">${dayName(day.date, i)}</span>
        <span class="d-ico">${dd.icon}</span>
        <span class="d-bar"><span style="left:${l}%;width:${Math.max(6, r - l)}%"></span></span>
        <span class="d-range">${fmtT(day.max)}° <small>${fmtT(day.min)}°</small></span>
      </div>`;
    }).join('');

    $('panel').classList.remove('is-loading');
    $('panelBody').hidden = false;
    $('panelBody').scrollTop = 0;
    stageFx.resize();
  }

  /** Animated inline SVG icon for the "now" block. */
  function weatherIconSVG(cat, isDay) {
    const sun = `<g class="ico-sun"><circle cx="32" cy="32" r="12" fill="#ffca28"/><g style="transform-origin:32px 32px;animation:spin 12s linear infinite">${[0,45,90,135,180,225,270,315].map(a => `<rect x="30" y="8" width="4" height="8" rx="2" fill="#ffca28" transform="rotate(${a} 32 32)"/>`).join('')}</g></g>`;
    const moon = `<path d="M40 14a16 16 0 1 0 12 26a13 13 0 1 1 -12 -26z" fill="#fff59d"/>`;
    const cloud = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><g style="animation:bob 3s ease-in-out infinite"><path d="M10 30h30a9 9 0 0 0 0 -18a12 12 0 0 0 -23 -3a8 8 0 0 0 -7 21z" fill="${c || '#fff'}" stroke="rgba(0,0,0,.08)"/></g></g>`;
    const drops = (c) => [14, 26, 38].map((x, i) => `<path d="M${x} 44q3 6 0 8q-3 -2 0 -8z" fill="${c || '#64b5f6'}" style="animation:sweat 1.2s ${i * .3}s ease-in infinite"/>`).join('');
    const flakes = [14, 26, 38].map((x, i) => `<circle cx="${x}" cy="46" r="2.5" fill="#fff" stroke="#bbdefb" style="animation:sweat 1.8s ${i * .4}s ease-in infinite"/>`).join('');
    const bolt = `<path d="M30 40l-6 12h6l-3 10l10 -14h-6l4 -8z" fill="#ffee58" style="animation:glow .5s ease-in-out infinite alternate"/>`;
    let inner;
    switch (cat) {
      case 'clear': inner = isDay ? sun : moon; break;
      case 'partly': inner = (isDay ? sun : moon) + cloud(14, 20, 0.9); break;
      case 'cloudy': inner = cloud(4, 12, 0.9, '#cfd8dc') + cloud(18, 22, 1); break;
      case 'fog': inner = cloud(10, 10, 1, '#eceff1') + `<path d="M8 46h48M14 54h36" stroke="#b0bec5" stroke-width="3" stroke-linecap="round" style="animation:bob 2s ease-in-out infinite"/>`; break;
      case 'drizzle': inner = cloud(10, 8, 1, '#cfd8dc') + drops('#90caf9'); break;
      case 'rain': inner = cloud(10, 8, 1, '#b0bec5') + drops(); break;
      case 'snow': inner = cloud(10, 8, 1) + flakes; break;
      case 'storm': inner = cloud(10, 4, 1, '#78909c') + bolt; break;
      default: inner = sun;
    }
    return `<svg viewBox="0 0 64 64">${inner}</svg>`;
  }

  // ---- search ------------------------------------------------------------------
  const input = $('searchInput'), sugg = $('suggestions');
  let suggItems = [], suggIndex = -1, searchTimer = null, searchSeq = 0;

  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { hideSuggestions(); return; }
    searchTimer = setTimeout(async () => {
      const seq = ++searchSeq;
      try {
        const items = await WeatherAPI.searchPlaces(q);
        if (seq !== searchSeq) return;
        showSuggestions(items);
      } catch (e) { hideSuggestions(); }
    }, 220);
  });
  input.addEventListener('keydown', (e) => {
    if (sugg.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSugg(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSugg(-1); }
    else if (e.key === 'Escape') hideSuggestions();
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) hideSuggestions(); });

  function showSuggestions(items) {
    suggItems = items; suggIndex = -1;
    if (!items.length) { hideSuggestions(); return; }
    sugg.innerHTML = items.map((it, i) => `<li role="option" data-i="${i}"><span class="flag">${WeatherAPI.flagFromCode(it.countryCode)}</span><span>${escapeHtml(it.name)}</span><small>${escapeHtml([it.admin, it.country].filter(Boolean).join(', '))}</small></li>`).join('');
    sugg.hidden = false;
    sugg.querySelectorAll('li').forEach(li => li.addEventListener('click', () => pickSuggestion(+li.dataset.i)));
  }
  function hideSuggestions() { sugg.hidden = true; suggItems = []; suggIndex = -1; }
  function moveSugg(dir) {
    const lis = sugg.querySelectorAll('li'); if (!lis.length) return;
    suggIndex = (suggIndex + dir + lis.length) % lis.length;
    lis.forEach((li, i) => li.setAttribute('aria-selected', i === suggIndex ? 'true' : 'false'));
  }
  function pickSuggestion(i) {
    const it = suggItems[i]; if (!it) return;
    input.value = it.name + (it.country ? ', ' + it.country : '');
    hideSuggestions(); input.blur();
    selectLocation(it.lat, it.lon, { zoom: 9, place: { name: it.name, meta: [it.admin, it.country].filter(Boolean).join(', '), countryCode: it.countryCode } });
  }
  $('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (suggIndex >= 0) return pickSuggestion(suggIndex);
    const q = input.value.trim(); if (!q) return;
    try {
      const items = await WeatherAPI.searchPlaces(q);
      if (!items.length) return toast(`No place found for “${q}”`);
      suggItems = items; pickSuggestion(0);
    } catch (err) { toast('Search failed. Please try again.'); }
  });
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---- drop-pin mode + map clicks -------------------------------------------------
  const pinBtn = $('pinModeBtn');
  pinBtn.addEventListener('click', () => {
    state.pinMode = !state.pinMode;
    pinBtn.classList.toggle('is-on', state.pinMode);
    pinBtn.setAttribute('aria-pressed', String(state.pinMode));
    Cursor.setPinMode(state.pinMode);
    toast(state.pinMode ? 'Drop-pin mode on — click anywhere on the map' : 'Drop-pin mode off — the map is now just for browsing');
  });
  map.on('click', (e) => {
    if (!state.pinMode) return;
    const z = Math.max(map.getZoom(), 7);
    selectLocation(e.latlng.lat, e.latlng.lng, { zoom: z, duration: 1.1 });
  });

  // ---- show me ------------------------------------------------------------------
  const showMe = $('showMeBtn');
  showMe.addEventListener('click', async () => {
    if (showMe.classList.contains('is-busy')) return;
    showMe.classList.add('is-busy');
    hideHint();
    let loc = null;
    try { loc = await WeatherAPI.locateByBrowser(9000); }
    catch (e) {
      try { loc = await WeatherAPI.locateByIP(); toast('Using an approximate location from your network'); }
      catch (e2) { toast('Could not find you — try searching or dropping a pin instead.'); }
    }
    showMe.classList.remove('is-busy');
    if (!loc) return;
    if (state.meMarker) state.meMarker.remove();
    state.meMarker = L.marker([loc.lat, loc.lon], { icon: L.divIcon({ className: 'me-icon', html: '<div class="pulse"></div><div class="core"></div>', iconSize: [26, 26], iconAnchor: [13, 13] }), interactive: false, zIndexOffset: -10 }).addTo(map);
    // Cinematic: zoom out a touch, then swoop in
    selectLocation(loc.lat, loc.lon, { zoom: loc.approx ? 9 : 11, duration: 2.6 });
  });

  // ---- units ---------------------------------------------------------------------
  const unitsBtn = $('unitsBtn');
  unitsBtn.textContent = '°' + state.units;
  unitsBtn.addEventListener('click', () => {
    state.units = state.units === 'C' ? 'F' : 'C';
    localStorage.setItem('pw-units', state.units);
    unitsBtn.textContent = '°' + state.units;
    if (state.forecast) renderPanel();
  });

  // ---- misc UI --------------------------------------------------------------------
  $('panelClose').addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('panel').classList.contains('is-open') && sugg.hidden) closePanel(); });

  let toastTimer;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }
  function hideHint() { $('hint').classList.add('is-hidden'); }
  function showHint() { $('hint').classList.remove('is-hidden'); }

  // Deep-link support: #lat,lon
  const m = /^#(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(location.hash);
  if (m) selectLocation(+m[1], +m[2], { zoom: 9 });

  // Expose a little for debugging in the console
  window.PindropWeather = { map, state, selectLocation, applyMood };
})();
