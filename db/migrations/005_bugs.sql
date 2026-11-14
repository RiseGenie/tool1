create table bug_reports (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references users(id) on delete cascade,
  recording_id   uuid references recordings(id) on delete set null,
  title          text not null default '' check (length(title) <= 200),
  steps          text not null default '' check (length(steps) <= 8000),
  expected       text not null default '' check (length(expected) <= 2000),
  actual         text not null default '' check (length(actual) <= 2000),
  severity       text not null default 'normal' check (severity in ('low','normal','high','blocker')),
  diagnostics    jsonb not null default '{}'::jsonb,     -- ONLY the items the author chose to include (allow-listed keys)
  include_link   boolean not null default false,         -- explicit opt-in to create a public viewing link
  status         text not null default 'draft' check (status in ('draft','submitting','submitted','failed')),
  tracker        text,
  tracker_ref    text,
  tracker_error  text,
  submitted_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index bug_reports_owner_idx on bug_reports(owner_id, created_at desc);

create table bug_attachments (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references bug_reports(id) on delete cascade,
  filename     text not null,
  mime_type    text not null,
  size_bytes   bigint not null,
  storage_key  text not null,
  created_at   timestamptz not null default now()
);
create index bug_attachments_report_idx on bug_attachments(report_id);
