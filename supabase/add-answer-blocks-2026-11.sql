-- =====================================================================
--  Lead answer blocks for the two highest-intent guides.
--
--  AI Overviews, ChatGPT and Perplexity extract a short, self-contained
--  answer from near the top of a page. Burying the answer under an
--  introduction means the extractor either takes the wrong sentence or
--  skips the page for a competitor that answered plainly.
--
--  Each block is 42-47 words, states the answer outright, and is wrapped
--  in a blockquote so it reads as a distinct answer rather than as the
--  first paragraph of prose.
--
--  Safe to re-run: each UPDATE skips a post that already carries the
--  "Jawapan ringkas:" marker, so running this twice does not stack two
--  blocks on one article.
--
--  Run STEP 1 first and READ the output before STEP 2.
-- =====================================================================


-- ---------------------------------------------------------------------
--  STEP 1 — Read how each article currently opens.
--
--  Check the `opening` column. If an article ALREADY answers the question
--  in its first paragraph, skip it below rather than prepending a second
--  answer that says the same thing twice.
--
--  For kadar-fidyah-2026, also check the rates in its own table. The
--  block below says "sekitar RM4.00 sehari", which matches this site's
--  own calculator default. If the article's state table says otherwise,
--  edit the wording before running STEP 2.
-- ---------------------------------------------------------------------
select
  slug,
  title,
  status,
  left(content, 400) as opening,
  (content like '%Jawapan ringkas:%') as already_has_block
from public.blog_posts
where slug in ('kadar-fidyah-2026', 'cara-bayar-fidyah-online-malaysia')
order by slug;


-- ---------------------------------------------------------------------
--  STEP 2 — Prepend the answer blocks.
-- ---------------------------------------------------------------------

-- Kadar Fidyah 2026 — 42 words.
update public.blog_posts
set content = $md$> **Jawapan ringkas:** Kadar fidyah di Malaysia ialah secupak makanan asasi bagi setiap hari puasa yang ditinggalkan — lazimnya dinilai sekitar **RM4.00 sehari** pada 2026. Kadar sebenar ditetapkan oleh pihak berkuasa agama setiap negeri, jadi ia boleh berbeza sedikit. Jadual penuh mengikut negeri ada di bawah.

$md$ || content
where slug = 'kadar-fidyah-2026'
  and content not like '%Jawapan ringkas:%';

-- Cara Bayar Fidyah Online — 47 words.
update public.blog_posts
set content = $md$> **Jawapan ringkas:** Untuk bayar fidyah online di Malaysia: masukkan bilangan hari puasa yang ditinggalkan dan gandaan tahun kelewatan ke dalam kalkulator, isi nama dan emel, kemudian bayar melalui FPX, kad atau QR. Jumlah dikira automatik pada kadar RM4.00 sehari, dan resit rasmi dihantar ke emel anda sebaik pembayaran selesai.

$md$ || content
where slug = 'cara-bayar-fidyah-online-malaysia'
  and content not like '%Jawapan ringkas:%';


-- ---------------------------------------------------------------------
--  STEP 3 — Confirm.
-- ---------------------------------------------------------------------
select slug, left(content, 220) as opening
from public.blog_posts
where slug in ('kadar-fidyah-2026', 'cara-bayar-fidyah-online-malaysia')
order by slug;


-- ---------------------------------------------------------------------
--  To undo one, strip the block back off:
--
--    update public.blog_posts
--    set content = regexp_replace(content, '^> \*\*Jawapan ringkas:\*\*.*?\n\n', '')
--    where slug = 'kadar-fidyah-2026';
--
--  After running, request indexing for both URLs in Search Console so the
--  new opening is picked up rather than waiting for the next crawl.
-- ---------------------------------------------------------------------
