-- =====================================================================
--  Backfill SEO for all existing blog articles
--  Run this ONCE in the Supabase SQL Editor after adding the SEO columns
--  (seo_title / seo_description / seo_keywords) to blog_posts.
--
--  It only fills fields that are currently empty, deriving:
--    - seo_title       from the article title
--    - seo_description from the article excerpt (if any)
--    - seo_keywords    from a sensible default set
--  Re-running is safe (idempotent) — already-filled fields are untouched.
--  Edit any article afterwards in Admin > Blog to fine-tune its SEO.
-- =====================================================================

update public.blog_posts
set
  seo_title = coalesce(nullif(trim(seo_title), ''), title),
  seo_description = coalesce(
    nullif(trim(seo_description), ''),
    nullif(trim(excerpt), '')
  ),
  seo_keywords = coalesce(
    nullif(trim(seo_keywords), ''),
    'fidyah, bayar fidyah online, fidyah puasa, hukum fidyah, kadar fidyah Malaysia, cara kira fidyah'
  )
where
  nullif(trim(seo_title), '') is null
  or nullif(trim(seo_description), '') is null
  or nullif(trim(seo_keywords), '') is null;

-- Check the result:
-- select slug, seo_title, seo_description, seo_keywords from public.blog_posts;
