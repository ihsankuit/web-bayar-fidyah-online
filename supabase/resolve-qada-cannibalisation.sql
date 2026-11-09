-- =====================================================================
--  Consolidate the qada' duplicate.
--
--  Two articles were answering the same question:
--
--    /blog/fidyah-vs-qada          "Fidyah vs Qada Puasa: Apa Bezanya"
--    /blog/qada-dan-fidyah-puasa   (written later, for a keyword gap)
--
--  When two of your own URLs answer one question, Google splits the
--  signals between them and often ranks neither.
--
--  DECISION: keep `fidyah-vs-qada`. Shorter URL, it already carries the
--  optimised seo_title/seo_description from the August SEO pass, and the
--  homepage "Panduan Fidyah" section links to it by name.
--
--  The code side is already deployed: lib/blog-redirects.ts now maps
--  qada-dan-fidyah-puasa -> fidyah-vs-qada, which drives the permanent
--  redirect and drops the retired slug from the sitemap and the blog
--  listing. This script is the database side.
--
--  Run STEP 1 and read it before STEP 2 — it decides one thing for you.
-- =====================================================================


-- ---------------------------------------------------------------------
--  STEP 1 — Compare the two.
--
--  Only one thing to decide here: look at `words`. If
--  `qada-dan-fidyah-puasa` is substantially the longer and better
--  article, run STEP 2a to move its body across before retiring it.
--  Otherwise skip 2a and go straight to 2b.
--
--  Do NOT change which slug survives. The redirect and the homepage link
--  both point at fidyah-vs-qada already.
-- ---------------------------------------------------------------------
select
  slug,
  title,
  status,
  published_at,
  array_length(regexp_split_to_array(trim(content), '\s+'), 1) as words,
  left(content, 500) as opening
from public.blog_posts
where slug in ('fidyah-vs-qada', 'qada-dan-fidyah-puasa')
order by slug;


-- ---------------------------------------------------------------------
--  STEP 2a — ONLY if STEP 1 showed the retired article is the better one.
--  Moves its body onto the surviving slug. Skip this otherwise.
-- ---------------------------------------------------------------------
-- update public.blog_posts as keeper set
--   content     = retired.content,
--   excerpt     = coalesce(retired.excerpt, keeper.excerpt),
--   cover_image = coalesce(retired.cover_image, keeper.cover_image)
-- from public.blog_posts as retired
-- where keeper.slug  = 'fidyah-vs-qada'
--   and retired.slug = 'qada-dan-fidyah-puasa';


-- ---------------------------------------------------------------------
--  STEP 2b — Retire the duplicate.
--
--  Unpublishes rather than deletes, so nothing is lost and one UPDATE
--  reverses it.
-- ---------------------------------------------------------------------
update public.blog_posts
set status = 'draft'
where slug = 'qada-dan-fidyah-puasa';


-- ---------------------------------------------------------------------
--  STEP 3 — Confirm the survivor is still published.
--  A 301 into a 404 is worse than the duplicate was.
-- ---------------------------------------------------------------------
select slug, status, published_at
from public.blog_posts
where slug in ('fidyah-vs-qada', 'qada-dan-fidyah-puasa')
order by slug;

--  Expected: fidyah-vs-qada = published, qada-dan-fidyah-puasa = draft.
--  If fidyah-vs-qada is NOT published, publish it before the redirect
--  reaches production:
--
--    update public.blog_posts set status = 'published', published_at = now()
--    where slug = 'fidyah-vs-qada';


-- ---------------------------------------------------------------------
--  To undo:
--
--    update public.blog_posts set status = 'published'
--    where slug = 'qada-dan-fidyah-puasa';
--
--  ...and remove the "qada-dan-fidyah-puasa" line from
--  lib/blog-redirects.ts, otherwise the URL keeps redirecting.
-- ---------------------------------------------------------------------
