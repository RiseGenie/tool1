create table video_requests (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references users(id) on delete cascade,   -- submissions are routed to this owner
  title            text not null check (length(title) between 1 and 200),
  instructions     text not null default '' check (length(instructions) <= 2000),
  token_hash       text not null unique,
  token_enc        text not null,
  expires_at       timestamptz not null,
  max_submissions  integer not null default 10 check (max_submissions between 1 and 100),
  allow_screen     boolean not null default true,
  allow_camera     boolean not null default true,
  allow_upload     boolean not null default true,
  folder_id        uuid references folders(id) on delete set null,
  closed_at        timestamptz,
  created_at       timestamptz not null default now()
);
create index video_requests_owner_idx on video_requests(owner_id, created_at desc);

alter table recordings
  add column request_id       uuid references video_requests(id) on delete set null,
  add column submitter_name   text,
  add column submitter_email  text,
  add column submission_kind  text check (submission_kind in ('screen','camera','upload'));
create index recordings_request_idx on recordings(request_id) where request_id is not null;
