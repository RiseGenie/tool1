---
name: generate
description: Generate images and videos via AI model APIs for marketing/README assets (hero images, screenshots, demo clips) for the 8K Wallpaper Builder project. Triggers on /generate, generate image, generate video, create image, thumbnail, animate, hero image, demo video.
---

# /generate

This skill is for producing **marketing and documentation assets** (README
hero images, promo screenshots, demo videos of the wallpaper styles) — it is
separate from the app itself. The wallpaper builder in this repo generates
images procedurally in-browser via Canvas and never calls external AI APIs;
this skill exists only to help create assets *about* the project.

## Models

| Task | Default model | Recipe |
|---|---|---|
| Image (default) | Nano Banana 2 Lite | models/nano-banana-2-lite.md |
| Video (default) | Kling 3.0 | models/kling-3.0.md |

Read the recipe file before every generation.

## Provider routing

1. Default to the LOWEST COST provider that runs the model well
   (check Kie AI, fal.ai, WaveSpeed AI).
2. If the cheapest route lacks the model, fails auth, or errors,
   fall back to the next provider.
3. Never hide a provider swap. Say which route ran and why.

## Output

- Save every file FLAT into the generations folder: `/home/user/generations`
  (kept outside this repo, never committed to git).
- No subfolders. Reference images live in `/home/user/generations/refs/`
- Naming: `{project}_{description}_{timestamp}.{ext}`

## Rules

- Quote the cost and wait for my explicit go before any paid
  video run. One approval = one run.
- Draft on the cheap image model first. Only rerun on a quality
  model when I pick a favourite.
- Never describe a logo or face in text. Pass the real image
  file as a reference. If it's missing, stop and ask me for it.
- Run multiple generations one at a time to avoid rate limits.
- After every save, write the sidecar log (see Logging).
- API keys live in `/home/user/generations/.env` — read them from there,
  never hardcode or paste a key into code or chat.

## Logging

After every save, write a sidecar JSON file next to the media, same
basename, `.json` extension:

```json
{
  "model": "gemini-3.1-flash-lite-image",
  "prompt": "the full text prompt that was sent to the API",
  "refs": ["refs/logo.png"],
  "params": { "aspect": "16:9", "size": "2K" },
  "created": "2026-07-31T00:00:00Z"
}
```
