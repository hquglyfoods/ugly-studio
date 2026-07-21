-- ============================================================
-- Ugly Studio  ::  learnings  (the app's evolving taste memory)
-- Run AFTER supabase_schema.sql. Standalone, safe to re-run.
--
-- Captures three things the crew must respect on every job:
--   dislike   = things we do not want to see
--   emphasis  = things we always want carried through
--   mistake   = errors the AI keeps making, so it stops making them
-- weight rises each time the same lesson is reinforced, so repeated
-- corrections harden into rules.
-- ============================================================

create table if not exists learnings (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'dislike'  check (kind in ('dislike','emphasis','mistake')),
  text        text not null,
  weight      int  not null default 1,          -- how many times reinforced
  active      boolean not null default true,
  examples    text[] not null default '{}',     -- short notes / where it came from
  origin      text not null default 'feedback', -- feedback | manual | vision
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists learnings_rank_idx on learnings (active, weight desc, updated_at desc);
create unique index if not exists learnings_text_uniq on learnings (lower(text));

alter table learnings enable row level security;
drop policy if exists learnings_all on learnings;
create policy learnings_all on learnings for all to authenticated using (true) with check (true);

-- bump weight + append an example when the same lesson is reinforced
create or replace function reinforce_learning(p_id uuid, p_example text default null)
returns void language sql as $$
  update learnings
     set weight = weight + 1,
         updated_at = now(),
         examples = case when p_example is null or p_example = '' then examples
                         else (array_append(examples, p_example))[greatest(1, array_length(examples,1)+1-5):] end
   where id = p_id;
$$;
