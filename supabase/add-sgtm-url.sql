-- Server-side GTM container URL for routing server conversions through sGTM.
-- Safe to run repeatedly (idempotent). Run once in Supabase SQL Editor.
alter table public.integration_settings
  add column if not exists sgtm_url text;
