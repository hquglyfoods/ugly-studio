-- ============================================================
-- Ugly Studio  ::  push notifications
-- Run after supabase_schema.sql. Standalone, safe to re-run.
-- ============================================================
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  ua          text,
  created_at  timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
drop policy if exists push_all on push_subscriptions;
-- signed-in HQ device can register/read/remove its own subscriptions;
-- the sender function uses the service key and bypasses RLS.
create policy push_all on push_subscriptions for all to authenticated using (true) with check (true);
