-- Blog article: "Beza Fidyah dan Kaffarah" — a keyword with zero coverage on
-- the site today (the homepage never says the word "kaffarah" once) and low
-- competition in Malay.
--
-- Seeded as DRAFT on purpose. This is fiqh published under the charity's
-- name; it should be read by whoever reviews religious content before it
-- goes live. To publish, either flip it in Admin -> Blog, or run:
--
--   update public.blog_posts set status = 'published', published_at = now()
--   where slug = 'beza-fidyah-dan-kaffarah';
--
-- Run once in Supabase SQL Editor. Idempotent: skips if the slug exists.
-- To tweak later, edit it in Admin -> Blog (re-running won't overwrite edits).
insert into public.blog_posts
  (slug, title, excerpt, content, status, author, published_at,
   seo_title, seo_description, seo_keywords)
values
  (
    'beza-fidyah-dan-kaffarah',
    $md$Beza Fidyah dan Kaffarah: Jangan Keliru$md$,
    $md$Fidyah dan kaffarah kedua-duanya "denda" dalam bahasa harian, tetapi puncanya berbeza dan bayarannya jauh berbeza. Kenali mana satu yang sebenarnya wajib ke atas anda.$md$,
    $md$Dalam perbualan harian, kedua-dua **fidyah** dan **kaffarah** sering disebut sebagai "denda puasa". Hakikatnya keduanya berbeza sama sekali — berbeza puncanya, berbeza caranya, dan berbeza jumlahnya.

Kekeliruan ini bukan perkara kecil. Seseorang yang sepatutnya membayar fidyah RM4.00 sehari mungkin menyangka dia terhutang kaffarah yang jauh lebih berat, atau sebaliknya. Artikel ini menjelaskan bezanya dengan ringkas.

## Jawapan Ringkas

**Fidyah** ialah bayaran ganti kerana *tidak berpuasa* atas sebab yang dibenarkan, atau kerana *melewatkan qada'*. Kadarnya secupak makanan asasi bagi setiap hari — di Malaysia lazimnya dinilai sekitar **RM4.00 sehari**.

**Kaffarah** ialah denda berat kerana *membatalkan* puasa Ramadan dengan cara yang diharamkan. Dalam mazhab Syafie, ia dikenakan secara khusus kerana melakukan **persetubuhan pada siang hari Ramadan** ketika sedang berpuasa. Bayarannya bukan wang harian, tetapi berpuasa **dua bulan berturut-turut**, atau memberi makan **60 orang miskin**.

## Perbandingan Ringkas

| | Fidyah | Kaffarah |
|---|---|---|
| **Punca** | Tidak mampu berpuasa, atau lewat qada' | Membatalkan puasa Ramadan secara haram |
| **Siapa** | Warga emas, pesakit kronik, ibu hamil & menyusu, waris si mati, mereka yang lewat qada' | Orang yang bersetubuh pada siang Ramadan ketika berpuasa |
| **Bayaran** | Secupak makanan (± 700g) bagi setiap hari | Puasa 2 bulan berturut-turut, atau beri makan 60 orang miskin |
| **Kadar wang** | Lebih kurang RM4.00 sehari | Tiada kadar harian — ikut turutan di atas |
| **Qada' masih wajib?** | Bergantung kes | Ya, tetap wajib qada' hari tersebut |

## Apa Itu Fidyah?

Fidyah ialah bayaran gantian bagi puasa yang ditinggalkan, dalam bentuk memberi makan orang miskin. Ia dikenakan ke atas:

- **Warga emas dan pesakit kronik** yang tidak mampu berpuasa dan tidak dijangka pulih
- **Ibu hamil dan menyusu** dalam keadaan tertentu
- **Mereka yang melewatkan qada'** sehingga masuk Ramadan berikutnya
- **Waris si mati** yang meninggalkan puasa

Bacaan lanjut: [Apa Itu Fidyah dan Siapa Yang Wajib Membayarnya?](/blog/apa-itu-fidyah)

## Apa Itu Kaffarah?

Kaffarah (kadangkala dieja *kifarah*) ialah denda yang jauh lebih berat, dikenakan kerana satu kesalahan yang spesifik.

Mengikut mazhab Syafie — pegangan rasmi di Malaysia — kaffarah puasa dikenakan ke atas **lelaki yang melakukan persetubuhan pada siang hari Ramadan sedangkan dia sedang berpuasa**. Turutan bayarannya adalah tertib, bukan pilihan bebas:

1. Memerdekakan seorang hamba *(tidak lagi terpakai pada zaman ini)*
2. Jika tidak mampu — berpuasa **dua bulan berturut-turut** tanpa putus
3. Jika tidak mampu juga — memberi makan **60 orang miskin**

Kaffarah ini **tidak menggantikan** qada'. Hari puasa yang dibatalkan itu tetap wajib diganti berasingan.

## Kesilapan Paling Biasa

Ramai menyangka setiap pembatalan puasa Ramadan mewajibkan kaffarah. Itu tidak tepat.

Dalam mazhab Syafie, sesiapa yang membatalkan puasa dengan **makan atau minum** secara sengaja berdosa dan **wajib mengqada'**, tetapi **tidak dikenakan kaffarah**. Kaffarah khusus kepada persetubuhan sahaja.

Begitu juga sebaliknya: orang yang tidak berpuasa kerana sakit atau uzur **tidak** terkena kaffarah langsung. Yang terpakai kepada mereka ialah fidyah, atau qada', mengikut keadaan.

## Tiga Situasi Sebagai Panduan

**Pak Samad, 78 tahun, pesakit buah pinggang.** Tidak mampu berpuasa dan tidak dijangka pulih. → **Fidyah**, bagi setiap hari Ramadan yang ditinggalkan. Tiada qada', tiada kaffarah.

**Nurul meninggalkan 5 hari puasa kerana haid, belum qada' sehingga Ramadan berikutnya.** → **Qada' 5 hari**, *dan* **fidyah** kerana kelewatan. Tiada kaffarah.

**Seseorang yang sengaja makan tengah hari Ramadan tanpa keuzuran.** → Berdosa dan **wajib qada'**. Dalam mazhab Syafie, **tiada kaffarah**.

## Jika Anda Masih Tidak Pasti

Kes kaffarah selalunya melibatkan butiran peribadi dan perlu penilaian khusus. Jika anda rasa ia mungkin terpakai ke atas anda, rujuk **pejabat mufti atau jabatan agama negeri** anda secara terus. Jangan bergantung kepada artikel — termasuk artikel ini — untuk menentukan kes kaffarah.

Bagi fidyah pula, pengiraannya mudah dan boleh diselesaikan sendiri dalam beberapa minit.

## Penting: Laman Ini Untuk Fidyah Sahaja

Platform ini mengendalikan **pembayaran fidyah** sahaja. Kami tidak mengutip atau menguruskan kaffarah, kerana kaffarah bukan bayaran harian yang boleh dikira secara automatik — ia memerlukan penilaian kes demi kes oleh pihak berkuasa agama.

Jika yang terpakai ke atas anda ialah fidyah, anda boleh selesaikannya sekarang:

👉 [Kira & bayar fidyah anda sekarang](/#kira)

Baca juga: [Beza Fidyah dan Qada Puasa](/blog/fidyah-vs-qada)

---

*Nota: Artikel ini disusun mengikut pandangan mazhab Syafie yang menjadi pegangan rasmi di Malaysia. Hukum dan kadar mungkin berbeza mengikut penetapan pihak berkuasa agama negeri masing-masing. Sila rujuk pejabat agama negeri anda untuk pengesahan rasmi, terutamanya bagi kes kaffarah.*$md$,
    'draft',
    'Admin',
    null,
    $md$Beza Fidyah dan Kaffarah: Panduan Ringkas$md$,
    $md$Fidyah dikenakan kerana tidak berpuasa atau lewat qada'. Kaffarah pula denda berat kerana membatalkan puasa Ramadan. Kenali bezanya dan mana satu wajib ke atas anda.$md$,
    $md$beza fidyah dan kaffarah, fidyah vs kaffarah, kaffarah puasa, kifarah puasa, perbezaan fidyah dan kaffarah, kaffarah Ramadan, hukum kaffarah puasa, denda puasa Ramadan, fidyah atau kaffarah$md$
  )
on conflict (slug) do nothing;
