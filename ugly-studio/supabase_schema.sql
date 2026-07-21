-- ============================================================
-- Ugly Studio  ::  Supabase schema (multi-brand: ugly + umma)
-- SAFE TO RE-RUN. Upgrades an existing single-brand DB in place,
-- and also works on a fresh project. No data is deleted.
-- Run this whole file in the Supabase SQL editor.
-- ============================================================

-- ---------- BRAND DNA (one living document per brand) ----------
create table if not exists brand_dna (
  brand       text primary key,           -- 'ugly' | 'umma'
  doc         jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
-- upgrade path: older brand_dna used a singleton "id" instead of "brand"
do $$
begin
  if exists (select 1 from information_schema.columns where table_name='brand_dna' and column_name='id')
     and not exists (select 1 from information_schema.columns where table_name='brand_dna' and column_name='brand') then
    alter table brand_dna add column brand text;
    update brand_dna set brand = 'ugly' where brand is null;
    alter table brand_dna drop constraint if exists brand_dna_singleton;
    alter table brand_dna drop constraint if exists brand_dna_pkey;
    alter table brand_dna alter column brand set not null;
    alter table brand_dna add primary key (brand);
    alter table brand_dna drop column if exists id;
  end if;
end $$;

-- ---------- LIBRARY (per brand) ----------
create table if not exists library_items (
  id           uuid primary key default gen_random_uuid(),
  brand        text not null default 'ugly',
  title        text not null,
  kind         text not null default 'poster',
  category     text,
  tags         text[] not null default '{}',
  file_url     text,
  thumb_url    text,
  width        int,
  height       int,
  ai_analysis  text,
  source       text not null default 'upload',
  created_at   timestamptz not null default now()
);
alter table library_items add column if not exists brand text not null default 'ugly';
drop index if exists library_kind_idx;
create index if not exists library_brand_idx on library_items (brand, created_at desc);
create index if not exists library_kind_idx  on library_items (brand, kind);

-- ---------- CREATIONS (per brand) ----------
create table if not exists creations (
  id            uuid primary key default gen_random_uuid(),
  brand         text not null default 'ugly',
  task_type     text not null default 'poster',
  brief         text not null,
  director_out  text,
  image_prompt  text,
  image_url     text,
  status        text not null default 'draft',
  in_library    boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table creations add column if not exists brand text not null default 'ugly';
create index if not exists creations_brand_idx on creations (brand, created_at desc);

-- ============================================================
-- RLS  ::  single trusted HQ account. Any signed-in user has full access.
-- ============================================================
alter table brand_dna     enable row level security;
alter table library_items enable row level security;
alter table creations     enable row level security;

drop policy if exists dna_all       on brand_dna;
drop policy if exists library_all   on library_items;
drop policy if exists creations_all on creations;

create policy dna_all       on brand_dna     for all to authenticated using (true) with check (true);
create policy library_all   on library_items for all to authenticated using (true) with check (true);
create policy creations_all on creations     for all to authenticated using (true) with check (true);

-- ============================================================
-- STORAGE BUCKETS  (public read; writes require auth). Files stored under brand/ prefix.
-- ============================================================
insert into storage.buckets (id, name, public) values ('library','library', true)   on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('creations','creations', true) on conflict (id) do nothing;

drop policy if exists "studio read"  on storage.objects;
drop policy if exists "studio write" on storage.objects;
drop policy if exists "studio del"   on storage.objects;

create policy "studio read"  on storage.objects for select using (bucket_id in ('library','creations'));
create policy "studio write" on storage.objects for insert to authenticated with check (bucket_id in ('library','creations'));
create policy "studio del"   on storage.objects for delete to authenticated using (bucket_id in ('library','creations'));

-- seed both brand rows (empty; the app fills sensible defaults on first load)
insert into brand_dna (brand, doc) values ('ugly','{}'::jsonb) on conflict (brand) do nothing;
insert into brand_dna (brand, doc) values ('umma','{}'::jsonb) on conflict (brand) do nothing;
