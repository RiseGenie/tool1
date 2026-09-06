/* ==========================================================================
   Weather + geocoding (all keyless, CORS-friendly public APIs)
   - Forecast:        Open-Meteo
   - Search:          Open-Meteo Geocoding
   - Reverse geocode: BigDataCloud (fallback: Nominatim)
   - IP fallback for "Show me": ipwho.is
   ========================================================================== */
(function (global) {
  'use strict';

  const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
  const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
  const IP_URL = 'https://ipwho.is/';

  /** WMO weather interpretation codes → human labels, emoji and a broad category. */
  const WMO = {
    0:  { label: 'Clear sky',              icon: '☀️', night: '🌙', cat: 'clear' },
    1:  { label: 'Mainly clear',           icon: '🌤️', night: '🌙', cat: 'clear' },
    2:  { label: 'Partly cloudy',          icon: '⛅', night: '☁️', cat: 'partly' },
    3:  { label: 'Overcast',               icon: '☁️', night: '☁️', cat: 'cloudy' },
    45: { label: 'Foggy',                  icon: '🌫️', night: '🌫️', cat: 'fog' },
    48: { label: 'Icy fog',                icon: '🌫️', night: '🌫️', cat: 'fog' },
    51: { label: 'Light drizzle',          icon: '🌦️', night: '🌧️', cat: 'drizzle' },
    53: { label: 'Drizzle',                icon: '🌦️', night: '🌧️', cat: 'drizzle' },
    55: { label: 'Heavy drizzle',          icon: '🌧️', night: '🌧️', cat: 'drizzle' },
    56: { label: 'Freezing drizzle',       icon: '🌧️', night: '🌧️', cat: 'drizzle' },
    57: { label: 'Freezing drizzle',       icon: '🌧️', night: '🌧️', cat: 'drizzle' },
    61: { label: 'Light rain',             icon: '🌧️', night: '🌧️', cat: 'rain' },
    63: { label: 'Rain',                   icon: '🌧️', night: '🌧️', cat: 'rain' },
    65: { label: 'Heavy rain',             icon: '🌧️', night: '🌧️', cat: 'rain' },
    66: { label: 'Freezing rain',          icon: '🌧️', night: '🌧️', cat: 'rain' },
    67: { label: 'Heavy freezing rain',    icon: '🌧️', night: '🌧️', cat: 'rain' },
    71: { label: 'Light snow',             icon: '🌨️', night: '🌨️', cat: 'snow' },
    73: { label: 'Snow',                   icon: '❄️', night: '❄️', cat: 'snow' },
    75: { label: 'Heavy snow',             icon: '❄️', night: '❄️', cat: 'snow' },
    77: { label: 'Snow grains',            icon: '🌨️', night: '🌨️', cat: 'snow' },
    80: { label: 'Rain showers',           icon: '🌦️', night: '🌧️', cat: 'rain' },
    81: { label: 'Rain showers',           icon: '🌧️', night: '🌧️', cat: 'rain' },
    82: { label: 'Violent rain showers',   icon: '⛈️', night: '⛈️', cat: 'rain' },
    85: { label: 'Snow showers',           icon: '🌨️', night: '🌨️', cat: 'snow' },
    86: { label: 'Heavy snow showers',     icon: '❄️', night: '❄️', cat: 'snow' },
    95: { label: 'Thunderstorm',           icon: '⛈️', night: '⛈️', cat: 'storm' },
    96: { label: 'Thunderstorm with hail', icon: '⛈️', night: '⛈️', cat: 'storm' },
    99: { label: 'Thunderstorm with hail', icon: '⛈️', night: '⛈️', cat: 'storm' },
  };

  function describe(code, isDay) {
    const w = WMO[code] || { label: 'Unknown', icon: '🌡️', night: '🌡️', cat: 'cloudy' };
    return { label: w.label, icon: isDay === false ? w.night : w.icon, cat: w.cat };
  }

  async function getJSON(url, opts) {
    const res = await fetch(url, Object.assign({ headers: { Accept: 'application/json' } }, opts || {}));
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
    return res.json();
  }

  /** Full forecast for a coordinate. */
  async function fetchForecast(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      current: [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
        'precipitation', 'weather_code', 'wind_speed_10m', 'wind_direction_10m', 'cloud_cover', 'wind_gusts_10m',
      ].join(','),
      hourly: 'temperature_2m,weather_code,is_day,precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '7',
    });
    const data = await getJSON(FORECAST_URL + '?' + params.toString());
    return normalize(data);
  }

  function normalize(d) {
    const c = d.current;
    const now = {
      temp: c.temperature_2m,
      feels: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      isDay: c.is_day === 1,
      precip: c.precipitation,
      code: c.weather_code,
      wind: c.wind_speed_10m,
      gusts: c.wind_gusts_10m,
      windDir: c.wind_direction_10m,
      cloud: c.cloud_cover,
      time: c.time,
    };
    const daily = d.daily.time.map((t, i) => ({
      date: t,
      code: d.daily.weather_code[i],
      max: d.daily.temperature_2m_max[i],
      min: d.daily.temperature_2m_min[i],
      sunrise: d.daily.sunrise[i],
      sunset: d.daily.sunset[i],
      rainChance: d.daily.precipitation_probability_max[i],
    }));
    const hourly = d.hourly.time.map((t, i) => ({
      time: t,
      temp: d.hourly.temperature_2m[i],
      code: d.hourly.weather_code[i],
      isDay: d.hourly.is_day[i] === 1,
      rainChance: d.hourly.precipitation_probability[i],
    }));
    return {
      now, daily, hourly,
      timezone: d.timezone,
      tzAbbr: d.timezone_abbreviation,
      utcOffset: d.utc_offset_seconds,
      lat: d.latitude, lon: d.longitude,
      elevation: d.elevation,
    };
  }

  /** Search suggestions for the search box. */
  async function searchPlaces(query) {
    const q = (query || '').trim();
    if (q.length < 2) return [];
    const params = new URLSearchParams({ name: q, count: '7', language: 'en', format: 'json' });
    const data = await getJSON(GEOCODE_URL + '?' + params.toString());
    return (data.results || []).map(r => ({
      name: r.name,
      admin: r.admin1 || '',
      country: r.country || '',
      countryCode: r.country_code || '',
      lat: r.latitude, lon: r.longitude,
      timezone: r.timezone,
      population: r.population || 0,
    }));
  }

  /** Human name for a coordinate. Never throws: falls back to coordinates. */
  async function reverseGeocode(lat, lon) {
    try {
      const params = new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: 'en' });
      const r = await getJSON(REVERSE_URL + '?' + params.toString());
      const name = r.city || r.locality || r.principalSubdivision || '';
      const parts = [];
      if (name) parts.push(name);
      if (r.principalSubdivision && r.principalSubdivision !== name) parts.push(r.principalSubdivision);
      if (r.countryName) parts.push(r.countryName);
      if (parts.length) {
        return { name: parts[0], meta: parts.slice(1).join(', '), countryCode: r.countryCode || '' };
      }
    } catch (e) { /* fall through */ }
    try {
      const params = new URLSearchParams({ format: 'jsonv2', lat, lon, zoom: 10, 'accept-language': 'en' });
      const r = await getJSON(NOMINATIM_URL + '?' + params.toString());
      const a = r.address || {};
      const name = a.city || a.town || a.village || a.county || a.state || r.name || '';
      const meta = [a.state, a.country].filter(Boolean).filter(x => x !== name).join(', ');
      if (name || meta) return { name: name || 'Somewhere', meta, countryCode: (a.country_code || '').toUpperCase() };
    } catch (e) { /* fall through */ }
    const ns = lat >= 0 ? 'N' : 'S', ew = lon >= 0 ? 'E' : 'W';
    const ocean = 'Somewhere out there';
    return { name: ocean, meta: Math.abs(lat).toFixed(2) + '°' + ns + ', ' + Math.abs(lon).toFixed(2) + '°' + ew, countryCode: '' };
  }

  /** Approximate location from the IP (used when the browser denies geolocation). */
  async function locateByIP() {
    const r = await getJSON(IP_URL);
    if (!r || r.success === false || typeof r.latitude !== 'number') throw new Error('IP lookup failed');
    return { lat: r.latitude, lon: r.longitude, approx: true };
  }

  /** Browser geolocation wrapped in a promise, with a time limit. */
  function locateByBrowser(timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) return reject(new Error('Geolocation unsupported'));
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, approx: false }),
        err => reject(err),
        { enableHighAccuracy: false, timeout: timeoutMs || 8000, maximumAge: 5 * 60 * 1000 }
      );
    });
  }

  function flagFromCode(cc) {
    if (!cc || cc.length !== 2) return '📍';
    const A = 0x1F1E6;
    const up = cc.toUpperCase();
    return String.fromCodePoint(A + up.charCodeAt(0) - 65, A + up.charCodeAt(1) - 65);
  }

  global.WeatherAPI = { fetchForecast, searchPlaces, reverseGeocode, locateByIP, locateByBrowser, describe, flagFromCode, WMO };
})(window);
