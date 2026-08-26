-- =====================================================================
--  Consolidate the duplicate blog articles.
--
--  The sitemap carried three URLs on the same topic (fidyah for someone
--  who has died) and two on the yearly rate. Near-duplicates split the
--  authority a topic earns across several URLs and waste crawl budget,
--  which is why 17 pages sat in Search Console under "Discovered –
--  currently not indexed".
--
--  The code side is already done: /blog/orang-meninggal,
--  /blog/fidyah-untuk-orang-meninggal and /blog/kadar-fidyah-2025 now
--  redirect permanently to the surviving article, and they are excluded
--  from the sitemap and the blog listing (see lib/blog-redirects.ts).
--
--  This script is the database side. It UNPUBLISHES the retired posts
--  rather than deleting them, so nothing is lost and the change is one
--  UPDATE away from being reversed.
--
--  Run STEP 1 first and read the output before running STEP 2.
-- =====================================================================


-- ---------------------------------------------------------------------
--  STEP 1 — Look at what you're about to retire.
--
--  Check the `words` column. The article you KEEP should be the longest
--  and best one. The plan below keeps `fidyah-untuk-si-mati` and
--  `kadar-fidyah-2026`; if one of the others is clearly the better
--  article, see STEP 3 before doing anything else.
-- ---------------------------------------------------------------------
select
  slug,
  title,
  status,
  published_at,
  array_length(regexp_split_to_array(trim(content), '\s+'), 1) as words,
  length(coalesce(seo_title, ''))       as has_seo_title,
  length(coalesce(seo_description, '')) as has_seo_description
from public.blog_posts
where slug in (
  'orang-meninggal',
  'fidyah-untuk-orang-meninggal',
  'fidyah-untuk-si-mati',
  'kadar-fidyah-2025',
  'kadar-fidyah-2026'
)
order by slug;


-- ---------------------------------------------------------------------
--  STEP 2 — Retire the duplicates.
--
--  Carry the SEO title/description onto the surviving article first, but
--  only where it doesn't already have its own — the August SEO pass wrote
--  optimised copy onto `fidyah-untuk-orang-meninggal`, and that work
--  shouldn't be thrown away just because the URL is changing.
-- ---------------------------------------------------------------------
update public.blog_posts as keeper set
  seo_title = coalesce(
    nullif(trim(keeper.seo_title), ''),
    nullif(trim(retired.seo_title), ''),
    nullif(trim(retired.title), '')
  ),
  seo_description = coalesce(
    nullif(trim(keeper.seo_description), ''),
    nullif(trim(retired.seo_description), ''),
    nullif(trim(retired.excerpt), '')
  ),
  seo_keywords = coalesce(
    nullif(trim(keeper.seo_keywords), ''),
    nullif(trim(retired.seo_keywords), '')
  )
from public.blog_posts as retired
where keeper.slug = 'fidyah-untuk-si-mati'
  and retired.slug = 'fidyah-untuk-orang-meninggal';

-- Now take the duplicates out of circulation.
update public.blog_posts
set status = 'draft'
where slug in (
  'orang-meninggal',
  'fidyah-untuk-orang-meninggal',
  'kadar-fidyah-2025'
);

-- Make sure the two survivors are actually published — the redirects
-- above point at them, and a 301 into a 404 is worse than the duplicate.
select slug, status, published_at
from public.blog_posts
where slug in ('fidyah-untuk-si-mati', 'kadar-fidyah-2026');


-- ---------------------------------------------------------------------
--  STEP 3 — Only if STEP 1 showed a different article is the better one.
--
--  Say `fidyah-untuk-orang-meninggal` has the far longer, better body.
--  Move that body onto the surviving slug instead of changing which slug
--  survives — the redirects in lib/blog-redirects.ts already point here,
--  and the URL with the keyword in it is the one worth keeping.
-- ---------------------------------------------------------------------
-- update public.blog_posts as keeper set
--   content    = retired.content,
--   excerpt    = coalesce(retired.excerpt, keeper.excerpt),
--   cover_image = coalesce(retired.cover_image, keeper.cover_image)
-- from public.blog_posts as retired
-- where keeper.slug  = 'fidyah-untuk-si-mati'
--   and retired.slug = 'fidyah-untuk-orang-meninggal';


-- ---------------------------------------------------------------------
--  To undo everything in STEP 2:
--
--    update public.blog_posts set status = 'published'
--    where slug in ('orang-meninggal', 'fidyah-untuk-orang-meninggal',
--                   'kadar-fidyah-2025');
--
--  ...and remove the matching entries from lib/blog-redirects.ts.
-- ---------------------------------------------------------------------
