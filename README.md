# 8K Wallpaper Builder

A static, client-side wallpaper generator. Pick a style, a topic, and an aspect
ratio, then export a procedurally generated wallpaper as a true 8K PNG —
everything renders in the browser via Canvas, nothing is uploaded anywhere.

## Usage

Open `index.html` in a modern desktop browser (Chrome/Edge/Firefox recommended
for large-canvas + `toBlob` support), or serve the folder with any static file
server, e.g.:

```
npx serve .
```

1. Choose a **Category / Style** — the generative algorithm used to draw the image.
2. Choose a **Topic** — the color palette / mood applied to that algorithm.
3. Choose an **Aspect Ratio** — the export resolution.
4. Optionally set or randomize the **Seed** to get a different variation of the same style/topic.
5. Click **Generate Preview** for a fast low-res preview, then **Download 8K PNG** to render and download the full-resolution image.

## Styles (10)

Abstract Gradient Flow, Geometric Shapes, Minimalist Gradient, Synthwave Retro,
Nebula / Space Clouds, Low Poly Terrain, Fluid Waves, Particle Field,
Gradient Mesh Blobs, Topographic Lines.

## Topics (10)

Cosmos / Space, Ocean Depths, Nature / Meadow, Mountains, Neon Cityscape,
Technology / Digital, Fire & Ember, Deep Forest, Desert Dunes, Aurora Skies.

## Aspect Ratios (6)

| Ratio | Export resolution |
|-------|--------------------|
| 16:9  | 7680 × 4320 |
| 21:9  | 7680 × 3291 |
| 1:1   | 7680 × 7680 |
| 4:3   | 7680 × 5760 |
| 3:2   | 7680 × 5120 |
| 9:16  | 4320 × 7680 |

## Notes

- Full 8K renders are memory-intensive (up to ~59 megapixels). Rendering can take a few seconds and briefly use significant RAM; closing other tabs helps on lower-memory machines.
- The generator is deterministic per seed — the same style/topic/ratio/seed combination always reproduces the same image.

## Project structure

```
index.html        Markup / layout
css/style.css      Styling
js/palettes.js     Topic color palettes + aspect ratio table
js/styles.js        Style renderers (canvas drawing algorithms) + PRNG helpers
js/app.js           UI wiring, preview rendering, 8K export/download
```
