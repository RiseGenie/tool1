# Pindrop Weather

An animated, map-first weather app. Drop a pin anywhere on the world map (or
search a place, or hit **Show me!**) and the app zooms in, fetches the live
forecast and turns it into motion graphics: rain, snow, fog, lightning, wind,
petals, leaves, sun rays, stars. A man and a woman on a little stage react to
the weather with matching outfits, props and moods.

Static site, no build step, no API keys. Open `index.html` or serve the folder:

```
npx serve weather-app
```

## Features

- **Drop-pin first.** Click anywhere on the map: the pin falls from the sky,
  bounces, kicks up dust and sends out ripple rings, then the weather panel
  slides in. Pins are draggable; dropping one somewhere new reloads the weather.
- **Search** with live suggestions (Open-Meteo geocoding), flags and regions.
  Keyboard friendly: arrows, Enter, Escape.
- **Show me!** A cute avatar button that swoops the camera to your location
  (browser geolocation, with an IP-based fallback if permission is denied) and
  drops a pin there.
- **Ambient world view.** Before any location is chosen, soft cartoon clouds
  drift across the world map with a pulsing sun.
- **Weather motion graphics** over the whole map and inside the character
  stage: cartoon clouds, rain with splashes, heavy storm rain with lightning
  bolts, snowflakes, frost glitter, drifting fog banks, wind streaks, falling
  petals and leaves, rotating sun rays, heat shimmer, twinkling stars with
  shooting stars, a moon, fireflies, sparkles and butterflies. Layers crossfade
  when the weather changes.
- **A couple whose mood follows the forecast**, drawn as layered SVG so every
  outfit, face, pose and prop is data-driven:
  - Rain / drizzle: sharing one umbrella, holding hands, hearts floating.
  - Thunderstorm: huddled together under a wind-bent umbrella, wide-eyed.
  - Snow: beanies, earmuffs, scarves, mittens, a snowball and a snowman.
  - Cold: sweaters, scarves, shivering with visible breath.
  - Fog: lantern in hand, holding on to each other.
  - Hot: sunglasses, cap and sun hat, sweat drops, a fan and an ice cream.
  - Windy: hair and scarves flying, holding on to a hat.
  - Clear night: pointing at the stars by a campfire.
  - Spring: flowers everywhere, offering a blossom, a butterfly on a hand.
  - Autumn: leaf pile, cozy sweaters and a steaming cocoa.
  - Sunny: shades, sun hat, ice cream, waving.
  - Cloudy: holding hands under grey skies.
- **Day and night.** The basemap crossfades between a pastel day map and a navy
  night map based on the location's local time, and every scene gets a night
  variant (stars and moon instead of sun).
- **Animated cursor.** A lazy-following dashed ring with a snappy dot, a bobbing
  pin while hovering the map in drop-pin mode, hover/press/text states, and a
  particle trail that matches the weather (raindrops, snowflakes, sparks,
  petals, leaves, stars, bolts, mist).
- **Map views.** A switcher in the corner flips between pastel **Streets**
  (day/night), **Satellite** imagery with place labels, and a detailed
  **Roads** map. The weather tint and motion graphics stay on top of all three.
- **3D flyover.** A cinematic terrain "video": the camera dives from orbit onto
  the pin, tilts to 66°, and slowly circles it over real elevation data with
  satellite imagery draped on the mountains, a weather-matched sky, and the
  same rain/snow/leaves/stars effects. Play/pause, replay, speed and relief
  sliders; drag to look around.
- **Street view.** Road-level photos around the pin (KartaView community
  imagery) as an auto-playing "look around" slideshow with a compass, the
  live weather pinned on the photo, and one-tap links to Google Street View,
  Mapillary and KartaView for the exact spot.
- **Directions with weather along the way.** Start/destination with
  autocomplete, "use my location" and "use the pin", swap, drive/bike/walk.
  The route draws itself onto the map with a flowing dashed line and a little
  vehicle driving it; distance, time and arrival; turn-by-turn steps you can
  click to jump to; and the forecast at the start, the middle and the end for
  the time you would actually be there (with rain chance) plus a one-line
  travel tip such as "Rain near Reading around 14:05 — pack an umbrella".
  Tap any waypoint chip to drop the pin there and see the couple react.
- **Details**: current temperature, feels-like, condition, humidity, wind,
  cloud cover, rain chance, sunrise/sunset, the next 12 hours and a 7-day
  outlook with temperature range bars. °C/°F toggle is remembered.
- Responsive: bottom sheet on phones, side panel on desktop. Honors
  `prefers-reduced-motion`.
- Deep links: `index.html#lat,lon` opens straight to a location.

## Data sources (all keyless)

| Purpose | Service |
|---------|---------|
| Forecast | [Open-Meteo](https://open-meteo.com/) |
| Place search | Open-Meteo Geocoding |
| Reverse geocoding | BigDataCloud client API, Nominatim fallback |
| IP location fallback | ipwho.is |
| Map tiles | Esri World Light Gray / Dark Gray Canvas, World Imagery, World Street Map |
| 3D terrain | AWS Terrain Tiles (Terrarium) via MapLibre GL 4.7 |
| Routing | OSRM public demo server |
| Street-level photos | KartaView (OpenStreetCam) API |
| Map library | Leaflet 1.9.4 (cdnjs) |

## Project structure

```
weather-app/
├── index.html
├── css/style.css        layout, panel, pin-drop keyframes, cursor, character animations
└── js/
    ├── weather-api.js   Open-Meteo, geocoding, reverse geocoding, geolocation helpers
    ├── moods.js         forecast → mood key, caption, FX layers, palette (night-aware)
    ├── characters.js    SVG man & woman builder, props and the 13 scenes
    ├── fx.js            canvas particle/motion-graphics engine with crossfading layers
    ├── cursor.js        custom animated cursor + weather trail
    ├── views.js         base-layer switcher, 3D terrain flyover, street-level photo view
    ├── directions.js    OSRM routing, animated route, steps, weather along the route
    └── app.js           Leaflet map, pin drop, search, Show me, panel rendering
```

## How the mood is chosen

`moods.js` looks at the WMO weather code, feels-like temperature, wind, local
season (hemisphere-aware) and whether it is day or night, in this priority:
thunderstorm → snow → rain → drizzle → fog → cold (≤ 6 °C) → hot (≥ 31 °C) →
windy (≥ 32 km/h) → clear night → spring → autumn → sunny → cloudy. Any scene
after dark swaps sun layers for stars and darkens its palette.
