# Bayar Fidyah Online

Platform pembayaran fidyah puasa secara dalam talian — kalkulator automatik,
pembayaran selamat melalui **CHIP** (FPX & kad), resit emel automatik
melalui **Resend**, dan dashboard pentadbir untuk mengurus sumbangan, blog,
media serta kandungan laman utama.

Dibina dengan **Next.js 16 (App Router)** + **TypeScript** + **Tailwind CSS v4**
+ **shadcn/ui**, dengan pangkalan data **Supabase**. Direka untuk dihoskan di
**Vercel** dengan DNS diurus oleh **Cloudflare**.

---

## Ciri-ciri

| Modul | Keterangan |
| --- | --- |
| **Laman utama** | Hero, kalkulator fidyah, kategori, langkah bayaran, FAQ — semua boleh diedit dari dashboard. |
| **Pembayaran** | Kalkulator hari × kadar × gandaan qada', integrasi CHIP, pengesahan X-Signature. |
| **Resit emel** | Resit rasmi dihantar automatik melalui Resend selepas pembayaran berjaya. |
| **Dashboard** | Statistik sumbangan, senarai pembayar, penapis status. |
| **Blog** | CRUD artikel Markdown, draf/terbit, imej kulit. |
| **Media** | Muat naik imej ke Supabase Storage, salin URL. |
| **Edit laman** | Edit teks hero, tentang, kadar fidyah, statistik & FAQ tanpa sentuh kod. |
| **Auth** | Log masuk pentadbir melalui Supabase Auth; kawasan `/admin` dilindungi. |

## Susun atur teknikal

```
app/
  page.tsx                  Laman utama (server component)
  status/                   Halaman keputusan pembayaran
  blog/                     Blog awam (senarai + [slug])
  admin/
    login/                  Log masuk pentadbir
    (panel)/                Kawasan dilindungi (dashboard, sumbangan, blog, media, laman)
  api/
    fidyah/create/          Cipta rekod + purchase CHIP
    chip/callback/          Webhook X-Signature (server-to-server)
    chip/redirect/          Redirect selepas bayaran (browser)
components/                 UI (shadcn), site/, admin/
lib/                        supabase/, chip, resend, fidyah, settings, content
supabase/schema.sql         Skema DB + RLS + storage bucket
proxy.ts                    Refresh sesi + lindung /admin
```

## Prasyarat

- Node.js 20+
- Akaun [Supabase](https://supabase.com), [CHIP](https://www.chip-in.asia),
  [Resend](https://resend.com), [Vercel](https://vercel.com) dan
  [Cloudflare](https://cloudflare.com).

## 1. Pemasangan tempatan

```bash
npm install
cp .env.example .env.local   # kemudian isi nilai-nilai
npm run dev
```

Buka http://localhost:3000.

> Tanpa pembolehubah persekitaran, laman utama & blog tetap dipaparkan
> (menggunakan kandungan lalai), tetapi pembayaran dan dashboard memerlukan
> Supabase & CHIP dikonfigurasi.

## 2. Supabase

1. Cipta projek Supabase baharu.
2. Di **SQL Editor**, jalankan keseluruhan `supabase/schema.sql`. Ini mencipta
   jadual `donations`, `blog_posts`, `media_assets`, `site_settings`, dasar RLS,
   serta bucket storan `media`.
3. Di **Project Settings → API**, salin:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**rahsia — server sahaja**)
4. Cipta pengguna pentadbir di **Authentication → Users → Add user** (emel +
   kata laluan). Guna kredensial ini untuk log masuk di `/admin/login`.

## 3. CHIP (gerbang pembayaran)

1. Di [Merchant Portal CHIP](https://gate.chip-in.asia), cipta satu **Brand**
   untuk fidyah.
2. Di **Developers**, salin:
   - `Secret Key` → `CHIP_API_KEY`
   - `Brand ID` → `CHIP_BRAND_ID`
3. Untuk ujian, guna kelayakan akaun ujian CHIP (rujuk dashboard CHIP untuk
   mod ujian) — API base URL boleh ditindih dengan `CHIP_BASE_URL` jika perlu.

Aliran pembayaran:
`/api/fidyah/create` → cipta rekod `pending` + purchase CHIP → pengguna bayar
di halaman checkout CHIP → CHIP panggil `/api/chip/callback` (webhook, sahkan
X-Signature, tanda `paid`, hantar resit) dan alihkan pengguna ke
`/api/chip/redirect` (sahkan status semula terus dengan API CHIP sebagai
sandaran kepada webhook) → `/status`.

### Pindahan bank manual (pilihan)

Selain CHIP, pembayar boleh pilih **Pindahan Bank** — pindah terus ke akaun
bank dan muat naik bukti pembayaran. Isi butiran akaun di
**Dashboard → Laman Utama → Pindahan Bank Manual**; kaedah ini tersembunyi di
laman utama selagi No. akaun belum diisi.

Aliran: `/api/fidyah/create` (method `manual`) → cipta rekod `pending` →
pembayar muat naik bukti melalui `/api/fidyah/upload-proof` (disimpan dalam
storan peribadi `payment-proofs`, bukan awam) → pentadbir semak bukti di
**Sumbangan** (butang "Lihat Bukti" — pautan bertandatangan sementara) dan
tekan "Tandakan Dibayar" untuk sahkan secara manual.

## 4. Resend (emel resit)

1. Sahkan domain anda di Resend (atau guna `onboarding@resend.dev` untuk ujian).
2. Salin API key → `RESEND_API_KEY`.
3. Set `RESEND_FROM_EMAIL` kepada penghantar yang disahkan.

## 5. Deploy ke Vercel

1. Push repositori ini ke GitHub dan import ke Vercel (Next.js auto-dikesan).
2. Di **Project Settings → Environment Variables**, masukkan semua nilai dari
   `.env.example` (termasuk `NEXT_PUBLIC_SITE_URL` = domain pengeluaran anda).
3. Set `CRON_SECRET` kepada rentetan rawak (contoh: `openssl rand -hex 32`).
   Vercel Cron (dikonfigurasi dalam `vercel.json`) memanggil
   `/api/cron/expire-pending` setiap jam dengan kunci ini untuk luputkan
   sumbangan `pending` yang ditinggalkan — CHIP selepas 24 jam, pindahan
   manual tanpa bukti selepas 7 hari. Rekod yang sudah ada bukti pembayaran
   tidak sekali-kali diluputkan secara automatik.
4. Deploy.

## 6. Cloudflare DNS

1. Tambah domain anda ke Cloudflare dan tukar nameserver di pendaftar domain.
2. Di Vercel, tambah domain tersuai anda dan ikut arahan DNS.
3. Di Cloudflare, tambah rekod yang diberi Vercel (`A`/`CNAME` untuk apex/`www`).
4. Pastikan `NEXT_PUBLIC_SITE_URL` sepadan dengan domain akhir supaya
   callback/redirect CHIP betul.

## Skrip

```bash
npm run dev     # pembangunan
npm run build   # build pengeluaran
npm run start   # jalankan build pengeluaran
npm run lint    # ESLint
npm run test    # ujian unit (Vitest) — kalkulator fidyah, tandatangan CHIP, dll.
```

## Nota keselamatan

- `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan dalam route handler/webhook server
  dan **tidak pernah** didedahkan ke pelayar.
- Semua callback CHIP disahkan menggunakan tandatangan RSA-SHA256 X-Signature
  terhadap kunci awam syarikat.
- Row Level Security dikuatkuasakan: orang awam hanya boleh membaca artikel
  yang diterbitkan dan tetapan laman; selebihnya memerlukan pentadbir yang
  disahkan.
- Kawasan `/admin` ditanda `noindex, nofollow` dan disekat dalam
  `robots.txt` — tiada pautan awam ke panel admin di mana-mana pun di laman
  utama.
- `/api/fidyah/create` dan `/api/fidyah/upload-proof` (endpoint awam) dihadkan
  kadar (rate-limited) ikut alamat IP untuk elak spam/penyalahgunaan.

## Penafian

Kadar fidyah lalai (RM2.00/hari) hanyalah nilai asas. Sila rujuk pihak berkuasa
agama negeri masing-masing untuk kadar rasmi terkini. Kadar boleh diubah dari
**Dashboard → Laman Utama**.
