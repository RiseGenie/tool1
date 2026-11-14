-- Supabase exposes the public schema over its REST API with the public anon key. This app talks to Postgres directly
-- (as a privileged role that bypasses RLS), so every table gets RLS enabled with NO policies: the REST API sees nothing.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'schema_migrations' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
alter table if exists public.schema_migrations enable row level security;
