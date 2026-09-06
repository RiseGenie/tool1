/* ==========================================================================
   Characters: a man and a woman drawn as layered SVG, whose outfit, face,
   pose, props and animation depend on the weather mood.
   Stage viewBox is 400 x 230; ground line is y = 206.
   ========================================================================== */
(function (global) {
  'use strict';

  const W = 400, H = 230, GROUND = 206;

  const PALETTE = {
    skinM: '#f1c9a5', skinF: '#f6d3b6',
    hairM: '#4e342e', hairF: '#6d3b1e',
    lips: '#d9534f',
    blush: '#ff8a80',
    blushCold: '#90caf9',
  };

  // ---- small helpers ------------------------------------------------------
  const deg = a => a * Math.PI / 180;
  /** end point of an arm (length 38) hanging from shoulder (sx,sy) rotated by `a` degrees (SVG clockwise). */
  function armEnd(sx, sy, a) {
    return { x: sx - Math.sin(deg(a)) * 38, y: sy + Math.cos(deg(a)) * 38 };
  }

  function face(kind, opts) {
    const o = Object.assign({ blush: PALETTE.blush, glasses: false }, opts || {});
    const lx = 43, rx = 57, ey = 25;
    let eyes = '', mouth = '', brows = '', extra = '';
    switch (kind) {
      case 'love':
        eyes = `<path d="M${lx - 4} ${ey + 1}q4 -6 8 0" class="anim-blink" fill="none" stroke="#3e2723" stroke-width="2.2" stroke-linecap="round"/>
                <path d="M${rx - 4} ${ey + 1}q4 -6 8 0" class="anim-blink b2" fill="none" stroke="#3e2723" stroke-width="2.2" stroke-linecap="round"/>`;
        mouth = `<path d="M44 34q6 7 12 0" fill="none" stroke="#3e2723" stroke-width="2.2" stroke-linecap="round"/>`;
        break;
      case 'happy':
        eyes = `<circle class="anim-blink" cx="${lx}" cy="${ey}" r="2.4" fill="#3e2723"/><circle class="anim-blink b2" cx="${rx}" cy="${ey}" r="2.4" fill="#3e2723"/>
                <circle cx="${lx + 1}" cy="${ey - 1}" r=".8" fill="#fff"/><circle cx="${rx + 1}" cy="${ey - 1}" r=".8" fill="#fff"/>`;
        mouth = `<path d="M43 33q7 8 14 0" fill="#3e2723"/><path d="M45 33.5q5 4 10 0z" fill="#ef5350"/>`;
        break;
      case 'cold':
        brows = `<path d="M39 19l7 -1M61 19l-7 -1" fill="none" stroke="#3e2723" stroke-width="1.8" stroke-linecap="round"/>`;
        eyes = `<circle class="anim-blink" cx="${lx}" cy="${ey}" r="2.2" fill="#3e2723"/><circle class="anim-blink b2" cx="${rx}" cy="${ey}" r="2.2" fill="#3e2723"/>`;
        mouth = `<path d="M44 35q2 -3 4 0t4 0t4 0" fill="none" stroke="#3e2723" stroke-width="2" stroke-linecap="round"/>`;
        o.blush = PALETTE.blushCold;
        break;
      case 'scared':
        brows = `<path d="M39 17l7 2M61 17l-7 2" fill="none" stroke="#3e2723" stroke-width="1.8" stroke-linecap="round"/>`;
        eyes = `<circle cx="${lx}" cy="${ey}" r="4" fill="#fff"/><circle cx="${rx}" cy="${ey}" r="4" fill="#fff"/>
                <circle cx="${lx}" cy="${ey}" r="2" fill="#3e2723"/><circle cx="${rx}" cy="${ey}" r="2" fill="#3e2723"/>`;
        mouth = `<ellipse cx="50" cy="35" rx="3" ry="3.5" fill="#3e2723"/>`;
        break;
      case 'hot':
        eyes = `<path d="M${lx - 4} ${ey}h8M${rx - 4} ${ey}h8" stroke="#3e2723" stroke-width="2.4" stroke-linecap="round"/>`;
        mouth = `<path d="M45 34h10" stroke="#3e2723" stroke-width="2.2" stroke-linecap="round"/><path d="M48 35q2 6 4 0z" fill="#ef5350"/>`;
        extra = `<path class="anim-sweat" d="M63 22q3 4 0 6q-3 -2 0 -6z" fill="#64b5f6"/><path class="anim-sweat s2" d="M36 20q3 4 0 6q-3 -2 0 -6z" fill="#64b5f6"/>`;
        break;
      case 'cool':
        mouth = `<path d="M45 34q5 4 10 -1" fill="none" stroke="#3e2723" stroke-width="2.2" stroke-linecap="round"/>`;
        break;
      case 'wow':
        eyes = `<circle cx="${lx}" cy="${ey}" r="2.6" fill="#3e2723"/><circle cx="${rx}" cy="${ey}" r="2.6" fill="#3e2723"/>
                <circle cx="${lx + 1}" cy="${ey - 1}" r=".9" fill="#fff"/><circle cx="${rx + 1}" cy="${ey - 1}" r=".9" fill="#fff"/>`;
        mouth = `<ellipse cx="50" cy="35" rx="2.6" ry="3.2" fill="#3e2723"/>`;
        break;
      case 'serene':
      default:
        eyes = `<path d="M${lx - 3} ${ey}q3 3 6 0M${rx - 3} ${ey}q3 3 6 0" fill="none" stroke="#3e2723" stroke-width="2.2" stroke-linecap="round"/>`;
        mouth = `<path d="M45 33q5 5 10 0" fill="none" stroke="#3e2723" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    const blush = `<circle cx="38" cy="31" r="3.4" fill="${o.blush}" opacity=".55"/><circle cx="62" cy="31" r="3.4" fill="${o.blush}" opacity=".55"/>`;
    return brows + eyes + mouth + blush + extra;
  }

  function hairMale(color, windy) {
    return `<g class="${windy ? 'anim-hairwind' : ''}">
      <path d="M30 26c0 -14 9 -22 20 -22s20 8 20 22c-4 -6 -10 -9 -20 -9s-16 3 -20 9z" fill="${color}"/>
      <path d="M31 22c3 -9 8 -14 15 -15c-4 4 -6 9 -6 13z" fill="${color}"/>
    </g>`;
  }
  function hairFemaleBack(color, windy) {
    return `<g class="${windy ? 'anim-hairwind' : ''}">
      <path d="M28 26c0 -14 10 -23 22 -23s22 9 22 23v30c0 6 -6 8 -12 6c-3 -6 -3 -12 -2 -18c-3 4 -8 6 -8 6s-5 -2 -8 -6c1 6 1 12 -2 18c-6 2 -12 0 -12 -6z" fill="${color}"/>
    </g>`;
  }
  function hairFemaleFront(color) {
    return `<path d="M30 25c0 -12 9 -20 20 -20s20 8 20 20c-3 -5 -9 -8 -14 -6c-4 -1 -8 -1 -12 0c-5 -2 -11 1 -14 6z" fill="${color}"/>`;
  }

  // ---- accessories ---------------------------------------------------------
  const ACC = {
    scarf: (c, windy) => `<rect x="35" y="41" width="30" height="11" rx="5.5" fill="${c}"/>
      <g class="${windy ? 'anim-scarfwind' : ''}"><path d="M54 47l10 0l3 24l-11 0z" fill="${c}"/><path d="M57 60h8M57 66h8" stroke="rgba(0,0,0,.15)" stroke-width="2"/></g>
      <path d="M38 46h24" stroke="rgba(0,0,0,.12)" stroke-width="2" stroke-linecap="round"/>`,
    beanie: (c) => `<path d="M28 26c0 -15 10 -23 22 -23s22 8 22 23v2h-44z" fill="${c}"/>
      <rect x="27" y="22" width="46" height="9" rx="4" fill="${c}" stroke="rgba(0,0,0,.12)" stroke-width="1.5"/>
      <circle cx="50" cy="3" r="5" fill="#fff"/>`,
    earmuffs: (c) => `<path d="M31 22c2 -14 10 -20 19 -20s17 6 19 20" fill="none" stroke="#5d4037" stroke-width="3"/>
      <circle cx="30" cy="27" r="6.5" fill="${c}"/><circle cx="70" cy="27" r="6.5" fill="${c}"/>`,
    sunglasses: () => `<rect x="35" y="21" width="12" height="8" rx="3" fill="#212121"/><rect x="53" y="21" width="12" height="8" rx="3" fill="#212121"/>
      <path d="M47 24h6M35 23l-4 -2M65 23l4 -2" stroke="#212121" stroke-width="2"/>
      <path d="M38 23l4 0" stroke="#fff" stroke-width="1.2" opacity=".7"/><path d="M56 23l4 0" stroke="#fff" stroke-width="1.2" opacity=".7"/>`,
    sunhat: (c) => `<ellipse cx="50" cy="12" rx="32" ry="7" fill="${c}"/><path d="M32 12c0 -10 8 -14 18 -14s18 4 18 14z" fill="${c}"/><path d="M33 10c4 -3 30 -3 34 0" stroke="rgba(0,0,0,.15)" stroke-width="3" fill="none"/>`,
    cap: (c) => `<path d="M30 20c0 -12 9 -18 20 -18s20 6 20 18z" fill="${c}"/><path d="M30 20h40l10 4h-50z" fill="${c}" stroke="rgba(0,0,0,.12)"/>`,
    hood: (c) => `<path d="M26 30c0 -18 11 -27 24 -27s24 9 24 27v14c0 6 -8 6 -8 0v-12c-4 -6 -10 -9 -16 -9s-12 3 -16 9v12c0 6 -8 6 -8 0z" fill="${c}"/>`,
    mittens: (c, ends) => ends.map(p => `<circle cx="${p.x}" cy="${p.y}" r="7" fill="${c}"/>`).join(''),
  };

  // ---- held items (drawn with the hand at 0,0) -----------------------------
  const ITEMS = {
    icecream: (flavor) => `<path d="M-5 0l5 20l5 -20z" fill="#f2b87a"/><path d="M-5 2l10 0M-4 8l8 0" stroke="#c98d4b" stroke-width="1.2"/>
      <circle cx="0" cy="-3" r="7" fill="${flavor || '#f48fb1'}"/><circle cx="0" cy="-10" r="5.5" fill="#fff3e0"/><circle cx="1" cy="-15" r="1.6" fill="#e53935"/>`,
    cocoa: () => `<rect x="-7" y="-10" width="14" height="14" rx="3" fill="#fff"/><rect x="-7" y="-10" width="14" height="4" rx="2" fill="#8d6e63"/><path d="M7 -6q6 0 6 4t-6 4" fill="none" stroke="#fff" stroke-width="2.4"/>
      <path class="anim-steam" d="M-3 -13q2 -4 0 -8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path class="anim-steam s2" d="M3 -13q2 -4 0 -8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
    flower: (c) => `<path d="M0 0v-22" stroke="#4caf50" stroke-width="2.4" stroke-linecap="round"/><path d="M0 -12q-8 -2 -6 4" fill="#66bb6a"/>
      ${[0,72,144,216,288].map(a => `<ellipse cx="0" cy="-30" rx="4" ry="6" fill="${c}" transform="rotate(${a} 0 -24)"/>`).join('')}<circle cx="0" cy="-24" r="3.5" fill="#ffca28"/>`,
    snowball: () => `<circle cx="0" cy="-4" r="8" fill="#fff" stroke="#cfe3f7" stroke-width="1.5"/>`,
    lantern: () => `<path d="M0 0v-8" stroke="#5d4037" stroke-width="2"/><g class="anim-lantern"><rect x="-8" y="-8" width="16" height="4" rx="1" fill="#5d4037"/>
      <rect x="-7" y="-4" width="14" height="18" rx="3" fill="#ffe082" class="anim-glow"/><rect x="-8" y="14" width="16" height="3" rx="1" fill="#5d4037"/>
      <circle cx="0" cy="5" r="16" fill="#ffd54f" opacity=".25" class="anim-glow"/></g>`,
    fan: () => `<g class="anim-fan"><path d="M0 0l-12 -18q12 -6 24 0z" fill="#ff8a65"/><path d="M0 0l-6 -14M0 0l0 -16M0 0l6 -14" stroke="rgba(0,0,0,.15)" stroke-width="1.2"/></g>`,
    leafHand: () => `<path d="M0 0q-8 -12 2 -20q10 6 -2 20z" fill="#ff7043"/><path d="M0 0q2 -8 2 -18" stroke="#bf360c" stroke-width="1"/>`,
    butterfly: () => `<g class="anim-float"><path d="M0 -2q-10 -12 -10 0q0 8 10 2z" fill="#ba68c8"/><path d="M0 -2q10 -12 10 0q0 8 -10 2z" fill="#ce93d8"/><rect x="-1" y="-6" width="2" height="8" rx="1" fill="#4a148c"/></g>`,
  };

  /**
   * Build one person. `o` fields:
   *  x, gender ('m'|'f'), top, bottom, shoes, hair, face, hat, scarf, sleeves('long'|'short'),
   *  armL, armR (degrees; 0 = hanging down; negative swings outward-right for a right arm),
   *  holdL, holdR (item key + args), anim (class list), windy, mittens, hood
   */
  function person(o) {
    const g = o.gender;
    const skin = g === 'm' ? PALETTE.skinM : PALETTE.skinF;
    const hair = o.hair || (g === 'm' ? PALETTE.hairM : PALETTE.hairF);
    const armL = o.armL || 0, armR = o.armR || 0;
    const sl = { x: 32, y: 56 }, sr = { x: 68, y: 56 };
    const hl = armEnd(sl.x, sl.y, armL), hr = armEnd(sr.x, sr.y, armR);
    const sleeveLen = o.sleeves === 'short' ? 16 : 34;

    const arm = (s, a, hold, holdArgs, sideClass) => `
      <g class="${sideClass}" transform="rotate(${a} ${s.x} ${s.y})">
        <line x1="${s.x}" y1="${s.y}" x2="${s.x}" y2="${s.y + 38}" stroke="${skin}" stroke-width="10" stroke-linecap="round"/>
        <line x1="${s.x}" y1="${s.y}" x2="${s.x}" y2="${s.y + sleeveLen}" stroke="${o.top}" stroke-width="11" stroke-linecap="round"/>
        ${o.mittens ? `<circle cx="${s.x}" cy="${s.y + 38}" r="6.5" fill="${o.mittens}"/>` : ''}
        ${hold ? `<g transform="translate(${s.x} ${s.y + 40}) rotate(${-a})">${ITEMS[hold](holdArgs)}</g>` : ''}
      </g>`;

    const legs = `
      <line x1="41" y1="92" x2="41" y2="120" stroke="${o.bottom}" stroke-width="13" stroke-linecap="round"/>
      <line x1="59" y1="92" x2="59" y2="120" stroke="${o.bottom}" stroke-width="13" stroke-linecap="round"/>
      <ellipse cx="40" cy="124" rx="9.5" ry="5" fill="${o.shoes}"/><ellipse cx="60" cy="124" rx="9.5" ry="5" fill="${o.shoes}"/>`;

    const torso = g === 'f'
      ? `<path d="M31 60q0 -10 10 -10h18q10 0 10 10v22l6 20h-50l6 -20z" fill="${o.top}"/>
         ${o.skirt ? `<path d="M27 94l4 -14h38l4 14z" fill="${o.skirt}"/>` : ''}`
      : `<rect x="30" y="50" width="40" height="46" rx="11" fill="${o.top}"/>`;

    const sweater = o.sweater ? `<path d="M33 90h34M33 86h34" stroke="rgba(0,0,0,.14)" stroke-width="1.8"/><path d="M50 52v10" stroke="rgba(0,0,0,.14)" stroke-width="2"/>` : '';

    const head = `
      <rect x="44" y="40" width="12" height="10" rx="4" fill="${skin}"/>
      <circle cx="50" cy="27" r="20" fill="${skin}"/>
      ${face(o.face, { glasses: o.hat === 'sunglasses' })}
      ${g === 'm' ? hairMale(hair, o.windy) : hairFemaleFront(hair)}`;

    const hatMarkup = o.hat === 'beanie' ? ACC.beanie(o.hatColor || '#ef5350')
      : o.hat === 'earmuffs' ? ACC.earmuffs(o.hatColor || '#f48fb1')
      : o.hat === 'sunhat' ? ACC.sunhat(o.hatColor || '#ffe082')
      : o.hat === 'cap' ? ACC.cap(o.hatColor || '#1e88e5')
      : o.hat === 'hood' ? ACC.hood(o.hatColor || o.top)
      : '';
    const glasses = o.sunglasses ? ACC.sunglasses() : '';
    const scarf = o.scarf ? ACC.scarf(o.scarf, o.windy) : '';

    return `
      <g transform="translate(${o.x - 50} ${GROUND - 126})"><g class="person ${o.anim || ''}">
        ${g === 'f' ? hairFemaleBack(hair, o.windy) : ''}
        ${legs}
        ${arm(sl, armL, o.holdL, o.holdLArgs, 'arm-l')}
        ${torso}${sweater}
        ${head}
        ${hatMarkup}${glasses}${scarf}
        ${arm(sr, armR, o.holdR, o.holdRArgs, 'arm-r')}
      </g></g>`;
  }

  // ---- scene props --------------------------------------------------------
  function umbrella(cx, topY, color, tilt, handleTo) {
    return `<g transform="rotate(${tilt || 0} ${cx} ${topY + 40})"><g class="anim-umbrella">
      <line x1="${cx}" y1="${topY}" x2="${handleTo.x}" y2="${handleTo.y}" stroke="#5d4037" stroke-width="3" stroke-linecap="round"/>
      <path d="M${cx - 72} ${topY + 28}q72 -60 144 0q-12 -6 -24 0q-12 -6 -24 0q-12 -6 -24 0q-12 -6 -24 0q-12 -6 -24 0q-12 -6 -24 0z" fill="${color}"/>
      <path d="M${cx} ${topY - 6}v34" stroke="rgba(0,0,0,.15)" stroke-width="2"/>
      <path d="M${cx - 48} ${topY + 18}q48 -34 96 0" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="3"/>
    </g></g>`;
  }
  function hearts(cx, cy) {
    const h = (x, y, s, cls) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="anim-heart ${cls}" d="M0 6c-6 -4 -9 -8 -9 -12a5 5 0 0 1 9 -2a5 5 0 0 1 9 2c0 4 -3 8 -9 12z" fill="#ff4f7d"/></g>`;
    return h(cx, cy, 1, '') + h(cx - 18, cy + 10, .7, 'h2') + h(cx + 20, cy + 6, .8, 'h3');
  }
  function flowers(seed) {
    const cols = ['#ff80ab', '#ffd54f', '#ba68c8', '#4fc3f7', '#ff8a65', '#fff'];
    let s = '';
    const xs = [22, 48, 78, 300, 330, 362, 386, 128, 270];
    xs.forEach((x, i) => {
      const c = cols[(i + (seed || 0)) % cols.length], h = 18 + (i % 3) * 6;
      s += `<g transform="translate(${x} ${GROUND + 2})"><g class="anim-flower ${i % 3 === 1 ? 'f2' : i % 3 === 2 ? 'f3' : ''}">
        <path d="M0 0v-${h}" stroke="#43a047" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M0 -${h * .5}q-7 -2 -6 5" fill="#66bb6a"/>
        ${[0,60,120,180,240,300].map(a => `<ellipse cx="0" cy="-${h + 6}" rx="3.2" ry="5" fill="${c}" transform="rotate(${a} 0 -${h})"/>`).join('')}
        <circle cx="0" cy="-${h}" r="3" fill="#ffca28"/></g></g>`;
    });
    return s;
  }
  function grassTufts() {
    let s = '';
    for (let x = 8; x < W; x += 34) {
      s += `<path d="M${x} ${GROUND + 4}q2 -10 5 -14q0 9 3 14q1 -8 6 -11q-2 8 -1 11z" fill="rgba(60,120,50,.35)"/>`;
    }
    return s;
  }
  function snowman(x) {
    return `<g transform="translate(${x} ${GROUND})">
      <ellipse cx="0" cy="2" rx="24" ry="5" fill="rgba(0,0,0,.08)"/>
      <circle cx="0" cy="-16" r="18" fill="#fff" stroke="#dfeaf5"/><circle cx="0" cy="-42" r="13" fill="#fff" stroke="#dfeaf5"/>
      <circle cx="-4" cy="-45" r="1.6" fill="#333"/><circle cx="4" cy="-45" r="1.6" fill="#333"/>
      <path d="M0 -42l8 2l-8 2z" fill="#ff7043"/>
      <path d="M-3 -38q3 3 6 0" fill="none" stroke="#333" stroke-width="1.2"/>
      <circle cx="0" cy="-22" r="1.8" fill="#333"/><circle cx="0" cy="-14" r="1.8" fill="#333"/>
      <path d="M-18 -20l-14 -6M18 -20l14 -6" stroke="#8d6e63" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="-10" y="-62" width="20" height="4" fill="#333"/><rect x="-6" y="-72" width="12" height="11" fill="#333"/>
      <rect x="-14" y="-36" width="28" height="5" rx="2" fill="#ef5350"/>
    </g>`;
  }
  function leafPile() {
    const cols = ['#ff7043', '#ffb300', '#e64a19', '#ffca28', '#d84315'];
    let s = '';
    for (let i = 0; i < 26; i++) {
      const x = (i * 53) % W, y = GROUND - 2 + (i % 3) * 3, c = cols[i % cols.length], r = (i * 47) % 360;
      s += `<path d="M0 0q-6 -8 0 -12q6 4 0 12z" fill="${c}" transform="translate(${x} ${y}) rotate(${r})"/>`;
    }
    return s;
  }
  function stars() {
    let s = '';
    for (let i = 0; i < 18; i++) {
      const x = (i * 71 + 13) % W, y = 10 + (i * 37) % 110, sz = 1 + (i % 3);
      s += `<circle class="anim-twinkle ${i % 3 === 1 ? 't2' : i % 3 === 2 ? 't3' : ''}" cx="${x}" cy="${y}" r="${sz}" fill="#fff"/>`;
    }
    s += `<path d="M330 40a22 22 0 1 0 22 30a17 17 0 1 1 -22 -30z" fill="#fff59d"/>`;
    return s;
  }
  function sunCorner(x, y, r, color) {
    return `<g transform="translate(${x} ${y})"><g class="anim-spin">${[0,45,90,135,180,225,270,315].map(a => `<path d="M0 -${r + 6}l5 10h-10z" fill="${color}" opacity=".9" transform="rotate(${a})"/>`).join('')}</g>
      <circle r="${r}" fill="${color}"/><circle r="${r + 10}" fill="${color}" opacity=".18"/></g>`;
  }
  function puddles() {
    return `<ellipse cx="80" cy="${GROUND + 8}" rx="40" ry="5" fill="rgba(255,255,255,.35)"/><ellipse cx="330" cy="${GROUND + 6}" rx="30" ry="4" fill="rgba(255,255,255,.3)"/>`;
  }
  function frostBreath(x, y) {
    return `<ellipse class="anim-steam" cx="${x}" cy="${y}" rx="7" ry="4" fill="rgba(255,255,255,.7)"/><ellipse class="anim-steam s2" cx="${x + 4}" cy="${y - 2}" rx="6" ry="3.5" fill="rgba(255,255,255,.6)"/>`;
  }

  // ---- scene definitions ----------------------------------------------------
  const SCENES = {
    rain() {
      const mx = 158, fx = 242;
      const man = person({ x: mx, gender: 'm', top: '#ffca28', bottom: '#37474f', shoes: '#212121', hat: 'hood', hatColor: '#ffca28', face: 'love', armR: -50, armL: -165, anim: 'anim-sway' });
      const woman = person({ x: fx, gender: 'f', top: '#42a5f5', skirt: '#1e88e5', bottom: '#f5f5f5', shoes: '#212121', face: 'love', armL: 50, armR: -10, anim: 'anim-sway delay' });
      const hand = armEnd(mx - 50 + 32, GROUND - 126 + 56, -165);
      return puddles() + umbrella(200, 40, '#ef5350', -2, hand) + man + woman + hearts(200, 90);
    },
    storm() {
      const mx = 168, fx = 232;
      const hand = armEnd(mx - 50 + 32, GROUND - 126 + 56, -160);
      const man = person({ x: mx, gender: 'm', top: '#546e7a', bottom: '#263238', shoes: '#111', hat: 'hood', hatColor: '#546e7a', face: 'scared', armL: -160, armR: 40, anim: 'anim-huddle', windy: true });
      const woman = person({ x: fx, gender: 'f', top: '#8e24aa', skirt: '#6a1b9a', bottom: '#263238', shoes: '#111', face: 'scared', armL: 60, armR: 30, anim: 'anim-huddle', windy: true });
      return puddles() + umbrella(200, 44, '#37474f', 18, hand) + man + woman;
    },
    snow() {
      const man = person({ x: 150, gender: 'm', top: '#e53935', bottom: '#1e3a5f', shoes: '#37474f', sweater: true, hat: 'beanie', hatColor: '#1e88e5', scarf: '#fff', mittens: '#1e88e5', face: 'happy', armR: -130, armL: 20, holdR: 'snowball', anim: 'anim-bounce' });
      const woman = person({ x: 250, gender: 'f', top: '#26a69a', skirt: '#00796b', bottom: '#5c6bc0', shoes: '#37474f', sweater: true, hat: 'earmuffs', hatColor: '#ff80ab', scarf: '#ff80ab', mittens: '#ff80ab', face: 'happy', armL: -30, armR: -160, anim: 'anim-bounce delay' });
      return snowman(340) + `<ellipse cx="200" cy="${GROUND + 6}" rx="220" ry="14" fill="#fff"/>` + man + woman;
    },
    cold() {
      const man = person({ x: 160, gender: 'm', top: '#5e35b1', bottom: '#37474f', shoes: '#212121', sweater: true, hat: 'beanie', hatColor: '#ef5350', scarf: '#ef5350', face: 'cold', armL: -60, armR: 60, anim: 'anim-shiver' });
      const woman = person({ x: 240, gender: 'f', top: '#ec407a', skirt: '#ad1457', bottom: '#455a64', shoes: '#212121', sweater: true, hat: 'earmuffs', hatColor: '#80deea', scarf: '#80deea', face: 'cold', armL: -60, armR: 60, anim: 'anim-shiver' });
      return grassTufts() + man + woman + frostBreath(178, GROUND - 90) + frostBreath(258, GROUND - 90);
    },
    fog() {
      const man = person({ x: 158, gender: 'm', top: '#6d4c41', bottom: '#3e2723', shoes: '#212121', scarf: '#bcaaa4', face: 'wow', armL: 110, armR: -50, holdL: 'lantern', anim: 'anim-sway' });
      const woman = person({ x: 242, gender: 'f', top: '#78909c', skirt: '#546e7a', bottom: '#37474f', shoes: '#212121', scarf: '#eceff1', face: 'serene', armL: 50, armR: 0, anim: 'anim-sway delay' });
      return grassTufts() + man + woman;
    },
    hot() {
      const man = person({ x: 158, gender: 'm', top: '#ff7043', bottom: '#fff8e1', shoes: '#8d6e63', sleeves: 'short', sunglasses: true, hat: 'cap', hatColor: '#26c6da', face: 'hot', armL: 120, armR: -10, holdL: 'icecream', holdLArgs: '#8bc34a', anim: 'anim-sway' });
      const woman = person({ x: 242, gender: 'f', top: '#ffee58', skirt: '#ff8a65', bottom: '#fff', shoes: '#8d6e63', sleeves: 'short', sunglasses: true, hat: 'sunhat', face: 'hot', armL: 20, armR: -140, holdR: 'fan', anim: 'anim-sway delay' });
      return `<ellipse cx="200" cy="${GROUND + 6}" rx="220" ry="12" fill="rgba(255,255,255,.25)"/>` + man + woman;
    },
    windy() {
      const man = person({ x: 158, gender: 'm', top: '#1e88e5', bottom: '#37474f', shoes: '#212121', hat: 'cap', hatColor: '#ef5350', scarf: '#ef5350', face: 'wow', armR: -175, armL: -20, anim: 'anim-lean', windy: true });
      const woman = person({ x: 246, gender: 'f', top: '#ab47bc', skirt: '#7b1fa2', bottom: '#eceff1', shoes: '#212121', scarf: '#ffe082', face: 'happy', armL: 40, armR: -30, anim: 'anim-lean', windy: true });
      return grassTufts() + man + woman;
    },
    night() {
      const man = person({ x: 160, gender: 'm', top: '#3949ab', bottom: '#263238', shoes: '#111', face: 'wow', armR: -150, armL: 10, anim: 'anim-breathe' });
      const woman = person({ x: 236, gender: 'f', top: '#f06292', skirt: '#c2185b', bottom: '#37474f', shoes: '#111', face: 'love', armL: 50, armR: 0, anim: 'anim-breathe' });
      const fire = `<g transform="translate(330 ${GROUND})"><ellipse cy="2" rx="22" ry="5" fill="rgba(0,0,0,.2)"/><path d="M-18 0l10 -6l8 6z" fill="#5d4037"/><path d="M18 0l-10 -6l-8 6z" fill="#5d4037"/>
        <path class="anim-glow" d="M0 -4c-10 -10 -8 -22 0 -30c2 8 8 10 6 20c6 -4 4 -14 4 -14c8 10 6 20 -10 24z" fill="#ff9800"/><path class="anim-glow" d="M0 -6c-5 -6 -4 -12 0 -18c2 5 5 8 2 14z" fill="#ffeb3b"/></g>`;
      return stars() + man + woman + fire;
    },
    spring() {
      const man = person({ x: 155, gender: 'm', top: '#66bb6a', bottom: '#8d6e63', shoes: '#5d4037', face: 'happy', armL: 130, armR: -10, holdL: 'butterfly', anim: 'anim-bounce' });
      const woman = person({ x: 245, gender: 'f', top: '#f48fb1', skirt: '#ec407a', bottom: '#fff', shoes: '#5d4037', face: 'love', armL: 100, armR: -20, holdL: 'flower', holdLArgs: '#ba68c8', anim: 'anim-bounce delay' });
      return grassTufts() + flowers(1) + man + woman + hearts(200, 100);
    },
    autumn() {
      const man = person({ x: 158, gender: 'm', top: '#bf360c', bottom: '#4e342e', shoes: '#3e2723', sweater: true, scarf: '#ffb300', face: 'happy', armR: -60, armL: 100, holdL: 'leafHand', anim: 'anim-sway' });
      const woman = person({ x: 242, gender: 'f', top: '#f9a825', skirt: '#e65100', bottom: '#5d4037', shoes: '#3e2723', sweater: true, scarf: '#d84315', face: 'love', armL: 60, armR: -110, holdR: 'cocoa', anim: 'anim-sway delay' });
      return leafPile() + man + woman;
    },
    sunny() {
      const man = person({ x: 155, gender: 'm', top: '#29b6f6', bottom: '#fff9c4', shoes: '#8d6e63', sleeves: 'short', sunglasses: true, face: 'cool', armR: -150, armL: 10, anim: 'anim-bounce' });
      const woman = person({ x: 245, gender: 'f', top: '#ffee58', skirt: '#ff7043', bottom: '#fff', shoes: '#8d6e63', sleeves: 'short', hat: 'sunhat', face: 'happy', armL: 0, armR: -120, holdR: 'icecream', holdRArgs: '#f48fb1', anim: 'anim-bounce delay' });
      return grassTufts() + sunCorner(56, 44, 20, '#ffd54f') + man + woman;
    },
    cloudy() {
      const man = person({ x: 158, gender: 'm', top: '#8d6e63', bottom: '#455a64', shoes: '#212121', face: 'serene', armR: -50, armL: 10, anim: 'anim-sway' });
      const woman = person({ x: 242, gender: 'f', top: '#7986cb', skirt: '#3f51b5', bottom: '#cfd8dc', shoes: '#212121', face: 'serene', armL: 50, armR: -10, anim: 'anim-sway delay' });
      return grassTufts() + man + woman;
    },
  };

  function render(sceneKey) {
    const fn = SCENES[sceneKey] || SCENES.sunny;
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">${fn()}</svg>`;
  }

  global.Characters = { render, SCENES };
})(window);
