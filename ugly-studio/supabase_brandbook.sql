-- ============================================================
-- Ugly Studio  ::  brand book jobs (accurate full-book reading in the background)
-- Run after supabase_schema.sql. Standalone, safe to re-run.
-- A background function reads the whole book with the accurate model (no 10s wall);
-- the app polls this table for progress and the final result.
-- ============================================================
create table if not exists brandbook_jobs (
  id          uuid primary key default gen_random_uuid(),
  brand       text not null default 'ugly',
  status      text not null default 'pending',  -- pending | running | done | error
  progress    text not null default '',
  kind        text,                             -- pdf | html | image
  pages       jsonb not null default '[]'::jsonb, -- public image URLs (pdf/image)
  book_text   text not null default '',         -- extracted text layer (pdf/html)
  result      jsonb,                            -- final DNA doc
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists brandbook_jobs_recent on brandbook_jobs (created_at desc);

alter table brandbook_jobs enable row level security;
drop policy if exists brandbook_jobs_all on brandbook_jobs;
-- the signed-in HQ account creates and polls jobs; the background function uses the service key.
create policy brandbook_jobs_all on brandbook_jobs for all to authenticated using (true) with check (true);
