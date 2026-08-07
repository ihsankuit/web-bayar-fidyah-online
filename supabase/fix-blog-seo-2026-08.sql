-- =====================================================================
--  One-time fix for the 10 blog posts flagged by the SEO audit for
--  overly long <title> tags (post title + " | Bayar Fidyah Online" was
--  exceeding the ~60-char SERP limit on every one of them).
--
--  Titles below are trimmed versions of the EXISTING titles (no new
--  claims added) and stay under 60 chars including the site suffix.
--  Excerpts (used as both the on-page summary and the meta description)
--  are kept under 160 chars and lean on the site's tracked keywords
--  where relevant (e.g. "bayar fidyah online", "fidyah untuk si mati",
--  "qada dan fidyah puasa").
--
--  Only `title` and `excerpt` are touched — slugs (URLs) and article
--  body content are left untouched, so no links break.
--
--  Run this once in the Supabase SQL editor.
-- =====================================================================

update public.blog_posts set
  title = 'Apa Itu Fidyah? Siapa Wajib Bayar',
  excerpt = 'Ketahui maksud fidyah dalam Islam, golongan yang diwajibkan membayarnya, dan cara ia berbeza daripada qada puasa.'
where slug = 'apa-itu-fidyah';

update public.blog_posts set
  title = 'Cara Bayar Fidyah Online di Malaysia',
  excerpt = 'Panduan langkah demi langkah cara bayar fidyah online di Malaysia — pantas, selamat, dan resit terus ke emel anda.'
where slug = 'cara-bayar-fidyah-online-malaysia';

update public.blog_posts set
  title = 'Fidyah Ibu Hamil & Menyusu: Panduan',
  excerpt = 'Panduan lengkap fidyah untuk ibu hamil dan menyusu — bila ia diwajibkan, cara pengiraan, dan cara menunaikannya.'
where slug = 'fidyah-ibu-hamil-menyusu';

update public.blog_posts set
  title = 'Fidyah untuk Si Mati: Panduan Waris',
  excerpt = 'Panduan waris menunaikan fidyah bagi si mati yang meninggalkan puasa — hukum, cara kira, dan cara membayarnya.'
where slug = 'fidyah-untuk-orang-meninggal';

update public.blog_posts set
  title = 'Fidyah untuk Warga Emas & Uzur',
  excerpt = 'Ketahui bila warga emas dan golongan uzur diwajibkan membayar fidyah, serta cara mengira dan menunaikannya.'
where slug = 'fidyah-untuk-warga-emas';

update public.blog_posts set
  title = 'Fidyah vs Qada Puasa: Apa Bezanya',
  excerpt = 'Fidyah dan qada puasa selalu dikelirukan — kenali perbezaannya dan cara menentukan mana yang wajib ke atas anda.'
where slug = 'fidyah-vs-qada';

update public.blog_posts set
  title = '5 Hikmah Disyariatkan Fidyah Puasa',
  excerpt = 'Fahami hikmah di sebalik pensyariatan fidyah dalam Islam bagi golongan yang tidak mampu berpuasa Ramadan.'
where slug = 'hikmah-dikenakan-fidyah';

update public.blog_posts set
  title = 'Kadar Fidyah 2026 di Malaysia',
  excerpt = 'Semak kadar fidyah terkini 2026 di Malaysia dan cara mengira jumlah yang perlu dibayar bagi setiap hari puasa.'
where slug = 'kadar-fidyah-2026';

update public.blog_posts set
  title = 'Panduan Lengkap Fidyah Puasa Ramadan',
  excerpt = 'Panduan lengkap fidyah puasa Ramadan — hukum, syarat wajib, cara kira, niat, dan cara bayar fidyah online.'
where slug = 'panduan-lengkap-fidyah-puasa-ramadan';

update public.blog_posts set
  title = 'Siapa Wajib Bayar Fidyah? 5 Kumpulan',
  excerpt = 'Kenali 5 kumpulan yang diwajibkan membayar fidyah menurut hukum Islam dan syarat yang perlu dipenuhi.'
where slug = 'siapa-wajib-bayar-fidyah';
