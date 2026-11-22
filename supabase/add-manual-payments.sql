-- Manual payments created over the REST API (DuitNow QR / bank transfer
-- handled by the WhatsApp chatbot). Safe to run repeatedly (idempotent).
-- Run once in the Supabase SQL Editor BEFORE using
-- POST /api/v1/donations/manual.

-- 1. Allow the two new payment methods. Drop + re-add so this converges on
--    the current set of values whatever constraint was there before.
alter table public.donations drop constraint if exists donations_payment_method_check;
alter table public.donations add constraint donations_payment_method_check
  check (payment_method in ('chip', 'manual', 'qr', 'bank_transfer'));

-- 2. The caller's idempotency key: unique, so a retry cannot create a duplicate.
alter table public.donations add column if not exists idempotency_key text;
create unique index if not exists donations_idempotency_key_uidx
  on public.donations (idempotency_key)
  where idempotency_key is not null;

-- 3. When the sender says they paid. Not paid_at: that is set only when
--    staff confirm, and used as the paid time then.
alter table public.donations add column if not exists claimed_paid_at timestamptz;
