-- Agihan updates: public distribution timeline (up to 4 photos + date + place + caption).
-- Safe to run repeatedly (idempotent). Run once in Supabase SQL Editor.
create table if not exists public.agihan_updates (
  id            uuid primary key default gen_random_uuid(),
  title         text,
  location      text,
  caption       text,
  image_urls    text[] not null default '{}',
  storage_paths text[] not null default '{}',
  happened_on   date not null default current_date,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
-- Upgrade path from an earlier single-image version of this table.
alter table public.agihan_updates
  add column if not exists image_urls    text[] not null default '{}',
  add column if not exists storage_paths text[] not null default '{}';
create index if not exists agihan_updates_order_idx
  on public.agihan_updates (happened_on desc, created_at desc);

alter table public.agihan_updates enable row level security;
drop policy if exists agihan_updates_public_read on public.agihan_updates;
create policy agihan_updates_public_read on public.agihan_updates
  for select to anon, authenticated using (true);
drop policy if exists agihan_updates_admin_all on public.agihan_updates;
create policy agihan_updates_admin_all on public.agihan_updates
  for all to authenticated using (true) with check (true);
