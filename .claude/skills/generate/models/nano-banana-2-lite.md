# Nano Banana 2 Lite

Everyday images. Cheap, fast, strong with reference images. Default choice
for drafts and most marketing stills.

| Field | Value |
|---|---|
| Model ID | gemini-3.1-flash-lite-image |
| Provider | Google AI Studio (also available on fal.ai) |
| Method | Sync (instant reply) |
| Type | Image |
| API key | .env -> GOOGLE_API_KEY |
| Docs | https://ai.google.dev/gemini-api/docs/image-generation |
| Cost | about $0.034 per 1K image |

## Endpoint

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model-id}:generateContent?key={GOOGLE_API_KEY}
```

## Request format

Confirm the exact JSON body against the current docs before the first call —
Google's request shape (contents/parts, inline reference images as base64 or
fileData) changes between API versions. At minimum it needs: the text
prompt, and any reference images attached as inline data parts.

## Response handling

Sync call. The generated image comes back inline in the response (base64
image data in a `parts` entry) — decode and save directly, no polling.

## Notes

- Verify the model ID is still current before first use; Google ships new
  Gemini image model versions periodically and old ids 404.
- Strong at following reference images for style/likeness — always pass
  real reference files rather than describing them in words.
