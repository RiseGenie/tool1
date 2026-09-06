/* ==========================================================================
   FX engine: layered particle/motion graphics on a canvas.
   One instance runs full-screen over the map, another inside the stage.
   Layers are switched with crossfades so weather changes feel smooth.
   ========================================================================== */
(function (global) {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  // ---- cached sprites -------------------------------------------------------
  function makeCloudSprite(w, h, tint, alpha) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    // a flat-ish base plus a row of rounded puffs on top, like a cartoon cloud
    const puffs = 6 + Math.floor(Math.random() * 4);
    const baseY = h * 0.68;
    const draw = (px, py, r, a) => {
      const grad = g.createRadialGradient(px, py, r * 0.55, px, py, r);
      grad.addColorStop(0, `rgba(${tint},${a})`);
      grad.addColorStop(0.75, `rgba(${tint},${a * 0.8})`);
      grad.addColorStop(1, `rgba(${tint},0)`);
      g.fillStyle = grad;
      g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
    };
    for (let i = 0; i < puffs; i++) {
      const t = (i + 0.5) / puffs;
      const px = w * (0.12 + t * 0.76);
      const bump = Math.sin(t * Math.PI);
      const r = h * (0.16 + bump * 0.2 + Math.random() * 0.06);
      draw(px, baseY - bump * h * 0.28 - Math.random() * h * 0.05, r, 1);
    }
    for (let i = 0; i < puffs - 1; i++) {
      const px = w * (0.18 + (i / (puffs - 1)) * 0.66);
      draw(px, baseY + h * 0.02, h * 0.16, 1);
    }
    return c;
  }

  // ---- layer factories ------------------------------------------------------
  const L = {};

  L.clouds = (opts) => ({
    init(w, h) {
      this.items = [];
      const n = Math.max(3, Math.round((w / 300) * (opts.density || 1)));
      for (let i = 0; i < n; i++) this.items.push(this.spawn(w, h, true));
    },
    spawn(w, h, anywhere) {
      const size = rand(opts.minSize || 220, opts.maxSize || 520) * (w < 600 ? 0.45 : 1);
      return {
        x: anywhere ? rand(-size, w) : -size,
        y: rand(-size * 0.2, h * (opts.band || 0.55)),
        w: size, h: size * 0.5,
        v: rand(opts.minSpeed || 8, opts.maxSpeed || 22),
        s: makeCloudSprite(256, 128, opts.tint || '255,255,255', 1),
        z: rand(0.6, 1),
      };
    },
    update(dt, w, h) {
      for (let i = 0; i < this.items.length; i++) {
        const c = this.items[i];
        c.x += c.v * c.z * dt;
        if (c.x > w + 40) this.items[i] = this.spawn(w, h, false);
      }
    },
    draw(g) {
      // sprites are opaque; the layer's overall alpha is applied here so puffs don't stack
      g.globalAlpha *= (opts.alpha || 0.8);
      for (const c of this.items) g.drawImage(c.s, c.x, c.y, c.w, c.h);
    },
  });

  L.rain = (opts) => ({
    init(w, h) {
      this.drops = [];
      this.splashes = [];
      const n = Math.round((w * h) / (opts.spacing || 4500));
      for (let i = 0; i < n; i++) this.drops.push({ x: rand(0, w), y: rand(-h, h), l: rand(opts.minLen || 10, opts.maxLen || 22), v: rand(opts.minSpeed || 550, opts.maxSpeed || 900), a: rand(0.25, 0.7) });
    },
    update(dt, w, h) {
      const wind = opts.wind || 60;
      for (const d of this.drops) {
        d.y += d.v * dt; d.x += wind * dt;
        if (d.y > h) {
          if (opts.splash !== false && Math.random() < 0.35) this.splashes.push({ x: d.x, y: h - rand(0, 6), r: 1, t: 0 });
          d.y = rand(-40, -10); d.x = rand(-40, w);
        }
        if (d.x > w + 20) d.x = -10;
      }
      for (let i = this.splashes.length - 1; i >= 0; i--) {
        const s = this.splashes[i]; s.t += dt * 4;
        if (s.t > 1) this.splashes.splice(i, 1);
      }
    },
    draw(g, w, h) {
      const wind = opts.wind || 60;
      g.lineWidth = opts.width || 1.4;
      g.lineCap = 'round';
      g.strokeStyle = opts.color || 'rgba(190,215,255,.9)';
      g.beginPath();
      for (const d of this.drops) {
        g.globalAlpha = d.a;
        g.moveTo(d.x, d.y);
        g.lineTo(d.x - (wind / d.v) * d.l, d.y - d.l);
      }
      g.stroke();
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(220,235,255,.7)';
      g.lineWidth = 1;
      for (const s of this.splashes) {
        g.globalAlpha = 1 - s.t;
        g.beginPath(); g.ellipse(s.x, s.y, 3 + s.t * 10, 1.5 + s.t * 3, 0, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
    },
  });

  L.snow = (opts) => ({
    init(w, h) {
      this.flakes = [];
      const n = Math.round((w * h) / (opts.spacing || 9000));
      for (let i = 0; i < n; i++) this.flakes.push({ x: rand(0, w), y: rand(-h, h), r: rand(1.2, 4.2), v: rand(28, 70), ph: rand(0, TAU), sw: rand(12, 30), a: rand(0.5, 1) });
    },
    update(dt, w, h) {
      for (const f of this.flakes) {
        f.ph += dt * 1.4; f.y += f.v * dt; f.x += Math.sin(f.ph) * f.sw * dt + (opts.wind || 6) * dt;
        if (f.y > h + 6) { f.y = -6; f.x = rand(0, w); }
        if (f.x > w + 6) f.x = -6; if (f.x < -6) f.x = w + 6;
      }
    },
    draw(g) {
      g.fillStyle = '#fff';
      for (const f of this.flakes) {
        g.globalAlpha = f.a; g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    },
  });

  L.frost = () => ({
    // sparse glittering ice crystals, for cold-but-dry weather
    init(w, h) {
      this.p = [];
      const n = Math.round((w * h) / 26000);
      for (let i = 0; i < n; i++) this.p.push({ x: rand(0, w), y: rand(0, h), t: rand(0, TAU), v: rand(6, 14), r: rand(1, 2.4) });
    },
    update(dt, w, h) { for (const p of this.p) { p.t += dt * 2.2; p.y += p.v * dt; if (p.y > h) { p.y = -4; p.x = rand(0, w); } } },
    draw(g) {
      for (const p of this.p) {
        const a = (Math.sin(p.t) + 1) / 2;
        g.globalAlpha = a * 0.9; g.fillStyle = '#fff';
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(p.x - p.r * 3, p.y); g.lineTo(p.x + p.r * 3, p.y); g.moveTo(p.x, p.y - p.r * 3); g.lineTo(p.x, p.y + p.r * 3); g.stroke();
      }
      g.globalAlpha = 1;
    },
  });

  L.fog = () => ({
    init(w, h) {
      this.bands = [];
      for (let i = 0; i < 6; i++) this.bands.push({ y: rand(0, h), h: rand(h * 0.2, h * 0.5), x: rand(-w, 0), v: rand(6, 20), a: rand(0.18, 0.4), s: makeCloudSprite(512, 128, '245,247,250', 0.9), w: rand(w * 1.2, w * 2) });
    },
    update(dt, w) { for (const b of this.bands) { b.x += b.v * dt; if (b.x > w) b.x = -b.w; } },
    draw(g, w, h) {
      for (const b of this.bands) {
        g.globalAlpha = b.a;
        g.drawImage(b.s, b.x, b.y, b.w, b.h);
        g.drawImage(b.s, b.x - b.w, b.y, b.w, b.h);
      }
      g.globalAlpha = 1;
    },
  });

  L.lightning = () => ({
    init() { this.t = rand(1, 4); this.flash = 0; this.bolt = null; },
    update(dt, w, h) {
      this.t -= dt;
      if (this.flash > 0) this.flash -= dt * 3;
      if (this.t <= 0) {
        this.t = rand(2.5, 7); this.flash = 1;
        const x = rand(w * 0.15, w * 0.85); const pts = [[x, 0]];
        let px = x, py = 0;
        while (py < h * rand(0.5, 0.85)) { py += rand(15, 40); px += rand(-28, 28); pts.push([px, py]); }
        this.bolt = pts;
      }
    },
    draw(g, w, h) {
      if (this.flash <= 0) return;
      g.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`;
      g.fillRect(0, 0, w, h);
      if (this.bolt && this.flash > 0.35) {
        g.strokeStyle = `rgba(255,255,220,${this.flash})`; g.lineWidth = 3; g.lineJoin = 'round';
        g.shadowColor = '#fff59d'; g.shadowBlur = 24;
        g.beginPath(); this.bolt.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
        g.shadowBlur = 0;
      }
    },
  });

  L.wind = () => ({
    init(w, h) {
      this.s = [];
      for (let i = 0; i < 14; i++) this.s.push(this.spawn(w, h, true));
    },
    spawn(w, h, any) { return { x: any ? rand(0, w) : -200, y: rand(0, h), l: rand(60, 200), v: rand(260, 480), ph: rand(0, TAU), a: rand(0.2, 0.5) }; },
    update(dt, w, h) { for (let i = 0; i < this.s.length; i++) { const s = this.s[i]; s.x += s.v * dt; s.ph += dt * 2; if (s.x > w + 200) this.s[i] = this.spawn(w, h, false); } },
    draw(g) {
      g.lineCap = 'round'; g.lineWidth = 2;
      for (const s of this.s) {
        g.strokeStyle = `rgba(255,255,255,${s.a})`;
        g.beginPath();
        g.moveTo(s.x, s.y);
        g.bezierCurveTo(s.x + s.l * 0.33, s.y + Math.sin(s.ph) * 12, s.x + s.l * 0.66, s.y - Math.sin(s.ph) * 12, s.x + s.l, s.y);
        g.stroke();
      }
    },
  });

  function drifters(opts) {
    // falling + drifting shapes: petals, leaves
    return {
      init(w, h) {
        this.p = [];
        const n = Math.round((w * h) / (opts.spacing || 30000));
        for (let i = 0; i < n; i++) this.p.push(this.spawn(w, h, true));
      },
      spawn(w, h, any) {
        return { x: rand(-40, w), y: any ? rand(0, h) : -20, r: rand(0, TAU), rv: rand(-3, 3), v: rand(opts.minV || 25, opts.maxV || 60), wx: rand(opts.minWx || 20, opts.maxWx || 70), ph: rand(0, TAU), sz: rand(opts.minSz || 5, opts.maxSz || 10), c: opts.colors[Math.floor(Math.random() * opts.colors.length)] };
      },
      update(dt, w, h) {
        for (let i = 0; i < this.p.length; i++) {
          const p = this.p[i];
          p.ph += dt * 1.6; p.y += (p.v + Math.sin(p.ph) * 10) * dt; p.x += (p.wx + Math.cos(p.ph) * 30) * dt; p.r += p.rv * dt;
          if (p.y > h + 20 || p.x > w + 40) this.p[i] = this.spawn(w, h, false);
        }
      },
      draw(g) {
        for (const p of this.p) {
          g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.globalAlpha = 0.9;
          g.beginPath();
          if (opts.shape === 'leaf') {
            g.moveTo(0, 0); g.quadraticCurveTo(-p.sz, -p.sz * 1.2, 0, -p.sz * 2.2); g.quadraticCurveTo(p.sz, -p.sz * 1.2, 0, 0);
          } else {
            g.ellipse(0, 0, p.sz * 0.55, p.sz, 0, 0, TAU);
          }
          g.fill(); g.restore();
        }
        g.globalAlpha = 1;
      },
    };
  }
  L.petals = () => drifters({ colors: ['#f8bbd0', '#f48fb1', '#fce4ec', '#ffcdd2'], shape: 'petal', spacing: 26000 });
  L.leaves = () => drifters({ colors: ['#ff7043', '#ffb300', '#e64a19', '#ffca28', '#8d6e63'], shape: 'leaf', spacing: 28000, minV: 30, maxV: 70, minWx: 40, maxWx: 120, minSz: 5, maxSz: 9 });

  L.sun = (opts) => ({
    init(w, h) { this.t = 0; },
    update(dt) { this.t += dt; },
    draw(g, w, h) {
      const big = opts.size || 1;
      const x = opts.low ? w * 0.82 : w * 0.85, y = opts.low ? h * 0.32 : h * 0.14;
      const r = Math.min(w, h) * 0.06 * big;
      const pulse = 1 + Math.sin(this.t * 1.2) * 0.04;
      const grad = g.createRadialGradient(x, y, r * 0.2, x, y, r * 7 * pulse);
      grad.addColorStop(0, `rgba(255,236,150,${opts.low ? 0.8 : 0.7})`);
      grad.addColorStop(0.25, 'rgba(255,220,120,.35)');
      grad.addColorStop(1, 'rgba(255,200,80,0)');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      // rays
      g.save(); g.translate(x, y); g.rotate(this.t * 0.15);
      for (let i = 0; i < 12; i++) {
        g.rotate(TAU / 12);
        const len = r * (3.2 + Math.sin(this.t * 2 + i) * 0.6);
        const rg = g.createLinearGradient(0, 0, len, 0);
        rg.addColorStop(0, 'rgba(255,240,180,.35)'); rg.addColorStop(1, 'rgba(255,240,180,0)');
        g.fillStyle = rg;
        g.beginPath(); g.moveTo(r * 0.8, -r * 0.18); g.lineTo(len, -r * 0.5); g.lineTo(len, r * 0.5); g.lineTo(r * 0.8, r * 0.18); g.closePath(); g.fill();
      }
      g.restore();
      g.fillStyle = '#ffe082'; g.beginPath(); g.arc(x, y, r * pulse, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.4, 0, TAU); g.fill();
    },
  });

  L.heat = () => ({
    init(w, h) { this.t = 0; this.lines = []; for (let i = 0; i < 18; i++) this.lines.push({ x: rand(0, w), y: rand(h * 0.4, h), ph: rand(0, TAU), v: rand(20, 45), a: rand(0.1, 0.3) }); },
    update(dt, w, h) { this.t += dt; for (const l of this.lines) { l.y -= l.v * dt; l.ph += dt * 3; if (l.y < h * 0.2) { l.y = h + 10; l.x = rand(0, w); } } },
    draw(g, w, h) {
      g.lineWidth = 2; g.lineCap = 'round';
      for (const l of this.lines) {
        g.strokeStyle = `rgba(255,255,255,${l.a})`;
        g.beginPath();
        for (let i = 0; i <= 8; i++) { const yy = l.y + i * 5, xx = l.x + Math.sin(l.ph + i * 0.8) * 5; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
        g.stroke();
      }
    },
  });

  L.stars = () => ({
    init(w, h) { this.s = []; const n = Math.round((w * h) / 9000); for (let i = 0; i < n; i++) this.s.push({ x: rand(0, w), y: rand(0, h * 0.85), r: rand(0.5, 1.8), ph: rand(0, TAU), sp: rand(0.6, 2.2) }); this.shoot = null; this.t = rand(2, 6); },
    update(dt, w, h) {
      for (const s of this.s) s.ph += dt * s.sp;
      this.t -= dt;
      if (this.shoot) { this.shoot.x += this.shoot.vx * dt; this.shoot.y += this.shoot.vy * dt; this.shoot.life -= dt; if (this.shoot.life <= 0) this.shoot = null; }
      else if (this.t <= 0) { this.t = rand(4, 10); this.shoot = { x: rand(w * 0.2, w * 0.9), y: rand(0, h * 0.3), vx: -rand(500, 800), vy: rand(200, 350), life: 0.7 }; }
    },
    draw(g) {
      g.fillStyle = '#fff';
      for (const s of this.s) { g.globalAlpha = 0.35 + (Math.sin(s.ph) + 1) * 0.32; g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      if (this.shoot) {
        const sh = this.shoot; const lg = g.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 0.15, sh.y - sh.vy * 0.15);
        lg.addColorStop(0, 'rgba(255,255,255,.95)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.strokeStyle = lg; g.lineWidth = 2; g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(sh.x - sh.vx * 0.15, sh.y - sh.vy * 0.15); g.stroke();
      }
    },
  });

  L.moon = () => ({
    init() { this.t = 0; },
    update(dt) { this.t += dt; },
    draw(g, w, h) {
      const x = w * 0.84, y = h * 0.16, r = Math.min(w, h) * 0.05;
      const grad = g.createRadialGradient(x, y, r, x, y, r * 6);
      grad.addColorStop(0, 'rgba(255,250,210,.35)'); grad.addColorStop(1, 'rgba(255,250,210,0)');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff8d6'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(0,0,0,.06)';
      g.beginPath(); g.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, TAU); g.fill();
      g.beginPath(); g.arc(x + r * 0.35, y + r * 0.3, r * 0.15, 0, TAU); g.fill();
    },
  });

  L.fireflies = () => ({
    init(w, h) { this.f = []; for (let i = 0; i < 16; i++) this.f.push({ x: rand(0, w), y: rand(h * 0.4, h), ph: rand(0, TAU), vx: rand(-15, 15), vy: rand(-10, 10) }); },
    update(dt, w, h) { for (const f of this.f) { f.ph += dt * 2; f.x += f.vx * dt; f.y += f.vy * dt; if (Math.random() < 0.02) { f.vx = rand(-18, 18); f.vy = rand(-12, 12); } if (f.x < 0 || f.x > w) f.vx *= -1; if (f.y < h * 0.3 || f.y > h) f.vy *= -1; } },
    draw(g) { for (const f of this.f) { const a = (Math.sin(f.ph) + 1) / 2; g.fillStyle = `rgba(255,241,118,${a})`; g.shadowColor = '#fff176'; g.shadowBlur = 10 * a; g.beginPath(); g.arc(f.x, f.y, 2, 0, TAU); g.fill(); } g.shadowBlur = 0; },
  });

  L.sparkles = () => ({
    init(w, h) { this.s = []; for (let i = 0; i < 14; i++) this.s.push({ x: rand(0, w), y: rand(0, h * 0.7), ph: rand(0, TAU), sz: rand(3, 7) }); },
    update(dt, w, h) { for (const s of this.s) { s.ph += dt * 2.4; if (Math.random() < 0.01) { s.x = rand(0, w); s.y = rand(0, h * 0.7); } } },
    draw(g) {
      for (const s of this.s) {
        const a = Math.max(0, Math.sin(s.ph)); if (a <= 0) continue;
        g.save(); g.translate(s.x, s.y); g.scale(a, a); g.fillStyle = 'rgba(255,255,255,.95)';
        g.beginPath(); g.moveTo(0, -s.sz); g.quadraticCurveTo(0, 0, s.sz, 0); g.quadraticCurveTo(0, 0, 0, s.sz); g.quadraticCurveTo(0, 0, -s.sz, 0); g.quadraticCurveTo(0, 0, 0, -s.sz); g.fill(); g.restore();
      }
    },
  });

  L.butterflies = () => ({
    init(w, h) { this.b = []; for (let i = 0; i < 4; i++) this.b.push({ x: rand(0, w), y: rand(h * 0.2, h * 0.7), ph: rand(0, TAU), t: rand(0, 100), c: ['#ba68c8', '#4fc3f7', '#ffb74d', '#f06292'][i % 4] }); },
    update(dt, w, h) { for (const b of this.b) { b.ph += dt * 14; b.t += dt; b.x += Math.cos(b.t * 0.7) * 40 * dt; b.y += Math.sin(b.t * 1.3) * 25 * dt; if (b.x < -10) b.x = w + 10; if (b.x > w + 10) b.x = -10; } },
    draw(g) {
      for (const b of this.b) {
        const flap = Math.abs(Math.sin(b.ph)) * 0.8 + 0.2;
        g.save(); g.translate(b.x, b.y); g.fillStyle = b.c;
        g.beginPath(); g.ellipse(-4 * flap, -1, 4 * flap, 5, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(4 * flap, -1, 4 * flap, 5, 0, 0, TAU); g.fill();
        g.fillStyle = '#4a148c'; g.fillRect(-0.7, -5, 1.4, 10);
        g.restore();
      }
    },
  });

  // ---- named layer presets used by moods.js ----------------------------------
  const PRESETS = {
    'clouds-soft':  () => L.clouds({ density: 0.7, alpha: 0.78, minSpeed: 6, maxSpeed: 16 }),
    'clouds-grey':  () => L.clouds({ density: 1.3, alpha: 0.85, tint: '196,206,222', minSpeed: 10, maxSpeed: 26, band: 0.45 }),
    'clouds-dark':  () => L.clouds({ density: 1.6, alpha: 0.9, tint: '90,98,125', minSpeed: 20, maxSpeed: 45, band: 0.5 }),
    'clouds-fast':  () => L.clouds({ density: 1.2, alpha: 0.85, minSpeed: 40, maxSpeed: 90, band: 0.5 }),
    'clouds-night': () => L.clouds({ density: 0.6, alpha: 0.35, tint: '170,180,220', minSpeed: 6, maxSpeed: 14 }),
    'rain':         () => L.rain({}),
    'rain-heavy':   () => L.rain({ spacing: 2200, wind: 160, minSpeed: 800, maxSpeed: 1200, minLen: 16, maxLen: 30 }),
    'drizzle':      () => L.rain({ spacing: 9000, wind: 20, minSpeed: 300, maxSpeed: 480, minLen: 6, maxLen: 10, width: 1, splash: false }),
    'snow':         () => L.snow({}),
    'frost':        () => L.frost(),
    'fog':          () => L.fog(),
    'lightning':    () => L.lightning(),
    'wind':         () => L.wind(),
    'leaves':       () => L.leaves(),
    'petals':       () => L.petals(),
    'sun':          () => L.sun({}),
    'sun-big':      () => L.sun({ size: 1.5 }),
    'sun-low':      () => L.sun({ size: 1.2, low: true }),
    'heat':         () => L.heat(),
    'stars':        () => L.stars(),
    'moon':         () => L.moon(),
    'fireflies':    () => L.fireflies(),
    'sparkles':     () => L.sparkles(),
    'butterflies':  () => L.butterflies(),
  };

  // ---- engine -------------------------------------------------------------
  class FXCanvas {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.layers = [];      // active {name, layer, alpha, dir}
      this.w = 0; this.h = 0; this.dpr = 1;
      this.running = false;
      this.last = 0;
      this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this._frame = this._frame.bind(this);
      this.resize();
      window.addEventListener('resize', () => this.resize());
      if ('ResizeObserver' in window) new ResizeObserver(() => this.resize()).observe(canvas);
    }
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
      if (w === this.w && h === this.h) return;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = w; this.h = h;
      this.canvas.width = w * this.dpr; this.canvas.height = h * this.dpr;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      for (const l of this.layers) l.layer.init(w, h);
    }
    setLayers(names) {
      names = names || [];
      // fade out layers no longer wanted
      for (const l of this.layers) if (!names.includes(l.name)) l.dir = -1;
      // add new ones
      for (const n of names) {
        const existing = this.layers.find(l => l.name === n);
        if (existing) { existing.dir = 1; continue; }
        const make = PRESETS[n]; if (!make) continue;
        const layer = make(); layer.init(this.w, this.h);
        this.layers.push({ name: n, layer, alpha: 0, dir: 1 });
      }
      // keep draw order = requested order (fading-out ones go first/behind)
      this.layers.sort((a, b) => (names.indexOf(a.name) === -1 ? -1 : names.indexOf(a.name)) - (names.indexOf(b.name) === -1 ? -1 : names.indexOf(b.name)));
      this.start();
    }
    start() { if (this.running) return; this.running = true; this.last = performance.now(); requestAnimationFrame(this._frame); }
    stop() { this.running = false; }
    _frame(now) {
      if (!this.running) return;
      let dt = (now - this.last) / 1000; this.last = now;
      if (dt > 0.1) dt = 0.1;
      if (this.reduced) dt *= 0.25;
      const g = this.ctx, w = this.w, h = this.h;
      g.clearRect(0, 0, w, h);
      for (let i = this.layers.length - 1; i >= 0; i--) {
        const l = this.layers[i];
        l.alpha += l.dir * dt * 0.9;
        if (l.alpha <= 0 && l.dir < 0) { this.layers.splice(i, 1); continue; }
        if (l.alpha > 1) l.alpha = 1;
      }
      for (const l of this.layers) {
        l.layer.update(dt, w, h);
        g.save(); g.globalAlpha = l.alpha; l.layer.draw(g, w, h); g.restore();
      }
      if (this.layers.length === 0) { this.running = false; return; }
      requestAnimationFrame(this._frame);
    }
  }

  global.FXCanvas = FXCanvas;
})(window);
