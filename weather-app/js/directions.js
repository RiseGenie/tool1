/* ==========================================================================
   Directions: OSRM routing drawn as an animated route on the Leaflet map,
   turn-by-turn steps, and the weather sampled along the way at the time you
   would actually be there.
   ========================================================================== */
(function (global) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const OSRM = 'https://router.project-osrm.org/route/v1/';
  const MODE_ICON = { driving: '🚗', bike: '🚲', foot: '🚶' };

  let map, api = {}, mode = 'driving';
  const ends = { from: null, to: null };          // { lat, lon, name }
  let group = null, vehicle = null, vehicleRaf = 0, routeCoords = null, seq = 0;

  function init(opts) {
    map = opts.map; api = opts;
    $('dirBtn').addEventListener('click', () => (isOpen() ? close() : open()));
    $('dirClose').addEventListener('click', close);
    $('dirSwap').addEventListener('click', swap);
    $('dirClear').addEventListener('click', clearRoute);
    $('dirMe').addEventListener('click', useMyLocation);
    $('dirPin').addEventListener('click', usePin);
    $('dirForm').addEventListener('submit', (e) => { e.preventDefault(); route(); });
    document.querySelectorAll('.dir-mode').forEach(b => b.addEventListener('click', () => {
      mode = b.dataset.mode;
      document.querySelectorAll('.dir-mode').forEach(x => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', String(on)); });
      if (ends.from && ends.to && routeCoords) route();
    }));
    ['dirFrom', 'dirTo'].forEach(id => autocomplete($(id), id === 'dirFrom' ? 'from' : 'to'));
  }

  function isOpen() { return !$('dirCard').hidden; }
  function open(preset) {
    preset = preset || {};
    const card = $('dirCard'); card.hidden = false; requestAnimationFrame(() => card.classList.add('is-open'));
    $('dirBtn').classList.add('is-on'); document.body.classList.add('dir-open');
    if (preset.to) setEnd('to', preset.to);
    if (preset.from) setEnd('from', preset.from);
    if (!ends.to) { const pin = api.getPin && api.getPin(); if (pin) setEnd('to', pin); }
    if (!ends.from) { const me = api.getMe && api.getMe(); if (me) setEnd('from', me); }
    setTimeout(() => (ends.from ? $('dirTo') : $('dirFrom')).focus(), 350);
    if (api.onOpen) api.onOpen();
  }
  function close() {
    const card = $('dirCard'); card.classList.remove('is-open'); $('dirBtn').classList.remove('is-on'); document.body.classList.remove('dir-open');
    setTimeout(() => { card.hidden = true; }, 350);
    hideSugg();
  }
  function setEnd(which, p) {
    ends[which] = { lat: +p.lat, lon: +p.lon, name: p.name || `${(+p.lat).toFixed(3)}, ${(+p.lon).toFixed(3)}` };
    $(which === 'from' ? 'dirFrom' : 'dirTo').value = ends[which].name;
  }
  function swap() {
    const f = ends.from; ends.from = ends.to; ends.to = f;
    $('dirFrom').value = ends.from ? ends.from.name : ''; $('dirTo').value = ends.to ? ends.to.name : '';
    if (ends.from && ends.to) route();
  }
  async function useMyLocation() {
    const b = $('dirMe'); b.classList.add('is-busy');
    try {
      let loc; try { loc = await WeatherAPI.locateByBrowser(9000); } catch (e) { loc = await WeatherAPI.locateByIP(); }
      setEnd('from', { lat: loc.lat, lon: loc.lon, name: 'My location' });
      if (api.setMe) api.setMe(loc);
      if (ends.to) route(); else $('dirTo').focus();
    } catch (e) { api.toast('Could not find your location.'); }
    b.classList.remove('is-busy');
  }
  function usePin() {
    const pin = api.getPin && api.getPin();
    if (!pin) return api.toast('Drop a pin on the map first, then use it as the destination.');
    setEnd('to', pin); if (ends.from) route(); else $('dirFrom').focus();
  }

  // ---- autocomplete shared by both inputs -----------------------------------------------------
  const sugg = () => $('dirSugg');
  let suggItems = [], suggIndex = -1, suggFor = null, timer = null, sseq = 0;
  function autocomplete(input, which) {
    input.addEventListener('input', () => {
      ends[which] = null;
      clearTimeout(timer);
      const q = input.value.trim(); if (q.length < 2) return hideSugg();
      timer = setTimeout(async () => {
        const s = ++sseq;
        try { const items = await WeatherAPI.searchPlaces(q); if (s !== sseq) return; showSugg(items, which, input); } catch (e) { hideSugg(); }
      }, 220);
    });
    input.addEventListener('keydown', (e) => {
      if (sugg().hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSugg(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSugg(-1); }
      else if (e.key === 'Enter' && suggIndex >= 0) { e.preventDefault(); pick(suggIndex); }
      else if (e.key === 'Escape') hideSugg();
    });
    input.addEventListener('focus', () => { suggFor = which; });
  }
  function showSugg(items, which, input) {
    suggItems = items; suggIndex = -1; suggFor = which;
    const ul = sugg(); if (!items.length) return hideSugg();
    ul.innerHTML = items.map((it, i) => `<li role="option" data-i="${i}"><span class="flag">${WeatherAPI.flagFromCode(it.countryCode)}</span><span>${esc(it.name)}</span><small>${esc([it.admin, it.country].filter(Boolean).join(', '))}</small></li>`).join('');
    ul.style.top = (input.offsetTop + input.offsetHeight + 6) + 'px';
    ul.hidden = false;
    ul.querySelectorAll('li').forEach(li => li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(+li.dataset.i); }));
  }
  function hideSugg() { const ul = sugg(); ul.hidden = true; suggItems = []; suggIndex = -1; clearTimeout(timer); sseq++; }
  function moveSugg(dir) {
    const lis = sugg().querySelectorAll('li'); if (!lis.length) return;
    suggIndex = (suggIndex + dir + lis.length) % lis.length;
    lis.forEach((li, i) => li.setAttribute('aria-selected', i === suggIndex ? 'true' : 'false'));
  }
  function pick(i) {
    const it = suggItems[i]; if (!it) return;
    setEnd(suggFor, { lat: it.lat, lon: it.lon, name: it.name + (it.country ? ', ' + it.country : '') });
    hideSugg();
    if (ends.from && ends.to) route(); else $(suggFor === 'from' ? 'dirTo' : 'dirFrom').focus();
  }
  document.addEventListener('click', (e) => { if (!e.target.closest('.dir-form')) hideSugg(); });
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- routing ---------------------------------------------------------------------------------
  async function resolveTyped(which) {
    if (ends[which]) return ends[which];
    const q = $(which === 'from' ? 'dirFrom' : 'dirTo').value.trim();
    if (!q) return null;
    if (/^my location$/i.test(q)) { await useMyLocation(); return ends.from; }
    const items = await WeatherAPI.searchPlaces(q);
    if (!items.length) throw new Error(`No place found for “${q}”`);
    setEnd(which, { lat: items[0].lat, lon: items[0].lon, name: items[0].name + (items[0].country ? ', ' + items[0].country : '') });
    return ends[which];
  }

  async function route() {
    const id = ++seq;
    hideSugg();
    $('dirResult').hidden = true; $('dirLoading').hidden = false;
    try {
      const [a, b] = await Promise.all([resolveTyped('from'), resolveTyped('to')]);
      if (id !== seq) return;
      if (!a || !b) { $('dirLoading').hidden = true; return api.toast('Enter both a start and a destination.'); }
      let data = await osrm(mode, a, b);
      if (id !== seq) return;
      if (!data && mode !== 'driving') data = await osrm('driving', a, b);
      if (!data) throw new Error('No route found between those places.');
      const r = data.routes[0];
      // The public OSRM demo server only knows the car profile: keep its road geometry
      // for bike/walk but estimate the time from typical speeds (15 km/h, 4.8 km/h).
      if (mode !== 'driving') { r.duration = r.distance / (mode === 'bike' ? 4.17 : 1.33); r.estimated = true; }
      const coords = r.geometry.coordinates.map(c => [c[1], c[0]]);
      drawRoute(coords, a, b);
      routeCoords = coords;
      renderSummary(r, a, b);
      renderSteps(r);
      $('dirLoading').hidden = true; $('dirResult').hidden = false;
      weatherAlong(r, routeCoords, id);
    } catch (err) {
      if (id !== seq) return;
      $('dirLoading').hidden = true;
      api.toast(err.message || 'Routing failed. Please try again.');
    }
  }
  async function osrm(profile, a, b) {
    const url = `${OSRM}${profile}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson&steps=true`;
    try {
      const res = await fetch(url); const data = await res.json();
      return data.code === 'Ok' && data.routes && data.routes.length ? data : null;
    } catch (e) { return null; }
  }

  // ---- drawing -----------------------------------------------------------------------------------
  function endIcon(letter) { return L.divIcon({ className: 'route-end ' + letter.toLowerCase(), html: `<span>${letter}</span>`, iconSize: [30, 38], iconAnchor: [15, 36] }); }
  function drawRoute(coords, a, b) {
    clearRoute(true);
    group = L.layerGroup().addTo(map);
    const casing = L.polyline([], { className: 'route-casing', color: '#fff', weight: 11, opacity: 0.95, lineJoin: 'round', lineCap: 'round' }).addTo(group);
    const line = L.polyline([], { className: 'route-line', color: '#ff4081', weight: 6, opacity: 1, lineJoin: 'round', lineCap: 'round' }).addTo(group);
    const flow = L.polyline([], { className: 'route-flow', color: '#fff', weight: 2.5, opacity: 0.9, dashArray: '6 14', lineCap: 'round' }).addTo(group);
    L.marker([a.lat, a.lon], { icon: endIcon('A'), interactive: false }).addTo(group);
    L.marker([b.lat, b.lon], { icon: endIcon('B'), interactive: false }).addTo(group);

    // camera: fit with padding for the open cards
    const wide = window.innerWidth > 720;
    const padTL = wide ? [ $('panel').classList.contains('is-open') ? 440 : 40, 110 ] : [30, 90];
    const padBR = wide ? [400, 60] : [30, Math.round(window.innerHeight * 0.55)];
    map.flyToBounds(L.latLngBounds(coords), { paddingTopLeft: padTL, paddingBottomRight: padBR, duration: 1.4, maxZoom: 14 });

    // draw-in animation
    const total = coords.length, start = performance.now(), dur = Math.min(2600, 700 + total * 2);
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 3);
      const n = Math.max(2, Math.round(e * total));
      const part = coords.slice(0, n);
      casing.setLatLngs(part); line.setLatLngs(part); flow.setLatLngs(part);
      if (t < 1) requestAnimationFrame(step); else startVehicle(coords);
    };
    requestAnimationFrame(step);
  }
  function startVehicle(coords) {
    stopVehicle();
    vehicle = L.marker(coords[0], { icon: L.divIcon({ className: 'route-vehicle', html: `<span>${MODE_ICON[mode] || '🚗'}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }), interactive: false, zIndexOffset: 500 }).addTo(group);
    const cum = cumulative(coords), total = cum[cum.length - 1];
    const dur = Math.max(6000, Math.min(24000, total / 8)); // ~8 m/ms, clamped
    let t0 = performance.now();
    const tick = (now) => {
      const p = ((now - t0) % dur) / dur;
      const d = p * total;
      let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
      const f = (d - cum[i - 1]) / Math.max(1, cum[i] - cum[i - 1]);
      const a = coords[i - 1], b = coords[i];
      vehicle.setLatLng([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      const el = vehicle.getElement(); if (el) el.style.setProperty('--flip', b[1] < a[1] ? '-1' : '1');
      vehicleRaf = requestAnimationFrame(tick);
    };
    vehicleRaf = requestAnimationFrame(tick);
  }
  function stopVehicle() { if (vehicleRaf) cancelAnimationFrame(vehicleRaf); vehicleRaf = 0; vehicle = null; }
  function clearRoute(keepUI) {
    stopVehicle();
    if (group) { group.remove(); group = null; }
    routeCoords = null;
    if (!keepUI) { $('dirResult').hidden = true; if (api.onClear) api.onClear(); }
  }

  // geometry helpers (metres)
  function hav(a, b) {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function cumulative(coords) { const c = [0]; for (let i = 1; i < coords.length; i++) c.push(c[i - 1] + hav(coords[i - 1], coords[i])); return c; }
  function pointAt(coords, cum, d) {
    let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
    const f = (d - cum[i - 1]) / Math.max(1, cum[i] - cum[i - 1]);
    return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f];
  }

  // ---- results ------------------------------------------------------------------------------------
  const fmtDist = (m) => api.units() === 'F' ? (m / 1609.344 >= 10 ? Math.round(m / 1609.344) + ' mi' : (m / 1609.344).toFixed(1) + ' mi') : (m >= 10000 ? Math.round(m / 1000) + ' km' : (m / 1000).toFixed(1) + ' km');
  const fmtDur = (s) => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h} h ${m} min` : `${m} min`; };
  const clock = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  function renderSummary(r, a, b) {
    $('dirDist').textContent = fmtDist(r.distance);
    $('dirTime').textContent = `${MODE_ICON[mode]} ${r.estimated ? '≈ ' : ''}${fmtDur(r.duration)}`;
    $('dirEta').textContent = `Leave now → arrive ${clock(new Date(Date.now() + r.duration * 1000))}`;
    $('dirAdvice').textContent = 'Checking the sky along your route…';
    $('dirWeather').innerHTML = '';
  }

  const MANEUVER = {
    depart: '🚩', arrive: '🏁', turn: null, 'new name': '⬆️', continue: '⬆️', merge: '↗️', 'on ramp': '↗️', 'off ramp': '↘️',
    fork: '⑂', 'end of road': null, roundabout: '🔄', rotary: '🔄', 'roundabout turn': '🔄', 'exit roundabout': '🔄', notification: 'ℹ️', 'use lane': '⬆️',
  };
  const MOD = { left: '⬅️', right: '➡️', 'slight left': '↖️', 'slight right': '↗️', 'sharp left': '↙️', 'sharp right': '↘️', uturn: '↩️', straight: '⬆️' };
  function stepIcon(m) { return MANEUVER[m.type] || MOD[m.modifier] || '⬆️'; }
  function stepText(s) {
    const m = s.maneuver, name = s.name ? `onto ${s.name}` : '';
    const mod = m.modifier ? m.modifier : '';
    switch (m.type) {
      case 'depart': return `Head ${mod || 'out'} ${s.name ? 'on ' + s.name : ''}`.trim();
      case 'arrive': return `Arrive at your destination${mod ? ' on the ' + mod : ''}`;
      case 'turn': case 'end of road': return `Turn ${mod} ${name}`.trim();
      case 'new name': case 'continue': return `Continue ${mod && mod !== 'straight' ? mod + ' ' : ''}${s.name ? 'on ' + s.name : ''}`.trim();
      case 'merge': return `Merge ${mod} ${name}`.trim();
      case 'on ramp': return `Take the ramp ${mod} ${name}`.trim();
      case 'off ramp': return `Take the exit ${mod} ${name}`.trim();
      case 'fork': return `Keep ${mod} ${name}`.trim();
      case 'roundabout': case 'rotary': return `At the roundabout take exit ${m.exit || ''} ${name}`.trim();
      default: return `${m.type} ${mod} ${name}`.trim();
    }
  }
  function renderSteps(r) {
    const steps = r.legs.flatMap(l => l.steps);
    $('dirSteps').innerHTML = steps.map((s, i) => `<li style="animation-delay:${Math.min(i, 20) * 35}ms" data-i="${i}"><span class="s-ico">${stepIcon(s.maneuver)}</span><span class="s-txt">${esc(stepText(s))}</span><small>${s.distance > 20 ? fmtDist(s.distance) : ''}</small></li>`).join('');
    $('dirSteps').querySelectorAll('li').forEach(li => li.addEventListener('click', () => {
      const s = steps[+li.dataset.i]; const [lon, lat] = s.maneuver.location;
      map.flyTo([lat, lon], Math.max(map.getZoom(), 14), { duration: 0.9 });
      flashPoint(lat, lon);
    }));
  }
  function flashPoint(lat, lon) {
    if (!group) return;
    const m = L.marker([lat, lon], { icon: L.divIcon({ className: 'route-flash', html: '<i></i>', iconSize: [30, 30], iconAnchor: [15, 15] }), interactive: false }).addTo(group);
    setTimeout(() => m.remove(), 1600);
  }

  // ---- weather along the route -----------------------------------------------------------------------
  async function weatherAlong(r, coords, id) {
    const cum = cumulative(coords), total = cum[cum.length - 1];
    const fr = total > 400000 ? [0, 0.2, 0.4, 0.6, 0.8, 1] : total > 40000 ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1];
    const labels = { 0: 'Start', 1: 'Arrive' };
    const samples = fr.map(f => ({ f, pt: pointAt(coords, cum, f * total), eta: Date.now() + f * r.duration * 1000 }));
    const results = await Promise.allSettled(samples.map(async (s) => {
      const [fc, place] = await Promise.all([
        WeatherAPI.fetchForecast(s.pt[0], s.pt[1]),
        WeatherAPI.reverseGeocode(s.pt[0], s.pt[1]).catch(() => null),
      ]);
      // hour at the ETA, in that location's zone
      const local = new Date(s.eta + fc.utcOffset * 1000).toISOString().slice(0, 13);
      const h = fc.hourly.find(x => x.time.slice(0, 13) === local) || fc.hourly[0];
      const d = WeatherAPI.describe(h.code, h.isDay);
      return { s, fc, place, h, d };
    }));
    if (id !== seq) return;
    const ok = results.filter(x => x.status === 'fulfilled').map(x => x.value);
    if (!ok.length) { $('dirAdvice').textContent = 'Weather along the route is unavailable right now.'; return; }
    $('dirWeather').innerHTML = ok.map((x, i) => {
      const name = labels[x.s.f] || (x.place && x.place.name ? shortName(x.place.name) : Math.round(x.s.f * 100) + '%');
      return `<button type="button" class="wchip ${x.d.cat}" style="animation-delay:${i * 60}ms" data-lat="${x.s.pt[0]}" data-lon="${x.s.pt[1]}" title="${esc(x.d.label)} — drop a pin here">
        <small>${esc(name)}</small><span class="w-ico">${x.d.icon}</span><strong>${api.fmtTemp(x.h.temp)}°</strong><small>${clock(new Date(x.s.eta))}</small>
        ${x.h.rainChance != null ? `<em>☔ ${x.h.rainChance}%</em>` : ''}
      </button>`;
    }).join('');
    $('dirWeather').querySelectorAll('.wchip').forEach(b => b.addEventListener('click', () => api.selectLocation(+b.dataset.lat, +b.dataset.lon, { zoom: Math.max(map.getZoom(), 9) })));
    $('dirAdvice').textContent = advice(ok);
  }
  function shortName(n) { return n.length > 14 ? n.slice(0, 13) + '…' : n; }
  function advice(ok) {
    const bad = ok.find(x => x.d.cat === 'storm'), wet = ok.filter(x => ['rain', 'drizzle'].includes(x.d.cat)), snow = ok.find(x => x.d.cat === 'snow'), fog = ok.find(x => x.d.cat === 'fog');
    const where = (x) => (x.place && x.place.name) ? `near ${x.place.name}` : `around ${Math.round(x.s.f * 100)}% of the way`;
    if (bad) return `⚡ Thunderstorms ${where(bad)} at ${clock(new Date(bad.s.eta))} — consider waiting it out.`;
    if (snow) return `❄️ Snow ${where(snow)} around ${clock(new Date(snow.s.eta))}. Go slow and keep warm.`;
    if (fog) return `🌫️ Fog ${where(fog)} — lights on and extra distance.`;
    if (wet.length) return `☔ Rain ${where(wet[0])} around ${clock(new Date(wet[0].s.eta))} — pack an umbrella (and someone to share it with).`;
    const showery = ok.find(x => (x.h.rainChance || 0) >= 50);
    if (showery) return `🌦️ ${showery.h.rainChance}% chance of showers ${where(showery)} around ${clock(new Date(showery.s.eta))} — an umbrella wouldn't hurt.`;
    const temps = ok.map(x => x.h.temp), hot = Math.max(...temps), cold = Math.min(...temps);
    if (hot >= 31) return `🥵 It gets hot (${api.fmtTemp(hot)}°) on the way — bring water.`;
    if (cold <= 3) return `🧣 Chilly stretches (${api.fmtTemp(cold)}°) — scarf weather.`;
    return '☀️ Clear skies all the way. Enjoy the ride!';
  }

  global.Directions = { init, open, close, isOpen, clearRoute, setEnd, hasRoute: () => !!routeCoords };
})(window);
