-- Server-side conversion guard: set the first time a paid donation's
-- GA4/Facebook server conversion is sent, so it fires exactly once across
-- the CHIP callback, admin confirmation, and the /status page.
-- Safe to run repeatedly (idempotent). Run once in Supabase SQL Editor.
alter table public.donations add column if not exists conversion_sent_at timestamptz;
