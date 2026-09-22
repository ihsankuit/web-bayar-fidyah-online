-- Google Ads click identifiers for offline conversion import.
-- Safe to run repeatedly (idempotent). Run once in Supabase SQL Editor.
alter table public.donations add column if not exists gclid  text;
alter table public.donations add column if not exists gbraid text;
alter table public.donations add column if not exists wbraid text;
