# RiseGenie Recorder

Browser-first screen recording for agencies, support teams, trainers and sales: **record → edit → share → watch → comment**.
Name, logo and colours are configurable (`NEXT_PUBLIC_BRAND_*`). Built on Next.js (App Router), PostgreSQL, S3-compatible private storage, Supabase Auth and an FFmpeg worker.

> This repository also contains the RiseGenie marketing site (`/`) and an earlier local-first prototype (`/clips`). The recorder lives under **`/app`** (signed-in) and **`/s/<token>`** (guest viewing).

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Record, edit, share, watch, comments, library | **Built and tested** (see Testing) |
| 2 | Client approvals, privacy editing, SOPs, video requests, bug reports | Not started — not in the navigation |
| 3 | Workspaces, HighLevel, distribution, analytics, admin | Not started |
| 4 | Advanced recording/editing/AI | Not started |

### Phase 1 features
* **Recorder** (`/app/record`): tab / window / screen capture via the browser picker; screen-only, screen + camera, camera-only; camera & mic selection with live preview and mic level meter; tab/system audio when the browser provides it (mixed with the mic); camera bubble composited into the saved video, movable (drag on the live preview or corner presets) and hideable while recording; countdown, timer, pause/resume, restart, stop, recording indicator (page + tab title); handles denied permissions, missing/disconnected devices and the browser’s **Stop sharing**; releases all tracks.
* **Saving & recovery:** every slice is written to IndexedDB as it is recorded; chunked upload with progress, retry/backoff, resume after reload, and **idempotent finalize**. Unsent recordings can be resumed, downloaded, or discarded. States: recording → uploading → processing → ready / failed (with retry).
* **Processing (worker):** chunks → source file → H.264/AAC MP4 (`+faststart`, constant frame rate, correct duration) → thumbnail → transcript (queued separately; the video plays while it runs).
* **Editing:** rename, non-destructive trim (re-renders; the stale untrimmed file stops being served immediately), choose thumbnail frame, folders.
* **Sharing:** private or anyone-with-the-link; multiple, individually revocable links; per-link download and comment permissions; guests need no account. Access is checked **before** any media URL is signed; URLs live `MEDIA_URL_TTL_SEC` (default 300 s).
* **Watching:** keyboard-accessible player, speed, captions, searchable transcript that seeks, mobile-first layout.
* **Feedback:** timestamped comments with one level of replies. Signed-in authors are marked verified; guest names are self-declared and shown as “Guest”.
* **Library:** recent recordings, folders, search over titles **and** transcripts, scoped to the signed-in owner.

## Local setup

Requirements: Node 22, PostgreSQL 16, FFmpeg (with libx264 and AAC) on `PATH`.

```bash
cp .env.example .env.local          # then edit
npm install
# Postgres: use your own, or the throwaway helper (port 54329):
scripts/dev-db.sh start
export DATABASE_URL=postgres://rg@127.0.0.1:54329/recorder
npm run migrate
# Development auth + local disk storage + mock transcript (no external accounts needed):
export DEV_AUTH=1 STORAGE_DRIVER=fs TRANSCRIBE_PROVIDER=mock APP_SECRET=dev
npm run dev            # terminal 1  -> http://localhost:3000/login
npm run worker         # terminal 2  (processing & transcripts)
```

`DEV_AUTH` (email-only sign-in) and `STORAGE_DRIVER=fs` are **hard-disabled/refused when `NODE_ENV=production`**.
`TRANSCRIBE_PROVIDER=mock` is canned text for demos and tests — it is not speech recognition.

Or run everything in containers: `docker compose up --build` (Postgres + MinIO + web + worker; sign-in needs Supabase keys — see below).

## Environment variables
See [`.env.example`](.env.example) for the full annotated list. Required in production: `DATABASE_URL`, `APP_SECRET`, `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `S3_*`. Credentials are read server-side only; only `NEXT_PUBLIC_*` values reach the browser (Supabase URL + anon key are public by design).

## Deployment

The web app and the worker are two processes of **one image** (`Dockerfile`). The worker needs FFmpeg and a long-lived process, so it cannot run on Vercel serverless; the web app can run anywhere Node runs.

1. **Supabase project** (Postgres + Auth + S3-compatible Storage in one place — any Postgres/S3/OIDC combo also works):
   * *Database:* run `npm run migrate` against the project’s connection string (use the pooled/session string).
   * *Auth:* enable the Email provider; set **Site URL** to `APP_URL` and add `APP_URL/auth/callback` to Redirect URLs.
   * *Storage:* create a **private** bucket (e.g. `recordings`), then create S3 access keys (Storage → S3 Connection) and set `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
2. **Host** (Fly.io / Railway / Render / any Docker host): build the image, run `npm run migrate` once, then run two services from it — `npm run start` (web, port 3000) and `npm run worker`. Put the web service behind HTTPS (capture APIs require it).
3. **Transcription:** set `TRANSCRIBE_PROVIDER=openai` with `TRANSCRIBE_API_KEY` (works with OpenAI, Groq or a self-hosted Whisper server via `TRANSCRIBE_BASE_URL`). With `none`, videos are still fully usable; transcripts show “not enabled”.
4. Scale the worker with `WORKER_CONCURRENCY` or more replicas — job claiming uses `FOR UPDATE SKIP LOCKED`.

## Testing

```bash
npm run typecheck && npm run lint
npm test                 # needs a running server: use the wrapper below
scripts/test-env.sh      # starts DB + app, runs tests/*.test.ts (17 tests)
scripts/e2e.sh           # Phase 1 acceptance test in headless Chromium (16 steps + a11y + no page errors)
```

* `tests/pipeline.test.ts` — interrupted/out-of-order chunk upload, size verification, concurrent/idempotent finalize (exactly one job), FFmpeg output (duration, faststart), transcript search scoping, trim (+ stale-file withholding), private-by-default permissions, share link guest flow, comments/replies, view counting, download permission, **revocation (no metadata, media URL, captions, transcript, comments or download for a fresh guest)**, expired/tampered signed URLs, failed-processing retry, deletion of media.
* `tests/timeline.test.ts` — trim mapping of transcripts/comments/captions.
* `tests/e2e/acceptance.mjs` — records a different tab with camera + mic, pause/resume, Stop sharing, interrupts the upload, reloads, recovers and resumes, trims, shares, plays on an emulated phone without signing in, seeks via transcript, comments, revokes, and checks a fresh guest gets nothing. Also verifies the camera bubble pixel in the processed MP4 and scans pages with axe-core.

Browser coverage and what is *not* covered: [`docs/BROWSER_MATRIX.md`](docs/BROWSER_MATRIX.md).

## Definitions & behaviours

**View counting.** A *view* is one player session in which a viewer’s browser actually played ≥ 3 s. A viewer is identified by a first-party anonymous cookie (never treated as a known person). At most one view per viewer per recording per 24 h; the owner’s own plays are excluded. Watch time only grows with continuous forward playback and the server caps it at wall-clock time since the session began, so scrubbing, replays and forged heartbeats cannot inflate counts.

**Access & revocation.** Every guest endpoint resolves the link through one gate (`resolveShare`): token valid, not revoked, recording not deleted and `visibility = link`. Failures are an identical 404. Revoking or switching to Private affects the next request. *Already-issued* signed URLs remain valid until they expire (≤ `MEDIA_URL_TTL_SEC`, default 5 min) — lower it if you need a shorter window. Share tokens are stored hashed for lookup and AES-GCM-encrypted (key from `APP_SECRET`) so owners can re-copy links; rotating `APP_SECRET` makes existing links un-copyable.

**Trim, transcripts and comments.** Trims are non-destructive and re-render from the original upload. Transcripts and comment anchors are stored on the *original* timeline and mapped to the edited timeline when read, so captions stay aligned; comments outside a trim are flagged.

**Deletion.** Deleting a recording removes its DB rows (links, comments, transcript, jobs) and its stored objects (source, playback, thumbnail, leftover chunks). Retention policies and account-level deletion are Phase 3.

## Known limitations (Phase 1)
* Live-account checks not yet done: Supabase Auth magic-link flow, Supabase S3 presigned URLs, and OpenAI-compatible transcription were implemented but **not exercised against live services** here (tests use dev auth, filesystem storage and a mock transcriber). The S3 driver and compose stack are untested in the authoring sandbox (no Docker/S3).
* Real-browser coverage is Chromium only; see the matrix.
* Floating pause/stop controls (Document Picture-in-Picture) are not built; use the browser’s *Stop sharing* bar or return to the tab.
* Rate limiting is in-memory per instance; use a shared store before running several web instances.
* Owner comments moderation only; guests cannot edit or delete their comments yet.
