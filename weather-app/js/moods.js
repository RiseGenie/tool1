/* ==========================================================================
   Mood engine: turns a forecast into a scene key, a caption, colours and the
   effects each layer (map FX, stage FX, cursor, characters) should use.
   ========================================================================== */
(function (global) {
  'use strict';

  /** Meteorological season for a date + hemisphere. */
  function seasonFor(dateStr, lat) {
    const m = new Date(dateStr || Date.now()).getMonth(); // 0-11
    const north = lat >= 0;
    let s;
    if (m >= 2 && m <= 4) s = 'spring';
    else if (m >= 5 && m <= 7) s = 'summer';
    else if (m >= 8 && m <= 10) s = 'autumn';
    else s = 'winter';
    if (!north) s = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' }[s];
    // Tropics have no real winter; treat as summer unless it's cold.
    if (Math.abs(lat) < 15 && (s === 'winter' || s === 'autumn')) s = 'summer';
    return s;
  }

  /**
   * Decide the scene. Priority: dangerous/dramatic weather first, then
   * temperature extremes, then wind, then season flavour, then sky state.
   */
  function resolve(forecast) {
    const n = forecast.now;
    const cat = WeatherAPI.describe(n.code, n.isDay).cat;
    const t = n.feels != null ? n.feels : n.temp;
    const season = seasonFor(n.time, forecast.lat);
    const windy = n.wind >= 32 || (n.gusts || 0) >= 50;
    const night = !n.isDay;

    let key;
    if (cat === 'storm') key = 'storm';
    else if (cat === 'snow') key = 'snow';
    else if (cat === 'rain') key = 'rain';
    else if (cat === 'drizzle') key = 'drizzle';
    else if (cat === 'fog') key = 'fog';
    else if (t <= 6) key = 'cold';
    else if (t >= 31) key = 'hot';
    else if (windy) key = 'windy';
    else if (night && (cat === 'clear' || cat === 'partly')) key = 'night';
    else if (season === 'spring' && (cat === 'clear' || cat === 'partly')) key = 'spring';
    else if (!night && season === 'autumn' && (cat === 'clear' || cat === 'partly' || cat === 'cloudy')) key = 'autumn';
    else if (cat === 'clear' || cat === 'partly') key = 'sunny';
    else key = 'cloudy';

    const def = MOODS[key];
    const mood = Object.assign({ key, season, night, windy, cat, temp: t }, def);
    if (night && key !== 'night') nightify(mood, cat);
    return mood;
  }

  /** Any scene after dark: swap sun layers for stars, darken the stage palette. */
  function nightify(mood, cat) {
    const noSun = (x) => !x.startsWith('sun') && x !== 'sparkles' && x !== 'butterflies';
    const clearish = cat === 'clear' || cat === 'partly';
    mood.mapFx = mood.mapFx.filter(noSun).concat(['stars']);
    mood.stageFx = mood.stageFx.filter(noSun).concat(clearish ? ['stars', 'moon', 'fireflies'] : ['stars']);
    mood.cursorTrail = mood.cursorTrail === 't-spark' || mood.cursorTrail === 't-heat' ? 't-star' : mood.cursorTrail;
    mood.stage = { skyA: mix(mood.stage.skyA, '#141b45', 0.7), skyB: mix(mood.stage.skyB, '#2c3a70', 0.7), ground: mix(mood.stage.ground, '#1f3328', 0.6) };
  }
  function mix(a, b, t) {
    const pa = hex(a), pb = hex(b);
    return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  function hex(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }

  const MOODS = {
    storm: {
      caption: 'Holding on tight — we\'ll weather this together ⚡',
      mapFx: ['clouds-dark', 'rain-heavy', 'lightning', 'wind'],
      stageFx: ['rain-heavy', 'lightning', 'clouds-dark'],
      cursorTrail: 't-bolt',
      stage: { skyA: '#3b3f63', skyB: '#5d6485', ground: '#4d6b4a' },
      scene: 'storm',
    },
    snow: {
      caption: 'Snow day! Rosy cheeks, warm hearts ❄️',
      mapFx: ['snow', 'clouds-soft'],
      stageFx: ['snow', 'clouds-soft'],
      cursorTrail: 't-flake',
      stage: { skyA: '#cfe3f7', skyB: '#f6fbff', ground: '#f4f9ff' },
      scene: 'snow',
    },
    rain: {
      caption: 'In love under one umbrella ☔💕',
      mapFx: ['clouds-grey', 'rain'],
      stageFx: ['rain', 'clouds-grey'],
      cursorTrail: 't-drop',
      stage: { skyA: '#6f86a8', skyB: '#a9bbd3', ground: '#6f9a63' },
      scene: 'rain',
    },
    drizzle: {
      caption: 'A soft drizzle and a shared umbrella 💕',
      mapFx: ['clouds-grey', 'drizzle'],
      stageFx: ['drizzle', 'clouds-grey'],
      cursorTrail: 't-drop',
      stage: { skyA: '#8da0bc', skyB: '#c3d0e2', ground: '#78a56c' },
      scene: 'rain',
    },
    fog: {
      caption: 'Lost in the mist, found in each other 🌫️',
      mapFx: ['fog', 'clouds-soft'],
      stageFx: ['fog'],
      cursorTrail: 't-mist',
      stage: { skyA: '#b9c0cc', skyB: '#e3e7ee', ground: '#9fb39a' },
      scene: 'fog',
    },
    cold: {
      caption: 'Brrr! Sweaters, scarves and shivers 🧣',
      mapFx: ['clouds-soft', 'frost'],
      stageFx: ['frost', 'clouds-soft'],
      cursorTrail: 't-flake',
      stage: { skyA: '#b7d3f2', skyB: '#e8f2fc', ground: '#b9cbb3' },
      scene: 'cold',
    },
    hot: {
      caption: 'Melting… ice cream to the rescue 🍦',
      mapFx: ['sun-big', 'heat'],
      stageFx: ['sun-big', 'heat'],
      cursorTrail: 't-heat',
      stage: { skyA: '#ffb74d', skyB: '#ffe9c2', ground: '#e0c27a' },
      scene: 'hot',
    },
    windy: {
      caption: 'Hold on to your hat! 🌬️',
      mapFx: ['clouds-fast', 'wind', 'leaves'],
      stageFx: ['wind', 'leaves', 'clouds-fast'],
      cursorTrail: 't-cloud',
      stage: { skyA: '#9fc3e6', skyB: '#e3f0fb', ground: '#93c37f' },
      scene: 'windy',
    },
    night: {
      caption: 'Counting stars together 🌙',
      mapFx: ['stars', 'moon', 'clouds-night'],
      stageFx: ['stars', 'moon', 'fireflies'],
      cursorTrail: 't-star',
      stage: { skyA: '#1a2350', skyB: '#3a4a86', ground: '#2f4d3a' },
      scene: 'night',
    },
    spring: {
      caption: 'Spring breeze, blossoms and butterflies 🌸',
      mapFx: ['sun', 'clouds-soft', 'petals'],
      stageFx: ['sun', 'petals', 'butterflies'],
      cursorTrail: 't-petal',
      stage: { skyA: '#a8dcff', skyB: '#fff1f6', ground: '#8fd37d' },
      scene: 'spring',
    },
    autumn: {
      caption: 'Crunchy leaves and cozy cocoa 🍂',
      mapFx: ['sun-low', 'clouds-soft', 'leaves'],
      stageFx: ['sun-low', 'leaves'],
      cursorTrail: 't-leaf',
      stage: { skyA: '#ffcc80', skyB: '#fff3e0', ground: '#d9a85a' },
      scene: 'autumn',
    },
    sunny: {
      caption: 'Sunshine, shades and a perfect day ☀️',
      mapFx: ['sun', 'clouds-soft'],
      stageFx: ['sun', 'sparkles'],
      cursorTrail: 't-spark',
      stage: { skyA: '#8ecbff', skyB: '#e7f6ff', ground: '#8fd37d' },
      scene: 'sunny',
    },
    cloudy: {
      caption: 'Grey skies, warm hands 🤝',
      mapFx: ['clouds-grey'],
      stageFx: ['clouds-grey'],
      cursorTrail: 't-cloud',
      stage: { skyA: '#9fb0c7', skyB: '#dfe6ef', ground: '#8ab27a' },
      scene: 'cloudy',
    },
    ambient: {
      caption: '',
      mapFx: ['clouds-soft', 'sun'],
      stageFx: [],
      cursorTrail: 't-cloud',
      stage: { skyA: '#bfe3ff', skyB: '#f3fbff', ground: '#9ad38a' },
      scene: 'sunny',
    },
  };

  global.Moods = { resolve, seasonFor, MOODS };
})(window);
