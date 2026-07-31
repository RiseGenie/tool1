# Kling 3.0

General video. The sensible default: good motion, fair price.

| Field | Value |
|---|---|
| Model ID | kling-3.0/video |
| Provider | Kie AI |
| Method | Async (submit, then poll) |
| Type | Video |
| API key | .env -> KIE_API_KEY |
| Docs | https://kie.ai (check current API docs for this model) |
| Cost | roughly $0.20-0.35 per second; std=720p, pro=1080p, 3-15 second clips |

## Endpoint

```
POST https://api.kie.ai/api/v1/jobs/createTask
Authorization: Bearer {KIE_API_KEY}
```

Poll job status at the status endpoint returned in the create-task response.

## Request format

Confirm the exact JSON body against Kie AI's current docs before the first
call. Expect fields for: model id, prompt, duration/seconds, resolution
(std/pro), and optional reference/start-frame image.

## Response handling

Async pattern:
1. POST the job -> response contains a task id.
2. Poll the status URL every 5-10 seconds.
3. Status says complete -> response contains a file URL.
4. Download immediately -> result URLs often expire in hours.
5. Save into the generations folder, then write the sidecar log.

## Notes

- ALWAYS quote the cost (duration x $/sec) and get explicit user approval
  before submitting a Kling job — video is the expensive lane.
- Verify the model id and pricing against Kie AI's current pricing page
  before relying on the numbers above.
