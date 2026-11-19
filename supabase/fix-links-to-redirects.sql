-- =====================================================================
--  Find and fix article links that point at a redirected URL.
--
--  Ahrefs flags "Page has links to redirect". Four of the retired slugs
--  still redirect, so any article body still linking to one sends the
--  reader (and the crawler) through an extra hop, and leaks a little link
--  equity on every pass:
--
--    /blog/orang-meninggal              -> /blog/fidyah-untuk-si-mati
--    /blog/fidyah-untuk-orang-meninggal -> /blog/fidyah-untuk-si-mati
--    /blog/kadar-fidyah-2025            -> /blog/kadar-fidyah-2026
--    /blog/qada-dan-fidyah-puasa        -> /blog/fidyah-vs-qada
--
--  The redirects stay — they are what external links and Google's index
--  still rely on. The point is that OUR OWN links should go straight to
--  the destination.
--
--  Run STEP 1 first to see which articles are affected.
-- =====================================================================


-- ---------------------------------------------------------------------
--  STEP 1 — Which articles link to a redirected slug?
-- ---------------------------------------------------------------------
select
  slug,
  title,
  status,
  (content like '%/blog/orang-meninggal%')              as links_orang_meninggal,
  (content like '%/blog/fidyah-untuk-orang-meninggal%') as links_fidyah_untuk_orang_meninggal,
  (content like '%/blog/kadar-fidyah-2025%')            as links_kadar_2025,
  (content like '%/blog/qada-dan-fidyah-puasa%')        as links_qada_dan_fidyah
from public.blog_posts
where content like '%/blog/orang-meninggal%'
   or content like '%/blog/fidyah-untuk-orang-meninggal%'
   or content like '%/blog/kadar-fidyah-2025%'
   or content like '%/blog/qada-dan-fidyah-puasa%'
order by slug;


-- ---------------------------------------------------------------------
--  STEP 2 — Rewrite them to point straight at the destination.
--
--  Order matters: the longer slug is replaced FIRST, otherwise replacing
--  "/blog/orang-meninggal" would also mangle the middle of
--  "/blog/fidyah-untuk-orang-meninggal" and leave a broken URL behind.
-- ---------------------------------------------------------------------
update public.blog_posts
set content = replace(
  content,
  '/blog/fidyah-untuk-orang-meninggal',
  '/blog/fidyah-untuk-si-mati'
)
where content like '%/blog/fidyah-untuk-orang-meninggal%';

update public.blog_posts
set content = replace(content, '/blog/orang-meninggal', '/blog/fidyah-untuk-si-mati')
where content like '%/blog/orang-meninggal%';

update public.blog_posts
set content = replace(content, '/blog/kadar-fidyah-2025', '/blog/kadar-fidyah-2026')
where content like '%/blog/kadar-fidyah-2025%';

update public.blog_posts
set content = replace(content, '/blog/qada-dan-fidyah-puasa', '/blog/fidyah-vs-qada')
where content like '%/blog/qada-dan-fidyah-puasa%';


-- ---------------------------------------------------------------------
--  STEP 3 — Confirm nothing is left. Should return zero rows.
-- ---------------------------------------------------------------------
select slug, title
from public.blog_posts
where content like '%/blog/orang-meninggal%'
   or content like '%/blog/fidyah-untuk-orang-meninggal%'
   or content like '%/blog/kadar-fidyah-2025%'
   or content like '%/blog/qada-dan-fidyah-puasa%'
order by slug;


-- ---------------------------------------------------------------------
--  Also worth a look while you are here: links to a destination that no
--  longer exists at all. These would be 404s, not redirects.
-- ---------------------------------------------------------------------
-- select p.slug, m.target
-- from public.blog_posts p
-- cross join lateral (
--   select unnest(regexp_matches(p.content, '/blog/([a-z0-9-]+)', 'g')) as target
-- ) m
-- where not exists (
--   select 1 from public.blog_posts q
--   where q.slug = m.target and q.status = 'published'
-- )
-- group by p.slug, m.target
-- order by p.slug;
