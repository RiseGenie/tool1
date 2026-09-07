/* ==========================================================================
   Animated custom cursor, drawn on its own canvas: a snappy glowing dot, a
   lagging "comet" ring that stretches along the direction of travel with a
   sweeping arc, a fading ribbon behind the pointer and weather-themed particles
   (drops, flakes, petals, leaves, sparks, stars, bolts, mist, warm air, cloud
   puffs). A DOM pin + label bob next to the pointer while in drop-pin mode.
   Only active for fine pointers (mouse/trackpad); touch devices keep native.
   ========================================================================== */
(function (global) {
  'use strict';

  const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  const TAU = Math.PI * 2, rand = (a, b) => a + Math.random() * (b - a);

  const S = {
    x: -100, y: -100, px: -100, py: -100, rx: -100, ry: -100, vx: 0, vy: 0,
    trail: 't-cloud', pinMode: true, overMap: false, hover: false, text: false, down: false, out: true,
    ring: 15, ringT: 15, alpha: 0, spin: 0, squash: 1, col: [255, 64, 129], colT: [255, 64, 129],
    ribbon: [], particles: [], lastSpawn: 0, t: 0,
  };
  let el, canvas, g, w = 0, h = 0, dpr = 1, running = false;

  const TRAILS = {
    't-drop':  { every: 40, col: '100,181,246', make: (p) => Object.assign(p, { kind: 'drop', vy: rand(120, 220), vx: rand(-20, 20), life: rand(0.5, 0.8), sz: rand(2, 3.4) }) },
    't-flake': { every: 45, col: '255,255,255', make: (p) => Object.assign(p, { kind: 'flake', vy: rand(30, 70), vx: rand(-30, 30), life: rand(0.9, 1.4), sz: rand(1.6, 3.2), ph: rand(0, TAU) }) },
    't-spark': { every: 30, col: '255,213,79', make: (p) => Object.assign(p, { kind: 'spark', vx: rand(-90, 90), vy: rand(-90, 90), life: rand(0.35, 0.7), sz: rand(1.2, 2.6) }) },
    't-petal': { every: 55, col: '248,165,194', make: (p) => Object.assign(p, { kind: 'petal', vx: rand(-25, 45), vy: rand(20, 60), life: rand(0.9, 1.4), sz: rand(2.5, 4.5), r: rand(0, TAU), rv: rand(-4, 4), c: ['#f8a5c2', '#f48fb1', '#fce4ec'][Math.floor(rand(0, 3))] }) },
    't-leaf':  { every: 60, col: '255,138,61', make: (p) => Object.assign(p, { kind: 'leaf', vx: rand(-20, 70), vy: rand(20, 70), life: rand(0.9, 1.4), sz: rand(2.5, 4.5), r: rand(0, TAU), rv: rand(-5, 5), c: ['#ff8a3d', '#ffb300', '#e64a19'][Math.floor(rand(0, 3))] }) },
    't-star':  { every: 50, col: '187,222,251', make: (p) => Object.assign(p, { kind: 'star', vx: rand(-20, 20), vy: rand(-40, -10), life: rand(0.7, 1.2), sz: rand(2, 4), ph: rand(0, TAU) }) },
    't-bolt':  { every: 45, col: '255,238,88', make: (p) => Object.assign(p, { kind: 'bolt', vx: rand(-30, 30), vy: rand(20, 60), life: rand(0.25, 0.5), sz: rand(6, 12) }) },
    't-mist':  { every: 60, col: '230,236,244', make: (p) => Object.assign(p, { kind: 'mist', vx: rand(-15, 15), vy: rand(-12, 6), life: rand(0.9, 1.5), sz: rand(6, 12) }) },
    't-heat':  { every: 40, col: '255,140,70', make: (p) => Object.assign(p, { kind: 'heat', vx: rand(-14, 14), vy: rand(-70, -30), life: rand(0.7, 1.2), sz: rand(3, 7), ph: rand(0, TAU) }) },
    't-cloud': { every: 55, col: '255,255,255', make: (p) => Object.assign(p, { kind: 'cloud', vx: rand(-20, 20), vy: rand(-8, 14), life: rand(0.7, 1.1), sz: rand(4, 8) }) },
  };
  const COLORS = { base: [255, 64, 129], hover: [68, 138, 255], text: [90, 107, 140] };

  function init(cursorEl) {
    el = cursorEl;
    if (!fine) { el.remove(); return; }
    canvas = document.createElement('canvas'); canvas.className = 'cursor-fx'; canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas); g = canvas.getContext('2d');
    resize(); window.addEventListener('resize', resize);
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mousedown', () => { S.down = true; el.classList.add('is-down'); });
    document.addEventListener('mouseup', () => { S.down = false; el.classList.remove('is-down'); });
    document.addEventListener('mouseleave', () => { S.out = true; el.classList.add('is-out'); });
    document.addEventListener('mouseenter', () => { S.out = false; el.classList.remove('is-out'); });
    document.addEventListener('mouseover', onOver);
    running = true; S.last = performance.now();
    requestAnimationFrame(tick);
  }
  function resize() {
    w = window.innerWidth; h = window.innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr; canvas.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function onMove(e) {
    if (S.x < 0) { S.rx = e.clientX; S.ry = e.clientY; }
    S.x = e.clientX; S.y = e.clientY; S.out = false; el.classList.remove('is-out');
    S.ribbon.push({ x: S.x, y: S.y, t: performance.now() });
    if (S.ribbon.length > 22) S.ribbon.shift();
    const now = performance.now(), tr = TRAILS[S.trail] || TRAILS['t-cloud'];
    if (now - S.lastSpawn > tr.every && S.particles.length < 60) {
      S.lastSpawn = now;
      S.particles.push(tr.make({ x: S.x + rand(-5, 5), y: S.y + rand(-5, 5), age: 0 }));
    }
  }

  function onOver(e) {
    const t = e.target;
    const clickable = t.closest('button, a, input, select, [role="option"], .leaflet-control-zoom a, .leaflet-marker-icon, .panel-close, .quick-btn, .view-btn, .wchip, .dir-steps li, .sv-photo');
    const text = t.closest('input[type="text"], textarea');
    S.overMap = !!t.closest('#map') && !clickable;
    S.hover = !!clickable && !text; S.text = !!text;
    el.classList.toggle('is-hover', S.hover);
    el.classList.toggle('is-text', S.text);
    refreshPin();
  }
  function refreshPin() { el.classList.toggle('is-pin', S.pinMode && S.overMap); }

  function tick(now) {
    if (!running) return;
    let dt = (now - (S.last || now)) / 1000; S.last = now; if (dt > 0.05) dt = 0.05; S.t += dt;

    // pointer velocity → ring lag, squash and spin speed
    S.vx = (S.x - S.px) / Math.max(dt, 0.001); S.vy = (S.y - S.py) / Math.max(dt, 0.001); S.px = S.x; S.py = S.y;
    const speed = Math.hypot(S.vx, S.vy);
    S.rx += (S.x - S.rx) * Math.min(1, dt * 14);
    S.ry += (S.y - S.ry) * Math.min(1, dt * 14);
    const pin = S.pinMode && S.overMap;
    S.ringT = S.hover ? 24 : S.text ? 9 : pin ? 11 : S.down ? 10 : 15;
    S.ring += (S.ringT - S.ring) * Math.min(1, dt * 10);
    S.squash += ((1 + Math.min(0.55, speed / 2600)) - S.squash) * Math.min(1, dt * 8);
    S.spin += dt * (1.6 + Math.min(6, speed / 400));
    S.colT = S.hover ? COLORS.hover : S.text ? COLORS.text : COLORS.base;
    for (let i = 0; i < 3; i++) S.col[i] += (S.colT[i] - S.col[i]) * Math.min(1, dt * 8);
    const targetA = S.out || S.x < 0 ? 0 : 1; S.alpha += (targetA - S.alpha) * Math.min(1, dt * 8);

    el.style.transform = `translate3d(${S.x}px, ${S.y}px, 0)`;

    g.clearRect(0, 0, w, h);
    if (S.alpha < 0.01 && !S.particles.length) { requestAnimationFrame(tick); return; }
    const rgb = S.col.map(Math.round).join(','), tr = TRAILS[S.trail] || TRAILS['t-cloud'];

    // ribbon: last positions, tapered, fading with age
    const rb = S.ribbon.filter(p => now - p.t < 380); S.ribbon = rb;
    if (rb.length > 2) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 1; i < rb.length; i++) {
        const k = i / rb.length, age = 1 - (now - rb[i].t) / 380;
        g.globalAlpha = S.alpha * age * 0.45 * k; g.lineWidth = 1 + k * 6; g.strokeStyle = `rgb(${tr.col})`;
        g.beginPath(); g.moveTo(rb[i - 1].x, rb[i - 1].y); g.lineTo(rb[i].x, rb[i].y); g.stroke();
      }
    }

    // particles
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i]; p.age += dt; if (p.age >= p.life) { S.particles.splice(i, 1); continue; }
      const k = p.age / p.life, a = (1 - k) * 0.95;
      p.x += p.vx * dt; p.y += p.vy * dt;
      switch (p.kind) {
        case 'drop': p.vy += 400 * dt; g.globalAlpha = a; g.strokeStyle = `rgb(${tr.col})`; g.lineWidth = p.sz; g.lineCap = 'round'; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.03); g.stroke(); break;
        case 'flake': p.ph += dt * 4; p.x += Math.sin(p.ph) * 18 * dt; g.globalAlpha = a; g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, p.sz, 0, TAU); g.fill(); break;
        case 'spark': p.vx *= 0.96; p.vy *= 0.96; g.globalAlpha = a; g.fillStyle = k < 0.4 ? '#fff' : `rgb(${tr.col})`; g.beginPath(); g.arc(p.x, p.y, p.sz * (1 - k * 0.6), 0, TAU); g.fill(); break;
        case 'petal': case 'leaf': {
          p.r += p.rv * dt; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(Math.max(0.15, Math.abs(Math.cos(p.age * 5))), 1); g.globalAlpha = a; g.fillStyle = p.c; g.beginPath();
          if (p.kind === 'leaf') { g.moveTo(0, 0); g.quadraticCurveTo(-p.sz, -p.sz * 1.2, 0, -p.sz * 2.2); g.quadraticCurveTo(p.sz, -p.sz * 1.2, 0, 0); } else g.ellipse(0, 0, p.sz * 0.55, p.sz, 0, 0, TAU);
          g.fill(); g.restore(); break;
        }
        case 'star': { p.ph += dt * 8; const s = p.sz * (0.6 + Math.abs(Math.sin(p.ph)) * 0.6); g.globalAlpha = a; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(p.x, p.y - s); g.quadraticCurveTo(p.x, p.y, p.x + s, p.y); g.quadraticCurveTo(p.x, p.y, p.x, p.y + s); g.quadraticCurveTo(p.x, p.y, p.x - s, p.y); g.quadraticCurveTo(p.x, p.y, p.x, p.y - s); g.fill(); break; }
        case 'bolt': g.globalAlpha = a; g.strokeStyle = '#fff59d'; g.lineWidth = 1.6; g.lineJoin = 'round'; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.sz * 0.35, p.y + p.sz * 0.45); g.lineTo(p.x + p.sz * 0.15, p.y + p.sz * 0.55); g.lineTo(p.x - p.sz * 0.2, p.y + p.sz); g.stroke(); break;
        case 'mist': case 'cloud': { const s = p.sz * (1 + k * 1.4); const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s); gr.addColorStop(0, `rgba(${tr.col},${a * 0.6})`); gr.addColorStop(1, `rgba(${tr.col},0)`); g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.fill(); break; }
        case 'heat': { p.ph += dt * 6; p.x += Math.sin(p.ph) * 22 * dt; const s = p.sz * (1 + k); const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s); gr.addColorStop(0, `rgba(255,190,90,${a * 0.55})`); gr.addColorStop(1, 'rgba(255,120,60,0)'); g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.fill(); break; }
      }
    }
    g.globalAlpha = 1;

    // comet ring: squashed along the velocity direction, with a sweeping bright arc
    const ang = Math.atan2(S.vy, S.vx);
    g.save(); g.translate(S.rx, S.ry); g.rotate(ang); g.scale(S.squash, 1 / Math.sqrt(S.squash)); g.rotate(-ang);
    g.globalAlpha = S.alpha * (S.text ? 0.5 : 0.9);
    g.strokeStyle = `rgba(${rgb},.55)`; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, S.ring, 0, TAU); g.stroke();
    if (S.hover) { g.fillStyle = `rgba(${rgb},.12)`; g.fill(); }
    g.strokeStyle = `rgb(${rgb})`; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, S.ring, S.spin, S.spin + (S.hover ? 2.2 : 1.1)); g.stroke();
    g.beginPath(); g.arc(0, 0, S.ring, S.spin + Math.PI, S.spin + Math.PI + 0.5); g.stroke();
    g.restore();

    // the dot: sits exactly under the pointer with a soft glow; becomes an I-beam over text, hides behind the pin
    if (!pin) {
      g.globalAlpha = S.alpha;
      const gr = g.createRadialGradient(S.x, S.y, 0, S.x, S.y, 12); gr.addColorStop(0, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(S.x, S.y, 12, 0, TAU); g.fill();
      g.fillStyle = `rgb(${rgb})`;
      if (S.text) { g.fillRect(S.x - 1, S.y - 9, 2, 18); } else { g.beginPath(); g.arc(S.x, S.y, S.hover ? 2.5 : S.down ? 5 : 3.5, 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;
    requestAnimationFrame(tick);
  }

  function setTrail(cls) { S.trail = cls || 't-cloud'; }
  function setPinMode(on) { S.pinMode = !!on; if (el && fine) refreshPin(); }

  global.Cursor = { init, setTrail, setPinMode };
})(window);
