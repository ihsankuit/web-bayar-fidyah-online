import type { LandingContent } from "@/lib/database.types";
import { DEFAULT_FIDYAH_RATE_SEN } from "@/lib/fidyah";

/** Fallback landing page content, used before any admin edits are saved. */
export const DEFAULT_LANDING: LandingContent = {
  hero_badge: "Bayar Fidyah Secara Dalam Talian",
  hero_title: "Tunaikan Fidyah Anda dengan Mudah & Selamat",
  hero_subtitle:
    "Selesaikan tanggungan fidyah puasa anda dalam beberapa minit sahaja. Kiraan automatik, pembayaran selamat melalui FPX & kad, dan resit terus ke emel anda.",
  hero_cta: "Bayar Fidyah Sekarang",
  about_title: "Apa itu Fidyah?",
  about_body:
    "Fidyah ialah bayaran denda yang wajib ditunaikan oleh golongan tertentu yang meninggalkan puasa Ramadan dan tidak mampu menggantikannya (qada'). Ia dibayar dalam bentuk makanan asasi — secupak beras bagi setiap hari yang ditinggalkan — atau nilai wangnya. Bagi mereka yang melewatkan qada' sehingga masuk Ramadan berikutnya, fidyah akan berganda mengikut bilangan tahun.",
  hukum_title: "Fidyah & Hukumnya",
  hukum_body:
    "Fidyah ialah **denda** ke atas seseorang Islam yang telah baligh kerana meninggalkan puasa wajib atas sebab-sebab tertentu atau pun sengaja melewatkan puasa ganti (qada') bulan Ramadhan.\n\nHukum Fidyah adalah wajib disempurnakan mengikut bilangan hari yang ditinggalkan. Jika tidak ditunaikan akan menjadi tanggungan hutang kepada Allah SWT.",
  hadith_arabic:
    "مَنْ مَاتَ وَعَلَيْهِ صِيَامُ شَهْرٍ فَلْيُطْعِمْ عَنْهُ مَكَانَ كُلِّ يَوْمٍ مِسْكِينًا",
  hadith_meaning:
    "Sesiapa yang mati sedangkan dia masih mempunyai puasa Ramadan, hendaklah diberi makan seorang miskin bagi setiap hari yang ditinggalkannya.",
  hadith_source: "Riwayat al-Tirmizi",
  fidyah_rate_sen: DEFAULT_FIDYAH_RATE_SEN,
  stats: [
    { label: "Pembayar", value: "1,200+" },
    { label: "Jumlah Terkumpul", value: "RM85,000+" },
    { label: "Kadar Sehari", value: "RM2.00" },
  ],
  faqs: [
    {
      question: "Siapa yang wajib membayar fidyah?",
      answer:
        "Golongan warga emas yang uzur, pesakit kronik tanpa harapan sembuh, ibu hamil dan menyusu yang bimbang akan keselamatan, serta mereka yang melewatkan qada' puasa sehingga masuk Ramadan berikutnya.",
    },
    {
      question: "Bagaimana kadar fidyah dikira?",
      answer:
        "Kadar asas ialah nilai secupak beras bagi setiap hari yang ditinggalkan. Jumlah = bilangan hari × kadar sehari × gandaan (jika lewat qada'). Kalkulator di laman ini akan mengira secara automatik.",
    },
    {
      question: "Adakah pembayaran ini selamat?",
      answer:
        "Ya. Semua pembayaran diproses melalui gerbang pembayaran Billplz yang menyokong FPX perbankan internet dan kad kredit/debit. Kami tidak menyimpan maklumat kad anda.",
    },
    {
      question: "Adakah saya menerima resit?",
      answer:
        "Ya. Sebaik sahaja pembayaran berjaya, resit rasmi akan dihantar secara automatik ke alamat emel yang anda berikan.",
    },
    {
      question: "Bolehkah saya membayar bagi pihak orang lain?",
      answer:
        "Boleh. Anda boleh membayar fidyah bagi pihak ahli keluarga atau si mati. Nyatakan nama dan butiran pada borang pembayaran.",
    },
  ],
  footer_note:
    "Platform ini memudahkan pembayaran fidyah secara dalam talian. Sila rujuk pihak berkuasa agama negeri masing-masing untuk kadar rasmi terkini.",
};
