-- ============================================================
-- Ugly Studio  ::  Supabase schema
-- Single HQ account. Run this whole file in the Supabase SQL editor.
-- ============================================================

-- ---------- BRAND DNA (single living document) ----------
create table if not exists brand_dna (
  id          int primary key default 1,
  doc         jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint brand_dna_singleton check (id = 1)
);

-- ---------- LIBRARY (every asset we have ever made) ----------
create table if not exists library_items (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  kind         text not null default 'poster',   -- poster | photo | deck | menu | packaging | signage | render | other
  category     text,                              -- free label, e.g. "Summer 2025", "Store Design"
  tags         text[] not null default '{}',
  file_url     text,                              -- public URL in the 'library' storage bucket
  thumb_url    text,
  width        int,
  height       int,
  ai_analysis  text,                              -- Claude Vision notes (style, colors, copy, usage)
  source       text not null default 'upload',    -- upload | studio
  created_at   timestamptz not null default now()
);
create index if not exists library_created_idx on library_items (created_at desc);
create index if not exists library_kind_idx    on library_items (kind);

-- ---------- CREATIONS (studio output: brief -> director -> designer) ----------
create table if not exists creations (
  id            uuid primary key default gen_random_uuid(),
  task_type     text not null default 'poster',   -- poster | social | store_design | interior | menu | packaging | free
  brief         text not null,                    -- what John asked for
  director_out  text,                             -- Claude concept + copy + art direction (json/text)
  image_prompt  text,                             -- final prompt handed to the designer
  image_url     text,                             -- rendered result (creations bucket)
  status        text not null default 'draft',    -- draft | done | saved
  in_library    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists creations_created_idx on creations (created_at desc);

-- ============================================================
-- RLS  ::  single trusted HQ account. Any signed-in user has full access.
-- ============================================================
alter table brand_dna     enable row level security;
alter table library_items enable row level security;
alter table creations     enable row level security;

drop policy if exists dna_all      on brand_dna;
drop policy if exists library_all  on library_items;
drop policy if exists creations_all on creations;

create policy dna_all       on brand_dna     for all to authenticated using (true) with check (true);
create policy library_all   on library_items for all to authenticated using (true) with check (true);
create policy creations_all on creations     for all to authenticated using (true) with check (true);

-- ============================================================
-- STORAGE BUCKETS  (create in Dashboard > Storage, or run below)
-- Public read so images render; writes require auth.
-- ============================================================
insert into storage.buckets (id, name, public) values ('library','library', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('creations','creations', true)
  on conflict (id) do nothing;

drop policy if exists "studio read"  on storage.objects;
drop policy if exists "studio write" on storage.objects;
drop policy if exists "studio del"   on storage.objects;

create policy "studio read"  on storage.objects for select using (bucket_id in ('library','creations'));
create policy "studio write" on storage.objects for insert to authenticated
  with check (bucket_id in ('library','creations'));
create policy "studio del"   on storage.objects for delete to authenticated
  using (bucket_id in ('library','creations'));

-- seed the singleton row (empty; app fills defaults on first load)
insert into brand_dna (id, doc) values (1, '{}'::jsonb) on conflict (id) do nothing;
