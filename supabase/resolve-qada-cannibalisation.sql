-- =====================================================================
--  Resolve the qada' keyword cannibalisation.
--
--  Two articles sit on nearly the same query:
--
--    /blog/fidyah-vs-qada          "Fidyah vs Qada Puasa: Apa Bezanya"
--    /blog/qada-dan-fidyah-puasa   (written later, for a keyword gap)
--
--  When two of your own URLs answer one question, Google splits the
--  signals between them and often ranks neither. This is the last known
--  duplicate pair after the August consolidation handled the "si mati"
--  cluster and the 2025/2026 rate pages.
--
--  This script does NOT decide for you. STEP 1 shows both articles side
--  by side; you read them, then run STEP 2 only if they really overlap.
-- =====================================================================


-- ---------------------------------------------------------------------
--  STEP 1 — Compare the two. READ THIS BEFORE RUNNING ANYTHING ELSE.
-- ---------------------------------------------------------------------
select
  slug,
  title,
  status,
  published_at,
  array_length(regexp_split_to_array(trim(content), '\s+'), 1) as words,
  seo_keywords,
  left(content, 500) as opening
from public.blog_posts
where slug in ('fidyah-vs-qada', 'qada-dan-fidyah-puasa')
order by slug;


-- ---------------------------------------------------------------------
--  HOW TO DECIDE
--
--  They cannibalise if BOTH articles are mainly answering "what is the
--  difference between fidyah and qada". In that case consolidate.
--
--  They do NOT cannibalise if one explains the difference while the other
--  covers something genuinely distinct — for example how to pay for both
--  at once, or the ruling on delaying qada'. In that case leave both
--  published and instead make their titles and H1s clearly different, so
--  Google can tell them apart.
--
--  IF CONSOLIDATING, KEEP `fidyah-vs-qada`. Three reasons:
--    1. Shorter, cleaner URL.
--    2. It already carries optimised seo_title/seo_description from the
--       August SEO pass.
--    3. The new homepage "Panduan Fidyah" section links to it by name.
--       Retiring it instead would waste that internal link.
--
--  If STEP 1 shows `qada-dan-fidyah-puasa` is the far better article,
--  do NOT flip which slug survives — move its body onto `fidyah-vs-qada`
--  (STEP 2b) so the surviving URL keeps the links pointing at it.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
--  STEP 2a — Consolidate: retire the duplicate.
--
--  Unpublishes rather than deletes, so nothing is lost and one UPDATE
--  reverses it.
--
--  !! A CODE CHANGE MUST SHIP WITH THIS !!
--  Add this line to BLOG_REDIRECTS in lib/blog-redirects.ts and deploy,
--  otherwise the retired URL becomes a 404 instead of passing its
--  ranking signals to the survivor:
--
--      "qada-dan-fidyah-puasa": "fidyah-vs-qada",
--
--  That map also drives the sitemap and the blog listing, so adding the
--  line is all that is needed — nothing else references the slug.
-- ---------------------------------------------------------------------
-- update public.blog_posts
-- set status = 'draft'
-- where slug = 'qada-dan-fidyah-puasa';


-- ---------------------------------------------------------------------
--  STEP 2b — ONLY if STEP 1 showed the retired article is the better one.
--  Moves its body onto the surviving slug first.
-- ---------------------------------------------------------------------
-- update public.blog_posts as keeper set
--   content     = retired.content,
--   excerpt     = coalesce(retired.excerpt, keeper.excerpt),
--   cover_image = coalesce(retired.cover_image, keeper.cover_image)
-- from public.blog_posts as retired
-- where keeper.slug  = 'fidyah-vs-qada'
--   and retired.slug = 'qada-dan-fidyah-puasa';


-- ---------------------------------------------------------------------
--  STEP 3 — Confirm the survivor is still published before you deploy
--  the redirect. A 301 into a 404 is worse than the duplicate was.
-- ---------------------------------------------------------------------
select slug, status, published_at
from public.blog_posts
where slug = 'fidyah-vs-qada';


-- ---------------------------------------------------------------------
--  To undo STEP 2a:
--
--    update public.blog_posts set status = 'published'
--    where slug = 'qada-dan-fidyah-puasa';
--
--  ...and remove the matching line from lib/blog-redirects.ts.
-- ---------------------------------------------------------------------
