-- =====================================================================
--  Bayar Fidyah Online — Supabase schema
--  Run this in the Supabase SQL editor (or via `supabase db push`).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
--  Donations (sumbangan / pembayaran fidyah)
-- ---------------------------------------------------------------------
create table if not exists public.donations (
  id             uuid primary key default gen_random_uuid(),
  reference      text not null unique,
  chip_purchase_id text,
  payment_method text not null default 'chip'
                   check (payment_method in ('chip', 'manual')),
  proof_of_payment_path text,
  payer_name     text not null,
  payer_email    text not null,
  payer_phone    text,
  negeri         text,
  category       text not null,
  days           integer not null default 0,
  multiplier     integer not null default 1,
  rate_sen       integer not null default 200,
  amount_sen     integer not null,
  message        text,
  status         text not null default 'pending'
                   check (status in ('pending', 'paid', 'failed')),
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_term       text,
  utm_content    text
);

create index if not exists donations_status_idx on public.donations (status);
create index if not exists donations_created_at_idx on public.donations (created_at desc);

-- ---------------------------------------------------------------------
--  CHIP payment gateway (replaces Billplz).
--  Run this block if upgrading an existing database. Must run before the
--  chip_purchase_id index below, since the column may not exist yet on an
--  existing table (rename happens here first).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'donations'
      and column_name = 'billplz_bill_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'donations'
      and column_name = 'chip_purchase_id'
  ) then
    alter table public.donations rename column billplz_bill_id to chip_purchase_id;
  end if;
end $$;

alter table public.donations add column if not exists chip_purchase_id text;

create index if not exists donations_chip_purchase_idx on public.donations (chip_purchase_id);

-- ---------------------------------------------------------------------
--  Manual bank transfer (payer uploads proof of payment for admin
--  confirmation), alongside CHIP.
--  Run this block if upgrading an existing database.
--
--  Unconditionally drop + re-add the check constraint (rather than
--  add-and-ignore-if-exists) so upgrading always converges on the current
--  allowed values, even if an older constraint under the same name (e.g.
--  the pre-CHIP 'fpx'/'qr' values) is still sitting on the table.
-- ---------------------------------------------------------------------
alter table public.donations add column if not exists payment_method text not null default 'chip';
alter table public.donations add column if not exists proof_of_payment_path text;

update public.donations
  set payment_method = 'chip'
  where payment_method is null or payment_method not in ('chip', 'manual');

alter table public.donations drop constraint if exists donations_payment_method_check;
alter table public.donations add constraint donations_payment_method_check
  check (payment_method in ('chip', 'manual'));
alter table public.donations alter column payment_method set default 'chip';

-- ---------------------------------------------------------------------
--  UTM attribution (campaign tracking).
--  Run this block if upgrading an existing database.
-- ---------------------------------------------------------------------
alter table public.donations add column if not exists utm_source text;
alter table public.donations add column if not exists utm_medium text;
alter table public.donations add column if not exists utm_campaign text;
alter table public.donations add column if not exists utm_term text;
alter table public.donations add column if not exists utm_content text;

create index if not exists donations_utm_source_idx on public.donations (utm_source);

-- ---------------------------------------------------------------------
--  Blog posts
-- ---------------------------------------------------------------------
create table if not exists public.blog_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  excerpt      text,
  content      text not null default '',
  cover_image  text,
  status       text not null default 'draft'
                 check (status in ('draft', 'published')),
  author       text,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists blog_posts_status_idx on public.blog_posts (status);
create index if not exists blog_posts_published_idx on public.blog_posts (published_at desc);

-- ---------------------------------------------------------------------
--  Media assets (metadata; files live in the `media` storage bucket)
-- ---------------------------------------------------------------------
create table if not exists public.media_assets (
  id           uuid primary key default gen_random_uuid(),
  path         text not null unique,
  url          text not null,
  filename     text not null,
  content_type text,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Site settings (editable landing page content, key/value JSON)
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists blog_posts_touch on public.blog_posts;
create trigger blog_posts_touch before update on public.blog_posts
  for each row execute function public.touch_updated_at();

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- =====================================================================
--  Row Level Security
--  Public site reads published blog posts & landing settings.
--  Everything else requires an authenticated (admin) user.
-- =====================================================================
alter table public.donations     enable row level security;
alter table public.blog_posts    enable row level security;
alter table public.media_assets  enable row level security;
alter table public.site_settings enable row level security;

-- Donations: no public access. Server routes use the service role key
-- (which bypasses RLS). Authenticated admins may read.
drop policy if exists donations_admin_read on public.donations;
create policy donations_admin_read on public.donations
  for select to authenticated using (true);

-- Blog: anyone can read published posts; admins can do everything.
drop policy if exists blog_public_read on public.blog_posts;
create policy blog_public_read on public.blog_posts
  for select to anon, authenticated using (status = 'published');

drop policy if exists blog_admin_all on public.blog_posts;
create policy blog_admin_all on public.blog_posts
  for all to authenticated using (true) with check (true);

-- Media: public read, admin write.
drop policy if exists media_public_read on public.media_assets;
create policy media_public_read on public.media_assets
  for select to anon, authenticated using (true);

drop policy if exists media_admin_all on public.media_assets;
create policy media_admin_all on public.media_assets
  for all to authenticated using (true) with check (true);

-- Settings: public read, admin write.
drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings
  for select to anon, authenticated using (true);

drop policy if exists settings_admin_all on public.site_settings;
create policy settings_admin_all on public.site_settings
  for all to authenticated using (true) with check (true);

-- =====================================================================
--  Storage bucket for media uploads
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');

drop policy if exists "media admin write" on storage.objects;
create policy "media admin write" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media');

-- =====================================================================
--  Storage bucket for manual bank transfer proof-of-payment uploads.
--  Private: payers upload and admins read proofs only via server routes
--  using the service role key (which bypasses RLS), so no anon/authenticated
--  policies are needed here.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- =====================================================================
--  Seed: a couple of published blog posts (optional)
-- =====================================================================
insert into public.blog_posts (slug, title, excerpt, content, status, author, published_at)
values
  (
    'apa-itu-fidyah',
    'Apa Itu Fidyah dan Siapa Yang Wajib Membayarnya?',
    'Fahami maksud fidyah, golongan yang wajib membayarnya, dan cara pengiraannya.',
    E'Fidyah ialah bayaran denda yang wajib ditunaikan oleh golongan tertentu yang meninggalkan puasa Ramadan.\n\n## Golongan yang wajib\n\n- Warga emas yang uzur\n- Pesakit kronik tanpa harapan sembuh\n- Ibu hamil dan menyusu\n- Mereka yang melewatkan qada'' puasa\n\n## Cara pengiraan\n\nKadar asas ialah nilai secupak beras bagi setiap hari yang ditinggalkan.',
    'published',
    'Admin',
    now()
  )
on conflict (slug) do nothing;

-- =====================================================================
--  Gallery (galeri gambar & video)
--  Run this block if upgrading an existing database.
-- =====================================================================
create table if not exists public.gallery_items (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('image', 'video')),
  title        text,
  image_url    text,          -- image source, or a custom video thumbnail
  youtube_id   text,          -- video type: the YouTube video id
  storage_path text,          -- storage object path (uploaded images) for cleanup
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists gallery_sort_idx
  on public.gallery_items (sort_order, created_at desc);

alter table public.gallery_items enable row level security;

drop policy if exists gallery_public_read on public.gallery_items;
create policy gallery_public_read on public.gallery_items
  for select to anon, authenticated using (true);

drop policy if exists gallery_admin_all on public.gallery_items;
create policy gallery_admin_all on public.gallery_items
  for all to authenticated using (true) with check (true);

-- =====================================================================
--  Admin activity log (audit trail for sensitive admin actions)
--  Run this block if upgrading an existing database.
-- =====================================================================
create table if not exists public.admin_activity_log (
  id         uuid primary key default gen_random_uuid(),
  actor      text not null,
  action     text not null,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_log_created_at_idx
  on public.admin_activity_log (created_at desc);

alter table public.admin_activity_log enable row level security;

drop policy if exists admin_activity_log_all on public.admin_activity_log;
create policy admin_activity_log_all on public.admin_activity_log
  for all to authenticated using (true) with check (true);

-- =====================================================================
--  Rate limiting for public endpoints (fidyah/create, fidyah/upload-proof).
--  Accessed only via the service role from server routes — no RLS policies
--  needed, RLS stays enabled with the default deny-all.
--  Run this block if upgrading an existing database.
-- =====================================================================
create table if not exists public.rate_limit_hits (
  id         bigint generated always as identity primary key,
  key        text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_key_created_idx
  on public.rate_limit_hits (key, created_at desc);

alter table public.rate_limit_hits enable row level security;
