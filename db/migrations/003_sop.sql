create table sops (
  id                      uuid primary key default gen_random_uuid(),
  recording_id            uuid not null unique references recordings(id) on delete cascade,   -- one SOP per version
  owner_id                uuid not null references users(id) on delete cascade,
  title                   text not null,
  status                  text not null default 'generating' check (status in ('generating','draft','failed')),
  error                   text,
  generator               text,                       -- which generator produced the draft (transparency in the UI)
  generation              integer not null default 1, -- bumps on regenerate
  generated_from_revision integer,
  reviewed_at             timestamptz,                -- author sign-off; export is blocked until set; any edit clears it
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table sop_steps (
  id             uuid primary key default gen_random_uuid(),
  sop_id         uuid not null references sops(id) on delete cascade,
  idx            integer not null,
  title          text not null check (length(title) between 1 and 200),
  body           text not null default '' check (length(body) <= 4000),
  at_ms          integer not null check (at_ms >= 0),   -- moment in the EDITED (published) timeline of the version
  screenshot_key text,
  edited         boolean not null default false
);
create index sop_steps_sop_idx on sop_steps(sop_id, idx);
