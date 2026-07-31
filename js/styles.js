// Deterministic PRNG so a given seed always reproduces the same wallpaper.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const m = hex.replace("#", "");
  const bigint = parseInt(m, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function rgba(hex, a = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bl = Math.round(lerp(a.b, b.b, t));
  return `rgb(${r},${g},${bl})`;
}

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

function fillBackground(ctx, w, h, colors) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawStars(ctx, w, h, rng, count) {
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = rng() * h * 0.85;
    const r = rng() * (w * 0.0009) + w * 0.0002;
    const a = rng() * 0.7 + 0.3;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function softBlob(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Style renderers. Each receives (ctx, w, h, palette, rng) and a `scale`
// factor (w / 1920) is derived internally so visuals stay proportional
// whether rendering a small preview or the full 8K export.
// ---------------------------------------------------------------------------

const STYLES = [
  {
    id: "gradient-flow",
    label: "Abstract Gradient Flow",
    render(ctx, w, h, p, rng) {
      const s = w / 1920;
      fillBackground(ctx, w, h, [p.colors[0], p.colors[1], p.colors[2]]);
      ctx.globalCompositeOperation = "lighten";
      const blobs = 7;
      for (let i = 0; i < blobs; i++) {
        const c = pick(p.colors.slice(2), rng);
        softBlob(ctx, rng() * w, rng() * h, (220 + rng() * 320) * s, c, 0.55);
      }
      ctx.globalCompositeOperation = "source-over";
      if (p.stars) drawStars(ctx, w, h, rng, Math.floor(400 * s));
    },
  },
  {
    id: "geometric",
    label: "Geometric Shapes",
    render(ctx, w, h, p, rng) {
      const s = w / 1920;
      fillBackground(ctx, w, h, [p.colors[0], p.colors[1]]);
      const cell = 140 * s;
      for (let y = -cell; y < h + cell; y += cell) {
        for (let x = -cell; x < w + cell; x += cell) {
          const flip = rng() > 0.5;
          const c1 = pick(p.colors, rng);
          const c2 = pick(p.colors, rng);
          ctx.globalAlpha = 0.55 + rng() * 0.35;
          ctx.fillStyle = c1;
          ctx.beginPath();
          if (flip) {
            ctx.moveTo(x, y); ctx.lineTo(x + cell, y); ctx.lineTo(x, y + cell);
          } else {
            ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); ctx.lineTo(x, y + cell);
          }
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = c2;
          ctx.beginPath();
          if (flip) {
            ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); ctx.lineTo(x, y + cell);
          } else {
            ctx.moveTo(x, y); ctx.lineTo(x + cell, y); ctx.lineTo(x, y + cell);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: "minimalist",
    label: "Minimalist Gradient",
    render(ctx, w, h, p, rng) {
      const angle = rng() * Math.PI * 2;
      const x1 = w / 2 + Math.cos(angle) * w, y1 = h / 2 + Math.sin(angle) * h;
      const x2 = w / 2 - Math.cos(angle) * w, y2 = h / 2 - Math.sin(angle) * h;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, p.colors[0]);
      grad.addColorStop(1, p.colors[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // a single soft accent circle for quiet visual interest
      softBlob(ctx, w * (0.2 + rng() * 0.6), h * (0.2 + rng() * 0.6), w * 0.28, p.colors[4], 0.25);
    },
  },
  {
    id: "synthwave",
    label: "Synthwave Retro",
    render(ctx, w, h, p, rng) {
      const s = w / 1920;
      const horizon = h * 0.62;
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, p.colors[0]);
      sky.addColorStop(0.6, p.colors[1]);
      sky.addColorStop(1, p.colors[3]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon);

      // sun
      const sunR = h * 0.22;
      const sunX = w / 2, sunY = horizon - sunR * 0.35;
      const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
      sunGrad.addColorStop(0, p.colors[4]);
      sunGrad.addColorStop(1, p.colors[3]);
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.colors[0];
      for (let i = 0; i < 6; i++) {
        const stripeY = sunY + sunR * (0.15 + i * 0.13);
        if (stripeY > sunY + sunR) continue;
        ctx.fillRect(sunX - sunR, stripeY, sunR * 2, 6 * s * (i + 1));
      }

      // ground
      const ground = ctx.createLinearGradient(0, horizon, 0, h);
      ground.addColorStop(0, p.colors[1]);
      ground.addColorStop(1, p.colors[0]);
      ctx.fillStyle = ground;
      ctx.fillRect(0, horizon, w, h - horizon);

      ctx.strokeStyle = rgba(p.colors[4], 0.6);
      ctx.lineWidth = 2 * s;
      const vanishX = w / 2;
      for (let i = -12; i <= 12; i++) {
        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(vanishX + i * w * 0.09, h);
        ctx.stroke();
      }
      for (let j = 1; j <= 10; j++) {
        const t = j / 10;
        const y = lerp(horizon, h, t * t);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    },
  },
  {
    id: "nebula",
    label: "Nebula / Space Clouds",
    render(ctx, w, h, p, rng) {
      const s = w / 1920;
      fillBackground(ctx, w, h, [p.colors[0], p.colors[0]]);
      ctx.globalCompositeOperation = "screen";
      const layers = 5;
      for (let l = 0; l < layers; l++) {
        const cx = w * (0.2 + rng() * 0.6), cy = h * (0.2 + rng() * 0.6);
        const color = pick(p.colors.slice(1), rng);
        const clumps = 18;
        for (let i = 0; i < clumps; i++) {
          const ang = rng() * Math.PI * 2;
          const dist = rng() * w * 0.22;
          const x = cx + Math.cos(ang) * dist;
          const y = cy + Math.sin(ang) * dist * 0.6;
          softBlob(ctx, x, y, (120 + rng() * 260) * s, color, 0.18 + rng() * 0.15);
        }
      }
      ctx.globalCompositeOperation = "source-over";
      drawStars(ctx, w, h, rng, Math.floor(900 * s));
    },
  },
  {
    id: "lowpoly",
    label: "Low Poly Terrain",
    render(ctx, w, h, p, rng) {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, p.colors[0]);
      skyGrad.addColorStop(1, p.colors[2]);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      const ranges = 3;
      for (let r = 0; r < ranges; r++) {
        const baseY = h * (0.45 + r * 0.16);
        const amp = h * (0.16 - r * 0.03);
        const cols = 14 + r * 4;
        const step = w / cols;
        const pts = [];
        for (let i = 0; i <= cols; i++) {
          pts.push({ x: i * step, y: baseY - rng() * amp });
        }
        const shade = lerpColor(p.colors[1 + r] || p.colors[2], p.colors[4], r / ranges);
        for (let i = 0; i < cols; i++) {
          const a = pts[i], b = pts[i + 1];
          const midShade = rng() > 0.5 ? lerpColor(shade, "#000000", 0.12) : lerpColor(shade, "#ffffff", 0.06);
          ctx.fillStyle = midShade;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(b.x, h);
          ctx.lineTo(a.x, h);
          ctx.closePath();
          ctx.fill();
        }
      }
    },
  },
  {
    id: "fluid-waves",
    label: "Fluid Waves",
    render(ctx, w, h, p, rng) {
      fillBackground(ctx, w, h, [p.colors[0], p.colors[1]]);
      const bands = 6;
      for (let b = 0; b < bands; b++) {
        const t = b / (bands - 1);
        const baseY = h * (0.35 + t * 0.55);
        const amp = h * (0.05 + rng() * 0.07);
        const freq = 1 + rng() * 2;
        const phase = rng() * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, baseY);
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * w;
          const y = baseY + Math.sin((i / steps) * Math.PI * 2 * freq + phase) * amp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        const color = lerpColor(p.colors[1], p.colors[4], t);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: "particle-field",
    label: "Particle Field",
    render(ctx, w, h, p, rng) {
      const s = w / 1920;
      fillBackground(ctx, w, h, [p.colors[0], p.colors[1]]);
      const count = Math.floor(500 * s);
      const points = [];
      for (let i = 0; i < count; i++) {
        points.push({ x: rng() * w, y: rng() * h, r: (rng() * 6 + 2) * s, id: i });
      }
      ctx.strokeStyle = rgba(p.colors[3], 0.12);
      ctx.lineWidth = 1 * s;
      const linkDist = 220 * s;
      // Bucket points into a grid sized to linkDist so we only ever compare
      // a point against its immediate neighbours instead of every other point,
      // and batch every qualifying segment into a single path/stroke call.
      const cellSize = linkDist;
      const grid = new Map();
      const cellKey = (cx, cy) => cx * 100000 + cy;
      for (const pt of points) {
        const cx = Math.floor(pt.x / cellSize), cy = Math.floor(pt.y / cellSize);
        const key = cellKey(cx, cy);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(pt);
      }
      const linkDistSq = linkDist * linkDist;
      ctx.beginPath();
      for (const pt of points) {
        const cx = Math.floor(pt.x / cellSize), cy = Math.floor(pt.y / cellSize);
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const neighbours = grid.get(cellKey(cx + ox, cy + oy));
            if (!neighbours) continue;
            for (const other of neighbours) {
              if (other.id <= pt.id) continue; // draw each pair once
              const dx = pt.x - other.x, dy = pt.y - other.y;
              if (dx * dx + dy * dy < linkDistSq) {
                ctx.moveTo(pt.x, pt.y);
                ctx.lineTo(other.x, other.y);
              }
            }
          }
        }
      }
      ctx.stroke();
      ctx.globalCompositeOperation = "lighten";
      for (const pt of points) {
        const c = pick(p.colors.slice(2), rng);
        softBlob(ctx, pt.x, pt.y, pt.r * 6, c, 0.9);
      }
      ctx.globalCompositeOperation = "source-over";
    },
  },
  {
    id: "gradient-mesh",
    label: "Gradient Mesh Blobs",
    render(ctx, w, h, p, rng) {
      const s = w / 1920;
      fillBackground(ctx, w, h, [p.colors[0], p.colors[0]]);
      ctx.globalCompositeOperation = "lighten";
      const anchors = 6;
      for (let i = 0; i < anchors; i++) {
        const c = p.colors[(i % (p.colors.length - 1)) + 1];
        softBlob(ctx, rng() * w, rng() * h, (500 + rng() * 500) * s, c, 0.65);
      }
      ctx.globalCompositeOperation = "source-over";
    },
  },
  {
    id: "topographic",
    label: "Topographic Lines",
    render(ctx, w, h, p, rng) {
      const s = w / 1920;
      fillBackground(ctx, w, h, [p.colors[0], p.colors[1]]);
      const centers = 4;
      for (let c = 0; c < centers; c++) {
        const cx = rng() * w, cy = rng() * h;
        const rings = 10 + Math.floor(rng() * 6);
        const wobble = 30 * s + rng() * 40 * s;
        const color = pick(p.colors.slice(2), rng);
        for (let r = 1; r <= rings; r++) {
          const radius = r * (90 * s) + rng() * 20 * s;
          ctx.beginPath();
          const pts = 90;
          for (let i = 0; i <= pts; i++) {
            const ang = (i / pts) * Math.PI * 2;
            const noise = Math.sin(ang * 3 + r + c * 10) * wobble + Math.cos(ang * 5 - r) * wobble * 0.4;
            const x = cx + Math.cos(ang) * (radius + noise);
            const y = cy + Math.sin(ang) * (radius + noise);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = rgba(color, 0.35 + (r / rings) * 0.4);
          ctx.lineWidth = 2.2 * s;
          ctx.stroke();
        }
      }
    },
  },
];
