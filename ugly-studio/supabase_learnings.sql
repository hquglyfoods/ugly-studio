-- ============================================================
-- Ugly Studio  ::  learnings (evolving taste memory, per brand)
-- SAFE TO RE-RUN. Upgrades an existing single-brand table in place.
-- Run AFTER supabase_schema.sql.
-- ============================================================

create table if not exists learnings (
  id          uuid primary key default gen_random_uuid(),
  brand       text not null default 'ugly',
  kind        text not null default 'dislike'  check (kind in ('dislike','emphasis','mistake')),
  text        text not null,
  weight      int  not null default 1,
  active      boolean not null default true,
  examples    text[] not null default '{}',
  origin      text not null default 'feedback',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- upgrade path: add brand to an older single-brand learnings table
alter table learnings add column if not exists brand text not null default 'ugly';

-- indexes changed to include brand: drop the old ones (by name) then recreate
drop index if exists learnings_rank_idx;
drop index if exists learnings_text_uniq;
create index if not exists learnings_rank_idx on learnings (brand, active, weight desc, updated_at desc);
create unique index if not exists learnings_text_uniq on learnings (brand, lower(text));

alter table learnings enable row level security;
drop policy if exists learnings_all on learnings;
create policy learnings_all on learnings for all to authenticated using (true) with check (true);

create or replace function reinforce_learning(p_id uuid, p_example text default null)
returns void language sql as $$
  update learnings
     set weight = weight + 1,
         updated_at = now(),
         examples = case when p_example is null or p_example = '' then examples
                         else (array_append(examples, p_example))[greatest(1, array_length(examples,1)+1-5):] end
   where id = p_id;
$$;
