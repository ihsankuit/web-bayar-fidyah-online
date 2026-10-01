-- Blog article: "Lewat Qada' Puasa" (a top-earning fidyah category).
-- Run once in Supabase SQL Editor. Idempotent: skips if the slug exists.
-- To tweak later, edit it in Admin -> Blog (re-running won't overwrite edits).
insert into public.blog_posts
  (slug, title, excerpt, content, status, author, published_at,
   seo_title, seo_description, seo_keywords)
values
  (
    'lewat-qada-puasa',
    $md$Lewat Qada' Puasa? Hukum, Fidyah Berganda & Cara Kira$md$,
    $md$Melewatkan qada' puasa sehingga masuk Ramadan berikutnya mewajibkan fidyah — dan jumlahnya berganda setiap tahun. Fahami hukumnya, lihat contoh pengiraan, dan selesaikan tanggungan anda.$md$,
    $md$Ramai yang menyimpan niat untuk mengganti (qada') puasa Ramadan yang ditinggalkan, tetapi melewatkannya tahun demi tahun. Tahukah anda, melewatkan qada' puasa sehingga masuk Ramadan berikutnya bukan sekadar menambah bilangan hari qada' — ia turut mewajibkan **fidyah yang berganda**.

Artikel ini menerangkan hukum lewat qada' puasa, bagaimana fidyah dikira secara berganda, serta cara menyelesaikannya dengan mudah.

## Apa Maksud "Lewat Qada' Puasa"?

Qada' puasa ialah mengganti puasa Ramadan yang ditinggalkan atas sebab yang dibenarkan syarak — seperti sakit, musafir, haid, atau nifas. Islam memberi tempoh yang luas untuk mengqada', iaitu **sehingga sebelum masuk Ramadan tahun berikutnya**.

"Lewat qada'" bermaksud seseorang gagal menghabiskan qada' puasanya sebelum masuk Ramadan berikutnya, tanpa keuzuran yang berterusan.

## Hukum Melewatkan Qada' Puasa

Mengikut pandangan majoriti ulama (termasuk mazhab Syafie yang menjadi pegangan di Malaysia), sesiapa yang melewatkan qada' puasa sehingga masuk Ramadan berikutnya **tanpa uzur** wajib melakukan dua perkara:

1. **Mengqada'** puasa yang ditinggalkan — tanggungan ini tidak gugur; dan
2. **Membayar fidyah** sebanyak secupak (lebih kurang 700 gram) makanan asasi bagi setiap hari yang dilewatkan.

Jika keuzuran berterusan sehingga benar-benar tidak sempat mengqada' (contohnya sakit berpanjangan), fidyah atas kelewatan tidak dikenakan. Rujuk pihak berkuasa agama negeri untuk kes-kes khusus.

## Mengapa Fidyah "Berganda"?

Inilah bahagian yang ramai terlepas pandang. Fidyah kelewatan **bertambah mengikut bilangan tahun** ia dilewatkan.

Setiap kali masuk Ramadan baharu sedangkan qada' masih belum dilangsaikan, satu lagi lapisan fidyah dikenakan bagi setiap hari yang tertunggak. Maka, semakin lama ditangguhkan, semakin besar jumlah yang perlu dibayar.

## Contoh Pengiraan

Katakan Aishah meninggalkan **7 hari** puasa pada Ramadan 2023, dan masih belum mengqada' sehingga tahun 2026 — bermakna telah melepasi **3 kali** Ramadan:

- Kadar fidyah semasa: **RM4.00 sehari**
- Fidyah bagi setahun: 7 hari × RM4.00 = **RM28.00**
- Dilewatkan 3 tahun: RM28.00 × 3 = **RM84.00**

Jumlah fidyah yang perlu dibayar ialah **RM84.00** — dan Aishah **tetap wajib** mengqada' 7 hari puasa tersebut secara berasingan.

## Siapa Yang Terlibat?

- Mereka yang **mampu** berpuasa tetapi menangguhkan qada' sehingga masuk Ramadan berikutnya.
- Golongan yang memang tidak mampu mengqada' selamanya (seperti warga emas uzur atau pesakit kronik) mempunyai hukum fidyah yang berbeza — fidyah dikenakan sebagai ganti puasa, bukan kerana kelewatan.

## Selesaikan Fidyah Anda Sekarang

Jangan biarkan tanggungan ini bertambah setiap tahun. Anda boleh mengira dan membayar fidyah lewat qada' secara dalam talian dalam masa beberapa minit sahaja:

1. Masukkan **bilangan hari** puasa yang ditinggalkan
2. Masukkan **gandaan tahun** kelewatan
3. Jumlah dikira secara automatik, dan resit rasmi dihantar terus ke emel anda

👉 [Kira & bayar fidyah anda sekarang](/#kira)

Baca juga: [Apa Itu Fidyah dan Siapa Yang Wajib Membayarnya?](/blog/apa-itu-fidyah)

---

*Nota: Kadar dan kaedah pengiraan fidyah mungkin berbeza mengikut penetapan pihak berkuasa agama negeri masing-masing. Sila rujuk pejabat agama negeri anda untuk pengesahan rasmi.*$md$,
    'published',
    'Admin',
    now(),
    $md$Lewat Qada' Puasa: Hukum, Fidyah Berganda & Cara Kira$md$,
    $md$Melewatkan qada' puasa sehingga Ramadan berikutnya mewajibkan fidyah yang berganda setiap tahun. Fahami hukum, lihat contoh pengiraan, dan bayar fidyah lewat qada online.$md$,
    $md$lewat qada puasa, qada puasa lewat, fidyah berganda, fidyah lewat qada, hukum lewat qada puasa, cara kira fidyah berganda, fidyah puasa Ramadan, bayar fidyah online$md$
  )
on conflict (slug) do nothing;
