/* ==========================================================================
   Animated custom cursor: a lazy-following ring + dot, a bobbing pin while in
   drop-pin mode over the map, hover/press states and a weather-themed trail.
   Only active for fine pointers (mouse/trackpad); touch devices keep native.
   ========================================================================== */
(function (global) {
  'use strict';

  const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  const state = { x: -100, y: -100, rx: -100, ry: -100, trail: 't-cloud', pinMode: true, overMap: false, down: false, lastTrail: 0, moved: false };
  let el, dot, running = false;

  function init(cursorEl) {
    el = cursorEl;
    if (!fine) { el.remove(); return; }
    dot = el.querySelector('.cursor-dot');
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mousedown', () => { state.down = true; el.classList.add('is-down'); });
    document.addEventListener('mouseup', () => { state.down = false; el.classList.remove('is-down'); });
    document.addEventListener('mouseleave', () => el.classList.add('is-out'));
    document.addEventListener('mouseenter', () => el.classList.remove('is-out'));
    document.addEventListener('mouseover', onOver);
    running = true;
    requestAnimationFrame(tick);
  }

  function onMove(e) {
    state.x = e.clientX; state.y = e.clientY; state.moved = true;
    const now = performance.now();
    if (now - state.lastTrail > 55) { state.lastTrail = now; spawnTrail(e.clientX, e.clientY); }
  }

  function onOver(e) {
    const t = e.target;
    const clickable = t.closest('button, a, input, select, [role="option"], .leaflet-control-zoom a, .leaflet-marker-icon, .panel-close');
    const text = t.closest('input[type="text"], textarea');
    state.overMap = !!t.closest('#map') && !clickable;
    el.classList.toggle('is-hover', !!clickable && !text);
    el.classList.toggle('is-text', !!text);
    refreshPin();
  }

  function refreshPin() {
    el.classList.toggle('is-pin', state.pinMode && state.overMap);
  }

  function spawnTrail(x, y) {
    const t = document.createElement('div');
    t.className = 'cursor-trail ' + state.trail;
    const jitter = () => (Math.random() - 0.5) * 30;
    t.style.setProperty('--tx', jitter() + 'px');
    t.style.setProperty('--ty', (state.trail === 't-heat' || state.trail === 't-star' ? -20 : 20 + Math.random() * 20) + 'px');
    t.style.left = x + (Math.random() - 0.5) * 12 + 'px';
    t.style.top = y + (Math.random() - 0.5) * 12 + 'px';
    document.body.appendChild(t);
    t.addEventListener('animationend', () => t.remove());
    setTimeout(() => t.remove(), 900);
  }

  function tick() {
    if (!running) return;
    // ring lags behind the pointer, dot is snappy
    state.rx += (state.x - state.rx) * 0.22;
    state.ry += (state.y - state.ry) * 0.22;
    el.style.transform = `translate3d(${state.rx}px, ${state.ry}px, 0)`;
    // the dot sits exactly under the pointer; the ring catches up
    dot.style.transform = `translate3d(${state.x - state.rx}px, ${state.y - state.ry}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  }

  function setTrail(cls) { state.trail = cls || 't-cloud'; }
  function setPinMode(on) { state.pinMode = !!on; if (el && fine) refreshPin(); }

  global.Cursor = { init, setTrail, setPinMode };
})(window);
