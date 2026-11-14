-- Phase 2: versions, review decisions, privacy edits

alter table recordings
  add column series_id         uuid,
  add column version_no        integer not null default 1,
  add column is_draft          boolean not null default false,   -- unpublished replacement version
  add column locked_at         timestamptz,                      -- set on first review decision: content is now frozen
  add column parent_version_id uuid references recordings(id) on delete set null,
  add column version_label     text,
  add column redactions        jsonb not null default '{}'::jsonb;
update recordings set series_id = id;
alter table recordings alter column series_id set not null;
create index recordings_series_idx on recordings(series_id, version_no);

create function recordings_default_series() returns trigger language plpgsql as $$
begin
  if new.series_id is null then new.series_id := new.id; end if;
  return new;
end $$;
-- BEFORE INSERT cannot see NOT NULL violation first because the trigger fills the value in
alter table recordings alter column series_id drop not null;
create trigger recordings_series_trg before insert on recordings for each row execute function recordings_default_series();
alter table recordings add constraint recordings_series_nn check (series_id is not null) not valid;

alter table comments
  add column kind        text not null default 'comment' check (kind in ('comment','change_request')),
  add column resolved_at timestamptz;

create table review_decisions (
  id               uuid primary key default gen_random_uuid(),
  recording_id     uuid not null references recordings(id) on delete cascade,   -- the exact version reviewed
  revision         integer not null,                                           -- render revision at decision time
  decision         text not null check (decision in ('approved','changes_requested')),
  reviewer_user_id uuid references users(id) on delete set null,
  reviewer_name    text not null,
  reviewer_email   text,
  verified         boolean not null default false,   -- true only when the reviewer was signed in
  note             text,
  created_at       timestamptz not null default now()
);
create index review_decisions_rec_idx on review_decisions(recording_id, created_at);
