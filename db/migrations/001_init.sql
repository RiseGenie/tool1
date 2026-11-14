-- RiseGenie Recorder — Phase 1 schema

create table users (
  id          uuid primary key,
  email       text not null unique,
  name        text,
  created_at  timestamptz not null default now()
);

create table folders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references users(id) on delete cascade,
  name        text not null check (length(name) between 1 and 120),
  created_at  timestamptz not null default now()
);
create index folders_owner_idx on folders(owner_id);

create table recordings (
  id                uuid primary key,                 -- client-generated; doubles as the idempotency key
  owner_id          uuid not null references users(id) on delete cascade,
  folder_id         uuid references folders(id) on delete set null,
  title             text not null default 'Untitled recording',
  -- recording | uploading | processing | ready | failed
  status            text not null default 'uploading'
                    check (status in ('recording','uploading','processing','ready','failed')),
  failure_reason    text,
  visibility        text not null default 'private' check (visibility in ('private','link')),
  mime_type         text,
  source_key        text,                             -- assembled original upload
  playback_key      text,                             -- browser-friendly mp4 (trim applied)
  thumbnail_key     text,
  size_bytes        bigint,
  source_duration_ms integer,                         -- duration of the original
  duration_ms       integer,                          -- duration of the edited (trimmed) playback
  width             integer,
  height            integer,
  has_audio         boolean,
  trim_start_ms     integer not null default 0 check (trim_start_ms >= 0),
  trim_end_ms       integer,                          -- null = to the end
  thumbnail_at_ms   integer,                          -- position on the edited timeline
  revision          integer not null default 1,       -- bumps whenever playback is re-rendered
  -- none | queued | processing | ready | failed | disabled
  transcript_status text not null default 'queued',
  transcript_error  text,
  view_count        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index recordings_owner_idx on recordings(owner_id, created_at desc) where deleted_at is null;
create index recordings_folder_idx on recordings(folder_id) where deleted_at is null;

create table uploads (
  id            uuid primary key,
  recording_id  uuid not null unique references recordings(id) on delete cascade,
  owner_id      uuid not null references users(id) on delete cascade,
  mime_type     text not null,
  status        text not null default 'open' check (status in ('open','finalized')),
  chunk_count   integer,                              -- set at finalize
  total_bytes   bigint,
  created_at    timestamptz not null default now(),
  finalized_at  timestamptz
);

create table upload_chunks (
  upload_id   uuid not null references uploads(id) on delete cascade,
  idx         integer not null check (idx >= 0),
  size_bytes  bigint not null check (size_bytes > 0),
  created_at  timestamptz not null default now(),
  primary key (upload_id, idx)
);

create table jobs (
  id            bigserial primary key,
  kind          text not null,                        -- process | transcribe | thumbnail
  recording_id  uuid not null references recordings(id) on delete cascade,
  payload       jsonb not null default '{}',
  status        text not null default 'queued' check (status in ('queued','running','done','failed')),
  attempts      integer not null default 0,
  max_attempts  integer not null default 5,
  run_at        timestamptz not null default now(),
  locked_at     timestamptz,
  last_error    text,
  dedupe_key    text,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index jobs_claim_idx on jobs(run_at) where status = 'queued';
create unique index jobs_dedupe_idx on jobs(dedupe_key) where dedupe_key is not null and status in ('queued','running');

create table transcript_segments (
  id            bigserial primary key,
  recording_id  uuid not null references recordings(id) on delete cascade,
  idx           integer not null,
  start_ms      integer not null,                     -- on the SOURCE timeline
  end_ms        integer not null,
  text          text not null,
  tsv           tsvector generated always as (to_tsvector('english', text)) stored,
  unique (recording_id, idx)
);
create index transcript_tsv_idx on transcript_segments using gin(tsv);

create table share_links (
  id              uuid primary key default gen_random_uuid(),
  recording_id    uuid not null references recordings(id) on delete cascade,
  token_hash      text not null unique,               -- sha256 of the token, used for lookup
  token_enc       text not null,                      -- AES-256-GCM(token) so the owner can re-copy the link; key derives from APP_SECRET
  allow_download  boolean not null default false,
  allow_comments  boolean not null default true,
  created_by      uuid not null references users(id),
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz
);
create index share_links_recording_idx on share_links(recording_id);

create table comments (
  id            uuid primary key default gen_random_uuid(),
  recording_id  uuid not null references recordings(id) on delete cascade,
  parent_id     uuid references comments(id) on delete cascade,
  author_id     uuid references users(id) on delete set null,   -- verified account, if signed in
  guest_name    text,                                            -- unverified display name for guests
  viewer_id     text,
  at_source_ms  integer not null check (at_source_ms >= 0),      -- anchored on the SOURCE timeline
  body          text not null check (length(body) between 1 and 4000),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index comments_recording_idx on comments(recording_id, at_source_ms) where deleted_at is null;

create table view_sessions (
  session_id    uuid primary key,                     -- one per player page load
  recording_id  uuid not null references recordings(id) on delete cascade,
  viewer_id     text not null,                        -- first-party cookie, per browser
  watched_ms    integer not null default 0,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  counted_at    timestamptz
);
create index view_sessions_viewer_idx on view_sessions(recording_id, viewer_id, counted_at);
