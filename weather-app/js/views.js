/* ==========================================================================
   Map views: base layer switcher (streets / satellite / roads), the 3D terrain
   flyover "video" (MapLibre GL + terrain tiles) and the street-level road view.
   ========================================================================== */
(function (global) {
  'use strict';

  const ARC = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const URLS = {
    day: ARC + 'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    dayLabels: ARC + 'Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    night: ARC + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    nightLabels: ARC + 'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    satellite: ARC + 'World_Imagery/MapServer/tile/{z}/{y}/{x}',
    satLabels: ARC + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    roads: ARC + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    terrain: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  };

  let map, layers = {}, base = 'streets', night = false, toast = () => {};

  // ---- base layers ------------------------------------------------------------------
  function initBase(leafletMap, opts) {
    map = leafletMap; toast = (opts && opts.toast) || toast;
    const MAX = opts && opts.maxZoom || 18;
    const o = (extra) => Object.assign({ maxZoom: MAX, maxNativeZoom: 18, crossOrigin: true, className: 'tiles', opacity: 0 }, extra);
    layers = {
      day: L.tileLayer(URLS.day, o({ className: 'tiles tiles-day', opacity: 1, maxNativeZoom: 16 })),
      dayLabels: L.tileLayer(URLS.dayLabels, o({ pane: 'overlayPane', opacity: 1, maxNativeZoom: 16 })),
      night: L.tileLayer(URLS.night, o({ className: 'tiles tiles-night', maxNativeZoom: 16 })),
      nightLabels: L.tileLayer(URLS.nightLabels, o({ pane: 'overlayPane', maxNativeZoom: 16 })),
      satellite: L.tileLayer(URLS.satellite, o({ className: 'tiles tiles-sat', maxNativeZoom: 19 })),
      satLabels: L.tileLayer(URLS.satLabels, o({ pane: 'overlayPane', className: 'tiles tiles-satlabels', maxNativeZoom: 16 })),
      roads: L.tileLayer(URLS.roads, o({ className: 'tiles tiles-roads', maxNativeZoom: 19 })),
    };
    ['day', 'night', 'satellite', 'roads', 'dayLabels', 'nightLabels', 'satLabels'].forEach(k => layers[k].addTo(map));
    document.body.dataset.view = base;
  }

  function targets() {
    const t = { day: 0, dayLabels: 0, night: 0, nightLabels: 0, satellite: 0, satLabels: 0, roads: 0 };
    if (base === 'streets') { if (night) { t.night = 1; t.nightLabels = 1; } else { t.day = 1; t.dayLabels = 1; } }
    else if (base === 'satellite') { t.satellite = 1; t.satLabels = 1; }
    else if (base === 'roads') { t.roads = 1; }
    return t;
  }
  function apply(dur) {
    const t = targets();
    for (const k in t) fadeLayer(layers[k], t[k], dur);
    document.body.dataset.view = base;
    document.querySelectorAll('.view-btn[data-view]').forEach(b => {
      const on = b.dataset.view === base;
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
    });
  }
  function fadeLayer(layer, target, dur) {
    dur = dur || 800;
    const from = layer.options.opacity;
    if (Math.abs(from - target) < 0.001) return;
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      layer.setOpacity(from + (target - from) * k);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function setBase(name) { if (!layers[name === 'streets' ? 'day' : name]) return; base = name; apply(); }
  function setNight(isNight) { night = !!isNight; apply(900); }
  function getBase() { return base; }

  // ---- 3D flyover -----------------------------------------------------------------------
  const v3d = { gl: null, fx: null, ctx: null, playing: false, speed: 1, raf: 0, marker: null };
  const $ = (id) => document.getElementById(id);

  function webglOK() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  function skyFor(mood) {
    const k = mood ? mood.key : 'sunny', n = mood && mood.night;
    if (n) return { sky: '#0b1236', horizon: '#2a3570', fog: '#1a2352', blend: 0.6 };
    switch (k) {
      case 'storm': return { sky: '#3a4160', horizon: '#6d7590', fog: '#7c849c', blend: 0.9 };
      case 'rain': case 'drizzle': case 'cloudy': return { sky: '#7d93b3', horizon: '#c0cddf', fog: '#c9d3e2', blend: 0.75 };
      case 'fog': return { sky: '#b8bfcb', horizon: '#e0e4ea', fog: '#e4e7ec', blend: 1 };
      case 'snow': case 'cold': return { sky: '#a7c8ea', horizon: '#eaf3fb', fog: '#f0f6fc', blend: 0.7 };
      case 'hot': return { sky: '#ffa94d', horizon: '#ffe0b0', fog: '#ffe9c8', blend: 0.6 };
      case 'autumn': return { sky: '#ffb870', horizon: '#ffe6c8', fog: '#ffefdc', blend: 0.6 };
      default: return { sky: '#5aa9ff', horizon: '#d8ecff', fog: '#e6f2ff', blend: 0.5 };
    }
  }

  function style3D(mood) {
    const s = skyFor(mood);
    return {
      version: 8,
      sources: {
        sat: { type: 'raster', tiles: [URLS.satellite], tileSize: 256, maxzoom: 19, attribution: '© Esri' },
        labels: { type: 'raster', tiles: [URLS.satLabels], tileSize: 256, maxzoom: 16 },
        dem: { type: 'raster-dem', tiles: [URLS.terrain], tileSize: 256, encoding: 'terrarium', maxzoom: 15, attribution: 'Terrain: AWS/Mapzen' },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': s.fog } },
        { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-fade-duration': 300, 'raster-brightness-max': mood && mood.night ? 0.55 : 1, 'raster-saturation': mood && mood.night ? -0.4 : 0.1 } },
        { id: 'hills', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#1a2340' } },
        { id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.85 } },
      ],
      terrain: { source: 'dem', exaggeration: +($('v3dExag').value || 1.5) },
      sky: {
        'sky-color': s.sky, 'horizon-color': s.horizon, 'fog-color': s.fog,
        'sky-horizon-blend': s.blend, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.85,
      },
    };
  }

  function open3D(ctx) {
    if (!global.maplibregl) return toast('The 3D engine could not be loaded.');
    if (!webglOK()) return toast('3D needs WebGL, which this browser has disabled.');
    const el = $('view3d'); el.hidden = false; el.classList.add('is-open');
    document.body.dataset.overlay = '3d';
    $('v3dPlace').textContent = (ctx.place && ctx.place.name) || `${ctx.lat.toFixed(3)}, ${ctx.lon.toFixed(3)}`;
    $('v3dWeather').textContent = ctx.weatherLine || 'Flying over the pin';
    $('v3dLoading').hidden = false;

    if (v3d.gl) { v3d.gl.remove(); v3d.gl = null; }
    if (!v3d.fx) v3d.fx = new FXCanvas($('fx3d'));
    v3d.fx.resize();
    v3d.fx.setLayers(ctx.mood ? ctx.mood.mapFx : ['clouds-soft']);

    const mobile = window.innerWidth < 720;
    const gl = new maplibregl.Map({
      container: 'gl', style: style3D(ctx.mood),
      center: [ctx.lon, ctx.lat], zoom: 7.5, pitch: 0, bearing: 0,
      maxPitch: 80, attributionControl: false, antialias: true, fadeDuration: 250,
      maxZoom: 17,
    });
    v3d.gl = gl;
    gl.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    // pin marker
    const pin = document.createElement('div'); pin.className = 'v3d-pin'; pin.innerHTML = '<svg viewBox="0 0 44 58" width="34" height="44"><path d="M22 2C11 2 2 10.6 2 21.4 2 36 22 56 22 56s20-20 20-34.6C42 10.6 33 2 22 2z" fill="#ff4081"/><circle cx="22" cy="21" r="8.5" fill="#fff"/></svg>';
    v3d.marker = new maplibregl.Marker({ element: pin, anchor: 'bottom' }).setLngLat([ctx.lon, ctx.lat]).addTo(gl);

    gl.once('load', () => {
      $('v3dLoading').hidden = true;
      flyIn(ctx, mobile);
    });
    gl.on('error', (e) => { if (e && e.error && /terrain|dem/i.test(String(e.error.message))) console.warn(e.error); });
    // pause auto-orbit while the user drags; resume after
    gl.on('dragstart', () => stopOrbit());
    gl.on('dragend', () => { if (v3d.playing) orbit(); });
    gl.on('wheel', () => { stopOrbit(); if (v3d.playing) setTimeout(() => v3d.playing && orbit(), 1200); });
  }

  function flyIn(ctx, mobile) {
    const gl = v3d.gl; if (!gl) return;
    stopOrbit();
    gl.jumpTo({ center: [ctx.lon, ctx.lat], zoom: 7.5, pitch: 0, bearing: 0 });
    gl.flyTo({ center: [ctx.lon, ctx.lat], zoom: mobile ? 12.2 : 12.9, pitch: mobile ? 60 : 66, bearing: -25, duration: 5200, curve: 1.3, essential: true });
    gl.once('moveend', () => { v3d.playing = true; setPlayUI(); orbit(); });
  }

  function orbit() {
    const gl = v3d.gl; if (!gl || !v3d.playing) return;
    stopOrbit();
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(64, now - last); last = now;
      gl.setBearing(gl.getBearing() + dt * 0.0075 * v3d.speed);
      v3d.raf = requestAnimationFrame(tick);
    };
    v3d.raf = requestAnimationFrame(tick);
  }
  function stopOrbit() { if (v3d.raf) cancelAnimationFrame(v3d.raf); v3d.raf = 0; }
  function setPlayUI() {
    const b = $('v3dPlay'); b.textContent = v3d.playing ? '⏸ Pause' : '▶ Play'; b.setAttribute('aria-pressed', String(v3d.playing));
    $('view3d').classList.toggle('is-paused', !v3d.playing);
  }
  function close3D() {
    stopOrbit(); v3d.playing = false;
    const el = $('view3d'); el.classList.remove('is-open');
    delete document.body.dataset.overlay;
    setTimeout(() => { el.hidden = true; if (v3d.gl) { v3d.gl.remove(); v3d.gl = null; } if (v3d.fx) v3d.fx.setLayers([]); }, 350);
  }
  let last3DCtx = null;
  function wire3D() {
    $('v3dClose').addEventListener('click', close3D);
    $('v3dPlay').addEventListener('click', () => { v3d.playing = !v3d.playing; setPlayUI(); if (v3d.playing) orbit(); else stopOrbit(); });
    $('v3dReplay').addEventListener('click', () => { if (last3DCtx) flyIn(last3DCtx, window.innerWidth < 720); });
    $('v3dSpeed').addEventListener('input', (e) => { v3d.speed = +e.target.value; });
    $('v3dExag').addEventListener('input', (e) => { if (v3d.gl && v3d.gl.getTerrain()) v3d.gl.setTerrain({ source: 'dem', exaggeration: +e.target.value }); });
  }

  // ---- street-level view ------------------------------------------------------------------
  // Community road-level photos from KartaView (keyless API), shown as a slow "look around"
  // slideshow with the live weather pinned on top. Google Street View / Mapillary open in a tab.
  const sv = { photos: [], index: 0, timer: 0, playing: true, ctx: null };
  function openStreet(ctx) {
    sv.ctx = ctx;
    const el = $('streetView'); el.hidden = false; requestAnimationFrame(() => el.classList.add('is-open'));
    document.body.dataset.overlay = 'street';
    const { lat, lon } = ctx;
    $('svPlace').textContent = (ctx.place && ctx.place.name) || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    $('svMeta').textContent = 'Road-level photos near the pin' + (ctx.weatherLine ? ' · ' + ctx.weatherLine : '');
    $('svGoogle').href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
    $('svMapillary').href = `https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=17`;
    $('svKarta').href = `https://kartaview.org/map/@${lat},${lon},17z`;
    $('svFrame').innerHTML = '<div class="sv-empty"><span class="loader-cloud"><span></span><span></span><span></span></span>Looking for road photos…</div>';
    $('svStrip').hidden = true; $('svStrip').innerHTML = '';
    stopSlideshow(); sv.photos = []; sv.index = 0; sv.playing = true;
    loadPhotos(lat, lon);
  }
  async function loadPhotos(lat, lon) {
    const ctx = sv.ctx;
    try {
      let items = await kartaview(lat, lon, 500);
      if (!items.length) items = await kartaview(lat, lon, 3000);
      if (sv.ctx !== ctx) return;
      if (!items.length) return renderEmpty();
      // nearest first, at most 14, spread over different headings/sequences
      items.sort((a, b) => (+a.distance || 0) - (+b.distance || 0));
      sv.photos = items.slice(0, 14).map(p => ({
        big: p.imageLthUrl || p.imageProcUrl || p.fileurlLTh || p.fileurlProc,
        th: p.imageThUrl || p.fileurlTh,
        dist: Math.round(+p.distance || 0), heading: Math.round(+p.heading || 0),
        date: (p.shotDate || p.dateAdded || '').slice(0, 10), lat: +p.lat, lon: +p.lng,
      }));
      renderStrip(); showPhoto(0); startSlideshow();
    } catch (e) { if (sv.ctx === ctx) renderEmpty(); }
  }
  async function kartaview(lat, lon, radius) {
    const res = await fetch(`https://api.openstreetcam.org/2.0/photo/?lat=${lat}&lng=${lon}&radius=${radius}&itemsPerPage=40`);
    const data = await res.json();
    return ((data.result && data.result.data) || []).filter(p => p.imageThUrl || p.fileurlTh);
  }
  function renderEmpty() {
    $('svFrame').innerHTML = `<div class="sv-empty"><span class="sv-empty-ico">📷</span><strong>No community road photos here yet</strong><span>Open Google Street View for this exact spot, or drop the pin on a bigger road.</span></div>`;
  }
  function renderStrip() {
    const strip = $('svStrip');
    strip.innerHTML = '<div class="sv-strip-title">Road photos nearby · KartaView</div><div class="sv-photos">' + sv.photos.map((p, i) =>
      `<button type="button" class="sv-photo" data-i="${i}" title="${p.dist} m away, heading ${p.heading}°"><img src="${p.th}" alt="Road photo ${p.dist} m from the pin" loading="lazy" /><span style="transform:rotate(${p.heading}deg)">➤</span><small>${p.dist} m</small></button>`).join('') + '</div>';
    strip.hidden = false;
    strip.querySelectorAll('.sv-photo').forEach(b => b.addEventListener('click', () => { showPhoto(+b.dataset.i); restartSlideshow(); }));
  }
  function showPhoto(i) {
    if (!sv.photos.length) return;
    sv.index = (i + sv.photos.length) % sv.photos.length;
    const p = sv.photos[sv.index], ctx = sv.ctx;
    const frame = $('svFrame');
    const w = ctx.weatherLine ? `<div class="sv-weather">${ctx.weatherLine}</div>` : '';
    frame.innerHTML = `<img class="sv-big" src="${p.big}" alt="Road-level photo ${p.dist} m from the pin" />
      <div class="sv-compass" title="Camera heading"><span style="transform:rotate(${p.heading}deg)">➤</span></div>
      ${w}
      <div class="sv-caption">${p.dist} m from the pin${p.date ? ' · ' + p.date : ''} · ${sv.index + 1}/${sv.photos.length}</div>
      <button type="button" class="sv-nav prev" aria-label="Previous photo">‹</button>
      <button type="button" class="sv-nav next" aria-label="Next photo">›</button>
      <button type="button" class="sv-play" aria-label="Play or pause">${sv.playing ? '⏸' : '▶'}</button>`;
    frame.querySelector('.prev').addEventListener('click', () => { showPhoto(sv.index - 1); restartSlideshow(); });
    frame.querySelector('.next').addEventListener('click', () => { showPhoto(sv.index + 1); restartSlideshow(); });
    frame.querySelector('.sv-play').addEventListener('click', () => { sv.playing = !sv.playing; if (sv.playing) startSlideshow(); else stopSlideshow(); showPhoto(sv.index); });
    $('svStrip').querySelectorAll('.sv-photo').forEach((b, k) => b.classList.toggle('is-on', k === sv.index));
    const on = $('svStrip').querySelector('.sv-photo.is-on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
  function startSlideshow() { stopSlideshow(); if (sv.playing && sv.photos.length > 1) sv.timer = setInterval(() => showPhoto(sv.index + 1), 4200); }
  function stopSlideshow() { if (sv.timer) clearInterval(sv.timer); sv.timer = 0; }
  function restartSlideshow() { if (sv.playing) startSlideshow(); }
  function closeStreet() {
    const el = $('streetView'); el.classList.remove('is-open');
    delete document.body.dataset.overlay;
    stopSlideshow(); sv.ctx = null;
    setTimeout(() => { el.hidden = true; $('svFrame').innerHTML = ''; }, 300);
  }

  function init(opts) {
    wire3D();
    $('svClose').addEventListener('click', closeStreet);
    $('streetView').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeStreet(); });
    if (opts && opts.toast) toast = opts.toast;
  }

  global.Views = {
    initBase, setBase, setNight, getBase, init,
    open3D: (ctx) => { last3DCtx = ctx; open3D(ctx); }, close3D,
    openStreet, closeStreet,
    isOverlayOpen: () => !!document.body.dataset.overlay,
    closeOverlay: () => { if (document.body.dataset.overlay === '3d') close3D(); else if (document.body.dataset.overlay === 'street') closeStreet(); },
  };
})(window);
