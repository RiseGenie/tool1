/* ==========================================================================
   FX engine: layered motion graphics on a canvas.
   One instance runs full-screen over the map, another inside the stage and a
   third over the 3D view. Layers crossfade when the weather changes.
   Everything soft (glows, puffs, haze) is pre-rendered once into sprites so a
   frame is mostly cheap drawImage calls; "lite" mode halves the frame rate
   while the map itself is animating so zooms stay smooth.
   ========================================================================== */
(function (global) {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- sprite helpers -------------------------------------------------------------
  function sprite(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    draw(c.getContext('2d'), c.width, c.height);
    return c;
  }
  /** Soft radial glow: colour "r,g,b", full alpha at the centre fading to 0. */
  function glow(size, rgb, a, inner) {
    return sprite(size, size, (g, w, h) => {
      const r = w / 2, gr = g.createRadialGradient(r, r, r * (inner || 0), r, r, r);
      gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  }
  /** Cartoon cloud with a lit top and a shaded base, so it reads as a volume. */
  function cloudSprite(w, h, tint, shade) {
    return sprite(w, h, (g) => {
      const puffs = 6 + Math.floor(Math.random() * 4), baseY = h * 0.66;
      const puff = (px, py, r, col, a) => {
        const gr = g.createRadialGradient(px - r * 0.25, py - r * 0.3, r * 0.15, px, py, r);
        gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.55, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
      };
      // shaded base first
      for (let i = 0; i < puffs - 1; i++) puff(w * (0.18 + (i / (puffs - 1)) * 0.66), baseY + h * 0.03, h * 0.19, shade, 1);
      for (let i = 0; i < puffs; i++) {
        const t = (i + 0.5) / puffs, bump = Math.sin(t * Math.PI);
        const r = h * (0.16 + bump * 0.2 + Math.random() * 0.06);
        puff(w * (0.12 + t * 0.76), baseY - bump * h * 0.28 - Math.random() * h * 0.05, r, tint, 1);
      }
    });
  }

  // ---- layer factories -------------------------------------------------------------
  const L = {};

  L.clouds = (o) => ({
    init(w, h) {
      this.t = 0; this.items = [];
      const n = Math.max(3, Math.round((w / 300) * (o.density || 1)));
      for (let i = 0; i < n; i++) this.items.push(this.spawn(w, h, true));
      this.items.sort((a, b) => a.z - b.z);
    },
    spawn(w, h, anywhere) {
      const z = rand(0.45, 1);                       // depth: far clouds are smaller, slower, fainter
      const size = rand(o.minSize || 240, o.maxSize || 560) * (w < 600 ? 0.5 : 1) * (0.55 + z * 0.45);
      return {
        x: anywhere ? rand(-size, w) : -size, y: rand(-size * 0.2, h * (o.band || 0.55)),
        w: size, h: size * 0.5, v: rand(o.minSpeed || 8, o.maxSpeed || 22), z, ph: rand(0, TAU),
        s: cloudSprite(256, 128, o.tint || '255,255,255', o.shade || '214,224,240'),
      };
    },
    update(dt, w, h) {
      this.t += dt;
      for (let i = 0; i < this.items.length; i++) {
        const c = this.items[i]; c.x += c.v * c.z * dt;
        if (c.x > w + 40) { this.items[i] = this.spawn(w, h, false); this.items[i].z = c.z; }
      }
    },
    draw(g) {
      const base = o.alpha || 0.8;
      for (const c of this.items) {
        g.globalAlpha = base * (0.55 + c.z * 0.45);
        g.drawImage(c.s, c.x, c.y + Math.sin(this.t * 0.4 + c.ph) * 5, c.w, c.h);
      }
      g.globalAlpha = 1;
    },
  });

  L.rain = (o) => ({
    init(w, h) {
      this.far = []; this.near = []; this.splashes = []; this.t = 0;
      const n = Math.round((w * h) / (o.spacing || 4500));
      for (let i = 0; i < n; i++) this.far.push({ x: rand(0, w), y: rand(-h, h), l: rand(6, 12), v: rand((o.minSpeed || 550) * 0.6, (o.maxSpeed || 900) * 0.6), a: rand(0.12, 0.3) });
      for (let i = 0; i < n * 0.45; i++) this.near.push({ x: rand(0, w), y: rand(-h, h), l: rand(o.minLen || 14, o.maxLen || 26), v: rand(o.minSpeed || 550, o.maxSpeed || 900), a: rand(0.35, 0.75) });
      this.mist = glow(160, '220,232,250', 0.35);
    },
    update(dt, w, h) {
      this.t += dt;
      const wind = (o.wind || 60) * (1 + Math.sin(this.t * 0.6) * 0.25);
      const move = (d, splash) => {
        d.y += d.v * dt; d.x += wind * dt * (d.v / 700);
        if (d.y > h) {
          if (splash && o.splash !== false && Math.random() < 0.4) this.splashes.push({ x: d.x, y: h - rand(2, 14), t: 0 });
          d.y = rand(-60, -10); d.x = rand(-60, w);
        }
        if (d.x > w + 20) d.x = -10;
      };
      for (const d of this.far) move(d, false);
      for (const d of this.near) move(d, true);
      for (let i = this.splashes.length - 1; i >= 0; i--) { const s = this.splashes[i]; s.t += dt * 3.2; if (s.t > 1) this.splashes.splice(i, 1); }
    },
    draw(g, w, h) {
      const wind = o.wind || 60;
      g.lineCap = 'round';
      const pass = (arr, width, color) => {
        g.lineWidth = width; g.strokeStyle = color; g.beginPath();
        for (const d of arr) { const k = (wind / d.v) * d.l; g.moveTo(d.x, d.y); g.lineTo(d.x - k, d.y - d.l); }
        g.stroke();
      };
      g.globalAlpha = 0.5; pass(this.far, (o.width || 1.4) * 0.7, o.color || 'rgba(200,222,255,.9)');
      g.globalAlpha = 0.85; pass(this.near, o.width || 1.6, o.color || 'rgba(215,232,255,.95)');
      // ripples + bouncing droplets where drops land
      g.strokeStyle = 'rgba(230,240,255,.8)'; g.lineWidth = 1; g.fillStyle = 'rgba(235,244,255,.9)';
      for (const s of this.splashes) {
        g.globalAlpha = (1 - s.t) * 0.9;
        g.beginPath(); g.ellipse(s.x, s.y, 3 + s.t * 12, 1.2 + s.t * 3.5, 0, 0, TAU); g.stroke();
        const up = Math.sin(s.t * Math.PI) * 9;
        g.beginPath(); g.arc(s.x - 4 - s.t * 6, s.y - up, 1.1, 0, TAU); g.arc(s.x + 4 + s.t * 6, s.y - up * 0.8, 1.1, 0, TAU); g.fill();
      }
      // a low mist hugging the ground during heavier rain
      if (o.mist) { g.globalAlpha = 0.5; for (let x = -40; x < w + 80; x += 120) g.drawImage(this.mist, x + Math.sin(this.t + x) * 10, h - 90, 160, 160); }
      g.globalAlpha = 1;
    },
  });

  L.snow = (o) => ({
    init(w, h) {
      this.f = [];
      const n = Math.round((w * h) / (o.spacing || 8000));
      this.sp = [glow(16, '255,255,255', 1, 0.35), glow(28, '255,255,255', 0.95, 0.3), glow(48, '255,255,255', 0.8, 0.2)];
      for (let i = 0; i < n; i++) {
        const z = Math.random();                  // depth 0 far … 1 near
        this.f.push({ x: rand(0, w), y: rand(-h, h), z, r: 1.5 + z * 4.5, v: 22 + z * 55, ph: rand(0, TAU), sw: 8 + z * 26, rot: rand(0, TAU), rv: rand(-1, 1), crystal: z > 0.7 && Math.random() < 0.25 });
      }
    },
    update(dt, w, h) {
      for (const f of this.f) {
        f.ph += dt * (0.9 + f.z); f.y += f.v * dt; f.x += Math.sin(f.ph) * f.sw * dt + (o.wind || 8) * dt * (0.5 + f.z); f.rot += f.rv * dt;
        if (f.y > h + 10) { f.y = -10; f.x = rand(0, w); }
        if (f.x > w + 10) f.x = -10; else if (f.x < -10) f.x = w + 10;
      }
    },
    draw(g) {
      for (const f of this.f) {
        g.globalAlpha = 0.35 + f.z * 0.65;
        if (f.crystal) {
          g.save(); g.translate(f.x, f.y); g.rotate(f.rot); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.lineCap = 'round';
          g.beginPath(); for (let k = 0; k < 3; k++) { g.rotate(Math.PI / 3); g.moveTo(-f.r * 1.6, 0); g.lineTo(f.r * 1.6, 0); g.moveTo(f.r * 0.9, 0); g.lineTo(f.r * 1.2, -f.r * 0.4); g.moveTo(f.r * 0.9, 0); g.lineTo(f.r * 1.2, f.r * 0.4); }
          g.stroke(); g.restore();
        } else {
          const s = f.z < 0.35 ? this.sp[0] : f.z < 0.7 ? this.sp[1] : this.sp[2];
          const d = f.r * 3.2; g.drawImage(s, f.x - d / 2, f.y - d / 2, d, d);
        }
      }
      g.globalAlpha = 1;
    },
  });

  L.frost = () => ({
    init(w, h) {
      this.p = []; const n = Math.round((w * h) / 24000);
      this.star = sprite(24, 24, (g) => { g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 1.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(12, 1); g.lineTo(12, 23); g.moveTo(1, 12); g.lineTo(23, 12); g.moveTo(5, 5); g.lineTo(19, 19); g.moveTo(19, 5); g.lineTo(5, 19); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(12, 12, 2.2, 0, TAU); g.fill(); });
      for (let i = 0; i < n; i++) this.p.push({ x: rand(0, w), y: rand(0, h), t: rand(0, TAU), v: rand(5, 12), s: rand(8, 20), sp: rand(1.4, 3) });
    },
    update(dt, w, h) { for (const p of this.p) { p.t += dt * p.sp; p.y += p.v * dt; if (p.y > h) { p.y = -10; p.x = rand(0, w); } } },
    draw(g) {
      for (const p of this.p) {
        const a = Math.max(0, Math.sin(p.t)); if (a < 0.02) continue;
        g.globalAlpha = a; const s = p.s * (0.6 + a * 0.4);
        g.drawImage(this.star, p.x - s / 2, p.y - s / 2, s, s);
      }
      g.globalAlpha = 1;
    },
  });

  L.fog = () => ({
    init(w, h) {
      this.t = 0; this.bands = [];
      for (let i = 0; i < 6; i++) this.bands.push({ y: rand(-h * 0.1, h * 0.8), h: rand(h * 0.25, h * 0.55), x: rand(-w, 0), v: rand(5, 18), a: rand(0.2, 0.42), s: cloudSprite(512, 128, '245,247,250', '232,236,242'), w: rand(w * 1.3, w * 2.2), ph: rand(0, TAU) });
    },
    update(dt, w) { this.t += dt; for (const b of this.bands) { b.x += b.v * dt; if (b.x > w) b.x = -b.w; } },
    draw(g) {
      for (const b of this.bands) {
        const y = b.y + Math.sin(this.t * 0.3 + b.ph) * 12;
        g.globalAlpha = b.a; g.drawImage(b.s, b.x, y, b.w, b.h); g.drawImage(b.s, b.x - b.w, y, b.w, b.h);
      }
      g.globalAlpha = 1;
    },
  });

  L.lightning = () => ({
    init() { this.t = rand(1, 4); this.flash = 0; this.bolts = null; this.glow = glow(400, '255,250,220', 0.9); },
    strike(w, h) {
      const x = rand(w * 0.15, w * 0.85), pts = [[x, 0]]; let px = x, py = 0;
      const branches = [];
      while (py < h * rand(0.55, 0.9)) {
        py += rand(14, 36); px += rand(-26, 26); pts.push([px, py]);
        if (Math.random() < 0.18 && branches.length < 4) {
          const b = [[px, py]]; let bx = px, by = py; const dir = Math.random() < 0.5 ? -1 : 1;
          for (let k = 0; k < rand(3, 7); k++) { by += rand(10, 24); bx += dir * rand(6, 22); b.push([bx, by]); }
          branches.push(b);
        }
      }
      this.bolts = [pts].concat(branches); this.origin = [x, 0];
    },
    update(dt, w, h) {
      this.t -= dt;
      if (this.flash > 0) this.flash -= dt * 2.6;
      if (this.t <= 0) { this.t = rand(2.5, 7); this.flash = 1; this.strike(w, h); }
    },
    draw(g, w, h) {
      if (this.flash <= 0) return;
      // double flicker: two bright peaks inside one flash
      const f = this.flash, k = Math.max(0, Math.sin(f * Math.PI * 2.2)) * 0.6 + f * 0.4;
      g.fillStyle = `rgba(230,235,255,${k * 0.32})`; g.fillRect(0, 0, w, h);
      g.globalAlpha = k * 0.8; g.drawImage(this.glow, this.origin[0] - 200, -230, 400, 400);
      if (this.bolts && f > 0.3) {
        g.lineJoin = 'round'; g.lineCap = 'round';
        this.bolts.forEach((b, i) => {
          const main = i === 0;
          g.strokeStyle = `rgba(190,210,255,${k * 0.5})`; g.lineWidth = main ? 9 : 5; g.globalAlpha = 1;
          g.beginPath(); b.forEach((p, j) => j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
          g.strokeStyle = `rgba(255,255,240,${Math.min(1, k * 1.2)})`; g.lineWidth = main ? 2.4 : 1.4; g.stroke();
        });
      }
      g.globalAlpha = 1;
    },
  });

  L.wind = () => ({
    init(w, h) {
      this.s = []; this.dust = [];
      for (let i = 0; i < 14; i++) this.s.push(this.spawn(w, h, true));
      for (let i = 0; i < 40; i++) this.dust.push({ x: rand(0, w), y: rand(0, h), v: rand(200, 420), a: rand(0.2, 0.6), r: rand(0.8, 1.8) });
    },
    spawn(w, h, any) { return { x: any ? rand(0, w) : -260, y: rand(0, h), l: rand(90, 260), v: rand(240, 460), ph: rand(0, TAU), a: rand(0.35, 0.7), amp: rand(6, 16) }; },
    update(dt, w, h) {
      for (let i = 0; i < this.s.length; i++) { const s = this.s[i]; s.x += s.v * dt; s.ph += dt * 2; if (s.x > w + 260) this.s[i] = this.spawn(w, h, false); }
      for (const d of this.dust) { d.x += d.v * dt; d.y += Math.sin(d.x * 0.02) * 20 * dt; if (d.x > w + 5) { d.x = -5; d.y = rand(0, h); } }
    },
    draw(g) {
      g.lineCap = 'round';
      for (const s of this.s) {
        // tapered streak: transparent → bright → transparent along its length
        const lg = g.createLinearGradient(s.x, 0, s.x + s.l, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, `rgba(255,255,255,${s.a})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.strokeStyle = lg; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(s.x, s.y);
        g.bezierCurveTo(s.x + s.l * 0.33, s.y + Math.sin(s.ph) * s.amp, s.x + s.l * 0.66, s.y - Math.sin(s.ph) * s.amp, s.x + s.l, s.y);
        g.stroke();
      }
      g.fillStyle = '#fff';
      for (const d of this.dust) { g.globalAlpha = d.a; g.beginPath(); g.arc(d.x, d.y, d.r, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    },
  });

  function drifters(o) {
    // falling + tumbling shapes: petals, leaves
    return {
      init(w, h) { this.p = []; const n = Math.round((w * h) / (o.spacing || 30000)); for (let i = 0; i < n; i++) this.p.push(this.spawn(w, h, true)); },
      spawn(w, h, any) {
        return { x: rand(-40, w), y: any ? rand(0, h) : -20, r: rand(0, TAU), rv: rand(-2.5, 2.5), fl: rand(0, TAU), fv: rand(1.5, 4), v: rand(o.minV || 25, o.maxV || 60), wx: rand(o.minWx || 20, o.maxWx || 70), ph: rand(0, TAU), sz: rand(o.minSz || 5, o.maxSz || 10), c: pick(o.colors), z: rand(0.6, 1) };
      },
      update(dt, w, h) {
        for (let i = 0; i < this.p.length; i++) {
          const p = this.p[i];
          p.ph += dt * 1.6; p.fl += dt * p.fv; p.y += (p.v + Math.sin(p.ph) * 12) * dt * p.z; p.x += (p.wx + Math.cos(p.ph) * 34) * dt * p.z; p.r += p.rv * dt;
          if (p.y > h + 20 || p.x > w + 40) this.p[i] = this.spawn(w, h, false);
        }
      },
      draw(g) {
        for (const p of this.p) {
          const flip = Math.cos(p.fl);            // tumble: the shape flattens as it turns over
          g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(Math.max(0.12, Math.abs(flip)), 1);
          g.globalAlpha = 0.55 + p.z * 0.4; g.fillStyle = p.c;
          g.beginPath();
          if (o.shape === 'leaf') {
            g.moveTo(0, 0); g.quadraticCurveTo(-p.sz, -p.sz * 1.2, 0, -p.sz * 2.2); g.quadraticCurveTo(p.sz, -p.sz * 1.2, 0, 0); g.fill();
            g.strokeStyle = 'rgba(90,40,10,.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -p.sz * 2); g.stroke();
          } else {
            g.ellipse(0, 0, p.sz * 0.55, p.sz, 0, 0, TAU); g.fill();
            g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-p.sz * 0.15, -p.sz * 0.3, p.sz * 0.2, p.sz * 0.45, 0, 0, TAU); g.fill();
          }
          g.restore();
        }
        g.globalAlpha = 1;
      },
    };
  }
  L.petals = () => drifters({ colors: ['#f8bbd0', '#f48fb1', '#fce4ec', '#ffcdd2', '#f9a8d4'], shape: 'petal', spacing: 24000 });
  L.leaves = () => drifters({ colors: ['#ff7043', '#ffb300', '#e64a19', '#ffca28', '#8d6e63', '#d84315'], shape: 'leaf', spacing: 26000, minV: 30, maxV: 70, minWx: 40, maxWx: 120, minSz: 5, maxSz: 9 });

  L.sun = (o) => ({
    init(w, h) {
      this.t = 0; this.w = w; this.h = h;
      const r = this.r = Math.min(w, h) * 0.06 * (o.size || 1);
      this.glow = glow(r * 16, o.low ? '255,200,110' : '255,232,150', o.low ? 0.75 : 0.62, 0.02);
      this.rays = sprite(r * 8, r * 8, (g, W) => {
        const c = W / 2; g.translate(c, c);
        for (let i = 0; i < 12; i++) {
          g.rotate(TAU / 12); const len = c * (0.75 + (i % 2) * 0.22);
          const lg = g.createLinearGradient(0, 0, len, 0); lg.addColorStop(0, 'rgba(255,244,190,.5)'); lg.addColorStop(1, 'rgba(255,244,190,0)');
          g.fillStyle = lg; g.beginPath(); g.moveTo(r * 0.7, -r * 0.16); g.lineTo(len, -r * 0.7); g.lineTo(len, r * 0.7); g.lineTo(r * 0.7, r * 0.16); g.closePath(); g.fill();
        }
      });
      this.flare = [0.28, 0.42, 0.6, 0.78, 1.05].map((k, i) => ({ k, r: r * [0.35, 0.22, 0.5, 0.3, 0.8][i], s: glow(64, ['255,200,120', '255,140,160', '180,220,255', '255,230,150', '200,240,255'][i], 0.5) }));
    },
    update(dt) { this.t += dt; },
    draw(g, w, h) {
      const x = o.low ? w * 0.82 : w * 0.85, y = o.low ? h * 0.32 : h * 0.14, r = this.r;
      const pulse = 1 + Math.sin(this.t * 1.2) * 0.04;
      const gs = r * 16 * pulse; g.drawImage(this.glow, x - gs / 2, y - gs / 2, gs, gs);
      g.save(); g.translate(x, y);
      g.rotate(this.t * 0.12); g.globalAlpha = 0.9; g.drawImage(this.rays, -r * 4, -r * 4, r * 8, r * 8);
      g.rotate(-this.t * 0.31); g.globalAlpha = 0.55; g.drawImage(this.rays, -r * 3.4, -r * 3.4, r * 6.8, r * 6.8);
      g.restore(); g.globalAlpha = 1;
      // disc with a bright rim
      const dg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * pulse);
      dg.addColorStop(0, '#fffbe6'); dg.addColorStop(0.6, '#ffe082'); dg.addColorStop(1, '#ffca28');
      g.fillStyle = dg; g.beginPath(); g.arc(x, y, r * pulse, 0, TAU); g.fill();
      // lens flare ghosts along the sun → screen-centre axis
      const cx = w / 2, cy = h / 2, drift = Math.sin(this.t * 0.5) * 0.03;
      g.globalCompositeOperation = 'lighter';
      for (const f of this.flare) {
        const k = f.k + drift, fx = x + (cx - x) * k * 1.6, fy = y + (cy - y) * k * 1.6, d = f.r * 2 * (1 + Math.sin(this.t + f.k * 9) * 0.1);
        g.globalAlpha = 0.5; g.drawImage(f.s, fx - d, fy - d, d * 2, d * 2);
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    },
  });

  L.heat = () => ({
    // shimmering haze: soft columns of warm air rising and wobbling, plus wide slow
    // ripples near the horizon and a pulsing warm glow along the bottom edge
    init(w, h) {
      this.t = 0; this.cols = [];
      this.col = sprite(64, 220, (g, W, H) => { const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, 'rgba(255,238,200,0)'); lg.addColorStop(0.5, 'rgba(255,238,200,.55)'); lg.addColorStop(1, 'rgba(255,238,200,0)'); g.fillStyle = lg; g.beginPath(); g.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, TAU); g.fill(); });
      const n = Math.round(w / 70);
      for (let i = 0; i < n; i++) this.cols.push({ x: rand(0, w), y: rand(h * 0.3, h + 100), v: rand(18, 40), ph: rand(0, TAU), sw: rand(8, 22), a: rand(0.18, 0.4), sz: rand(0.8, 1.6) });
      this.bottom = sprite(4, 200, (g, W, H) => { const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, 'rgba(255,170,80,0)'); lg.addColorStop(1, 'rgba(255,170,80,.45)'); g.fillStyle = lg; g.fillRect(0, 0, W, H); });
    },
    update(dt, w, h) {
      this.t += dt;
      for (const c of this.cols) { c.y -= c.v * dt; c.ph += dt * 1.3; if (c.y < h * 0.15 - 120) { c.y = h + 120; c.x = rand(0, w); } }
    },
    draw(g, w, h) {
      g.globalAlpha = 0.7 + Math.sin(this.t * 1.5) * 0.2; g.drawImage(this.bottom, 0, h - 200, w, 200);
      for (const c of this.cols) {
        const cw = 64 * c.sz, ch = 220 * c.sz;
        g.globalAlpha = c.a * clamp((h - c.y) / (h * 0.6), 0.15, 1);
        g.drawImage(this.col, c.x + Math.sin(c.ph) * c.sw - cw / 2, c.y - ch / 2, cw, ch);
      }
      // wide horizontal ripples, long wavelength, barely there
      g.lineWidth = 7; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const y = h * (0.55 + i * 0.09) + Math.sin(this.t * 0.8 + i) * 6;
        g.strokeStyle = `rgba(255,236,200,${0.06 + i * 0.02})`; g.globalAlpha = 1; g.beginPath();
        for (let x = -20; x <= w + 20; x += 24) { const yy = y + Math.sin(x * 0.012 + this.t * 2.2 + i * 1.7) * 5; x <= -20 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
        g.stroke();
      }
      g.globalAlpha = 1;
    },
  });

  L.stars = () => ({
    init(w, h) {
      this.s = []; const n = Math.round((w * h) / 8000);
      this.big = sprite(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(16, 2); g.lineTo(16, 30); g.moveTo(2, 16); g.lineTo(30, 16); g.stroke(); });
      for (let i = 0; i < n; i++) this.s.push({ x: rand(0, w), y: rand(0, h * 0.85), r: rand(0.5, 1.8), ph: rand(0, TAU), sp: rand(0.6, 2.2), big: Math.random() < 0.08, tint: pick(['255,255,255', '255,255,255', '210,225,255', '255,240,210']) });
      this.shoot = null; this.t = rand(2, 6);
    },
    update(dt, w, h) {
      for (const s of this.s) s.ph += dt * s.sp;
      this.t -= dt;
      if (this.shoot) { this.shoot.x += this.shoot.vx * dt; this.shoot.y += this.shoot.vy * dt; this.shoot.life -= dt; if (this.shoot.life <= 0) this.shoot = null; }
      else if (this.t <= 0) { this.t = rand(4, 10); this.shoot = { x: rand(w * 0.2, w * 0.9), y: rand(0, h * 0.3), vx: -rand(500, 800), vy: rand(200, 350), life: 0.75 }; }
    },
    draw(g) {
      for (const s of this.s) {
        const a = 0.35 + (Math.sin(s.ph) + 1) * 0.32;
        if (s.big) { const d = 10 + a * 14; g.globalAlpha = a; g.drawImage(this.big, s.x - d / 2, s.y - d / 2, d, d); continue; }
        g.globalAlpha = a; g.fillStyle = `rgb(${s.tint})`; g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      if (this.shoot) {
        const sh = this.shoot, tx = sh.x - sh.vx * 0.18, ty = sh.y - sh.vy * 0.18;
        const lg = g.createLinearGradient(sh.x, sh.y, tx, ty); lg.addColorStop(0, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.strokeStyle = lg; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(tx, ty); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(sh.x, sh.y, 2, 0, TAU); g.fill();
      }
    },
  });

  L.moon = () => ({
    init(w, h) { this.t = 0; this.r = Math.min(w, h) * 0.05; this.glow = glow(this.r * 12, '255,250,210', 0.4, 0.05); },
    update(dt) { this.t += dt; },
    draw(g, w, h) {
      const x = w * 0.84, y = h * 0.16, r = this.r, gs = r * 12 * (1 + Math.sin(this.t) * 0.03);
      g.drawImage(this.glow, x - gs / 2, y - gs / 2, gs, gs);
      g.strokeStyle = 'rgba(255,250,210,.25)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r * 2.2, 0, TAU); g.stroke();
      const dg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); dg.addColorStop(0, '#fffdf0'); dg.addColorStop(1, '#f5ecc0');
      g.fillStyle = dg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(120,110,80,.12)';
      [[-0.3, -0.2, 0.22], [0.35, 0.3, 0.15], [0.1, -0.45, 0.1], [-0.45, 0.35, 0.12]].forEach(c => { g.beginPath(); g.arc(x + r * c[0], y + r * c[1], r * c[2], 0, TAU); g.fill(); });
    },
  });

  L.fireflies = () => ({
    init(w, h) { this.f = []; this.sp = glow(24, '255,241,118', 1, 0.2); for (let i = 0; i < 18; i++) this.f.push({ x: rand(0, w), y: rand(h * 0.4, h), ph: rand(0, TAU), vx: rand(-15, 15), vy: rand(-10, 10) }); },
    update(dt, w, h) { for (const f of this.f) { f.ph += dt * 2; f.x += f.vx * dt; f.y += f.vy * dt; if (Math.random() < 0.02) { f.vx = rand(-18, 18); f.vy = rand(-12, 12); } if (f.x < 0 || f.x > w) f.vx *= -1; if (f.y < h * 0.3 || f.y > h) f.vy *= -1; } },
    draw(g) { for (const f of this.f) { const a = Math.max(0, Math.sin(f.ph)); g.globalAlpha = a; const d = 8 + a * 14; g.drawImage(this.sp, f.x - d / 2, f.y - d / 2, d, d); } g.globalAlpha = 1; },
  });

  L.sparkles = () => ({
    init(w, h) { this.s = []; for (let i = 0; i < 14; i++) this.s.push({ x: rand(0, w), y: rand(0, h * 0.7), ph: rand(0, TAU), sz: rand(3, 8), rot: rand(0, TAU) }); },
    update(dt, w, h) { for (const s of this.s) { s.ph += dt * 2.4; s.rot += dt * 0.8; if (Math.random() < 0.01) { s.x = rand(0, w); s.y = rand(0, h * 0.7); } } },
    draw(g) {
      for (const s of this.s) {
        const a = Math.max(0, Math.sin(s.ph)); if (a <= 0) continue;
        g.save(); g.translate(s.x, s.y); g.rotate(s.rot); g.scale(a, a); g.globalAlpha = a; g.fillStyle = 'rgba(255,255,255,.95)';
        g.beginPath(); g.moveTo(0, -s.sz); g.quadraticCurveTo(0, 0, s.sz, 0); g.quadraticCurveTo(0, 0, 0, s.sz); g.quadraticCurveTo(0, 0, -s.sz, 0); g.quadraticCurveTo(0, 0, 0, -s.sz); g.fill(); g.restore();
      }
      g.globalAlpha = 1;
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
        g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(-3 * flap, -2, 1.2, 0, TAU); g.arc(3 * flap, -2, 1.2, 0, TAU); g.fill();
        g.fillStyle = '#4a148c'; g.fillRect(-0.7, -5, 1.4, 10);
        g.restore();
      }
    },
  });

  L.birds = () => ({
    // a small flock gliding across in loose formation
    init(w, h) { this.t = 0; this.flock = []; this.spawn(w, h, true); },
    spawn(w, h, any) {
      const n = 3 + Math.floor(Math.random() * 4), dir = Math.random() < 0.5 ? 1 : -1, y = rand(h * 0.08, h * 0.45), v = rand(70, 120);
      const x0 = any ? rand(0, w) : (dir > 0 ? -80 : w + 80);
      this.flock = []; for (let i = 0; i < n; i++) this.flock.push({ x: x0 - dir * i * 22, y: y + Math.abs(i - (n - 1) / 2) * 12, v: v * dir, ph: rand(0, TAU), s: rand(5, 8), dir });
    },
    update(dt, w, h) {
      this.t += dt; let off = 0;
      for (const b of this.flock) { b.x += b.v * dt; b.y += Math.sin(this.t * 0.7 + b.ph) * 6 * dt; b.ph += dt * 7; if (b.x < -120 || b.x > w + 120) off++; }
      if (off === this.flock.length) this.spawn(w, h, false);
    },
    draw(g) {
      g.strokeStyle = 'rgba(40,50,80,.7)'; g.lineWidth = 1.6; g.lineCap = 'round';
      for (const b of this.flock) {
        const f = Math.sin(b.ph) * b.s * 0.6;
        g.beginPath(); g.moveTo(b.x - b.s, b.y - f); g.quadraticCurveTo(b.x - b.s * 0.4, b.y + 1, b.x, b.y); g.quadraticCurveTo(b.x + b.s * 0.4, b.y + 1, b.x + b.s, b.y - f); g.stroke();
      }
    },
  });

  L.rainbow = () => ({
    init(w, h) { this.t = 0; },
    update(dt) { this.t += dt; },
    draw(g, w, h) {
      const cx = w * 0.55, cy = h * 1.05, r = Math.min(w, h) * 0.75, a = clamp(this.t * 0.4, 0, 0.32);
      const cols = ['255,80,80', '255,170,60', '255,235,80', '110,220,110', '80,180,255', '150,110,255'];
      g.lineWidth = r * 0.03;
      cols.forEach((c, i) => { g.strokeStyle = `rgba(${c},${a})`; g.beginPath(); g.arc(cx, cy, r - i * r * 0.03, Math.PI, TAU); g.stroke(); });
    },
  });

  // ---- named layer presets used by moods.js ------------------------------------------
  const PRESETS = {
    'clouds-soft':  () => L.clouds({ density: 0.7, alpha: 0.82, minSpeed: 6, maxSpeed: 16 }),
    'clouds-grey':  () => L.clouds({ density: 1.3, alpha: 0.88, tint: '200,210,226', shade: '150,162,186', minSpeed: 10, maxSpeed: 26, band: 0.45 }),
    'clouds-dark':  () => L.clouds({ density: 1.6, alpha: 0.92, tint: '96,104,132', shade: '58,64,90', minSpeed: 20, maxSpeed: 45, band: 0.5 }),
    'clouds-fast':  () => L.clouds({ density: 1.2, alpha: 0.85, minSpeed: 40, maxSpeed: 90, band: 0.5 }),
    'clouds-night': () => L.clouds({ density: 0.6, alpha: 0.35, tint: '170,180,220', shade: '110,120,170', minSpeed: 6, maxSpeed: 14 }),
    'rain':         () => L.rain({ mist: true }),
    'rain-heavy':   () => L.rain({ spacing: 2200, wind: 160, minSpeed: 800, maxSpeed: 1200, minLen: 16, maxLen: 30, mist: true }),
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
    'birds':        () => L.birds(),
    'rainbow':      () => L.rainbow(),
  };

  // ---- engine ---------------------------------------------------------------------
  class FXCanvas {
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.maxDpr = opts.maxDpr || 1.5;
      this.layers = [];      // active {name, layer, alpha, dir}
      this.w = 0; this.h = 0; this.dpr = 1;
      this.running = false; this.lite = false; this.skip = false;
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
      this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
      this.w = w; this.h = h;
      this.canvas.width = w * this.dpr; this.canvas.height = h * this.dpr;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      for (const l of this.layers) l.layer.init(w, h);
    }
    /** Lite mode: render every other frame (used while the map is zooming/panning). */
    setLite(on) { this.lite = !!on; }
    setLayers(names) {
      names = names || [];
      for (const l of this.layers) if (!names.includes(l.name)) l.dir = -1;
      for (const n of names) {
        const existing = this.layers.find(l => l.name === n);
        if (existing) { existing.dir = 1; continue; }
        const make = PRESETS[n]; if (!make) continue;
        const layer = make(); layer.init(this.w, this.h);
        this.layers.push({ name: n, layer, alpha: 0, dir: 1 });
      }
      this.layers.sort((a, b) => (names.indexOf(a.name) === -1 ? -1 : names.indexOf(a.name)) - (names.indexOf(b.name) === -1 ? -1 : names.indexOf(b.name)));
      this.start();
    }
    start() { if (this.running) return; this.running = true; this.last = performance.now(); requestAnimationFrame(this._frame); }
    stop() { this.running = false; }
    _frame(now) {
      if (!this.running) return;
      if (this.lite) { this.skip = !this.skip; if (this.skip) { requestAnimationFrame(this._frame); return; } }
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
  global.FXCanvas.PRESETS = PRESETS;
})(window);
