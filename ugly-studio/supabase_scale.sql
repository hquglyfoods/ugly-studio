-- ============================================================
-- Ugly Studio  ::  scale upgrade
--   1. brand_docs   : absorbed documents live in their own rows, so the brand
--                     record stays small and one upload writes one row.
--   2. studio_jobs  : image rendering runs in a background function, so a long
--                     render can never hit the short request limit.
-- SAFE TO RE-RUN. Run after the other files.
-- ============================================================

create table if not exists brand_docs (
  id           uuid primary key default gen_random_uuid(),
  brand        text not null default 'ugly',
  name         text not null,
  kind         text not null default 'pdf',      -- pdf | html | image | text
  url          text,
  chars        int  not null default 0,
  text         text not null default '',
  absorbed_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists brand_docs_brand_idx on brand_docs (brand, created_at);

alter table brand_docs enable row level security;
drop policy if exists brand_docs_all on brand_docs;
create policy brand_docs_all on brand_docs for all to authenticated using (true) with check (true);

-- a light listing view is not needed, the app selects the columns it wants

create table if not exists studio_jobs (
  id          uuid primary key default gen_random_uuid(),
  brand       text not null default 'ugly',
  kind        text not null default 'image',     -- image
  status      text not null default 'pending',   -- pending | running | done | error
  progress    text not null default '',
  prompt      text not null default '',
  size        text not null default '1024x1024',
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists studio_jobs_recent on studio_jobs (created_at desc);

alter table studio_jobs enable row level security;
drop policy if exists studio_jobs_all on studio_jobs;
create policy studio_jobs_all on studio_jobs for all to authenticated using (true) with check (true);
