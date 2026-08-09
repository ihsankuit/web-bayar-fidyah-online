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
   `/api/cron/expire-pending` sekali sehari (jam 4 pagi waktu Malaysia) dengan
   kunci ini untuk luputkan sumbangan `pending` yang ditinggalkan — CHIP
   selepas 24 jam, pindahan manual tanpa bukti selepas 7 hari. Rekod yang
   sudah ada bukti pembayaran tidak sekali-kali diluputkan secara automatik.
   > Jadual dihadkan sekali sehari kerana pelan **Hobby (percuma)** Vercel
   > tidak membenarkan cron job jalan lebih kerap — jika projek anda di pelan
   > **Pro**, boleh tukar `vercel.json` kepada `"0 * * * *"` untuk semakan
   > setiap jam.
4. Deploy.

## 6. Cloudflare DNS

1. Tambah domain anda ke Cloudflare dan tukar nameserver di pendaftar domain.
2. Di Vercel, tambah domain tersuai anda dan ikut arahan DNS.
3. Di Cloudflare, tambah rekod yang diberi Vercel (`A`/`CNAME` untuk apex/`www`).
4. Pastikan `NEXT_PUBLIC_SITE_URL` sepadan dengan domain akhir supaya
   callback/redirect CHIP betul.

## 7. Analytics & tracking (pilihan)

Sokongan terbina untuk **Google Analytics 4**, **Facebook Pixel** dan
**Facebook Conversions API (CAPI)**. Semua pilihan — jika env id tidak diset,
tiada skrip dimuatkan.

- **GA4 (pelayar)** — set `NEXT_PUBLIC_GA_ID`. `page_view` dijejak automatik
  termasuk navigasi dalam laman.
- **Facebook Pixel (pelayar)** — set `NEXT_PUBLIC_FB_PIXEL_ID`. `PageView`
  dijejak automatik.
- **Peristiwa Purchase** — apabila pembayaran berjaya (halaman `/status`), Pixel
  `Purchase` dan GA4 `purchase` dicetuskan dengan `event_id` = rujukan fidyah.
- **CAPI + GA4 Measurement Protocol (pelayan)** — halaman status memanggil
  `/api/track/purchase`, yang menghantar peristiwa `Purchase` sisi-pelayan.
  Set `FB_CAPI_ACCESS_TOKEN` (dan `GA_API_SECRET` untuk GA4 sisi-pelayan).
  Nilai diambil dari pangkalan data (bukan pelayar) dan hanya untuk sumbangan
  berstatus `paid`. `event_id`/`transaction_id` yang sama memastikan Facebook &
  Google **menyahduplikasi** peristiwa pelayar vs pelayan.
- Untuk uji CAPI, set `FB_TEST_EVENT_CODE` dari Events Manager.

## 8. Automasi: Webhook & REST API (n8n)

### Webhook keluar (laman → n8n)
Set `N8N_WEBHOOK_URL` kepada URL Webhook node n8n anda. Laman akan **POST** JSON
apabila:

| Peristiwa | Bila |
| --- | --- |
| `donation.created` | Sumbangan baharu direkod (belum bayar) |
| `donation.paid` | Pembayaran berjaya disahkan |

Format badan:
```json
{ "event": "donation.paid", "data": { "reference": "FID-...", "amount": 14, "currency": "MYR", "status": "paid", "...": "..." }, "timestamp": "..." }
```
Jika `WEBHOOK_SIGNING_SECRET` diset, header `X-Signature: sha256=<hmac>`
disertakan — sahkan di n8n terhadap badan mentah untuk pastikan keasliannya.

### REST API masuk (n8n → laman)
Set `API_KEY` untuk mengaktifkan. Semua permintaan perlukan
`Authorization: Bearer <API_KEY>` (atau `X-API-Key: <API_KEY>`).

| Endpoint | Keterangan |
| --- | --- |
| `GET /api/v1/donations` | Senarai sumbangan. Query: `status`, `limit` (≤200), `offset`, `from`, `to` |
| `GET /api/v1/donations/{reference}` | Satu sumbangan ikut rujukan |
| `GET /api/v1/stats` | Jumlah terkumpul, kiraan status, pecahan kategori |
| `GET /api/v1/blog` | Senarai artikel blog (semua status). Query: `status`, `limit` (≤200), `offset` |
| `POST /api/v1/blog` | Cipta artikel blog baharu |
| `GET /api/v1/blog/{slug}` | Satu artikel blog |
| `PATCH /api/v1/blog/{slug}` | Kemaskini/terbitkan artikel (sebahagian — hanya field yang dihantar) |
| `DELETE /api/v1/blog/{slug}` | Padam artikel |

Contoh:
```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://bayarfidyahonline.com/api/v1/donations?status=paid&limit=20"
```

> Jika `API_KEY` tidak diset, API dilumpuhkan (semua permintaan → 401).
> Gunakan kunci rahsia yang kuat dan simpan sebagai env var di Vercel sahaja.

Rujukan penuh (semua field, kod ralat, contoh respons): **[public/docs/api-reference.md](public/docs/api-reference.md)**
(dihoskan secara langsung di `/docs/api-reference.md`).
Untuk agen AI/LLM yang perlu panggil API ini secara automatik, guna fail
skill sedia-pakai: **[docs/bayar-fidyah-online-skill/SKILL.md](docs/bayar-fidyah-online-skill/SKILL.md)**.

## 9. Agihan fidyah via WhatsApp (Murpati)

Halaman **Admin > Agihan Fidyah** hantar makluman kemaskini agihan (teks +
gambar pilihan) kepada pembayar yang telah selesai bayar dalam julat tarikh
yang dipilih, melalui WhatsApp (guna [Murpati](https://murpati.com)).

1. Perlukan langganan **Murpati Pro atau Max** (paras percuma/Basic tiada
   akses API).
2. Cipta API Key di [murpati.com/settings](https://murpati.com/settings) →
   tab "API Keys" (dipaparkan sekali sahaja — simpan segera).
3. Sambungkan peranti WhatsApp di
   [murpati.com/devices](https://murpati.com/devices) dan salin **Session
   ID**-nya (peranti mesti berstatus "connected").
4. Isi kedua-dua nilai di **Admin > Integrasi → WhatsApp (Murpati)** — atau
   set env var `MURPATI_API_KEY` / `MURPATI_SESSION_ID` sebagai alternatif.

Setiap penghantaran direkod dalam jadual `fidyah_distributions` (lihat
`supabase/schema.sql`) dan dipaparkan sebagai sejarah di halaman Agihan
Fidyah, serta dicatat dalam Log Aktiviti.

### Susulan pembayaran (follow-up)

Dalam **Admin > Sumbangan**, setiap rekod berstatus *Menunggu* atau *Gagal*
mempunyai butang **Susulan**. Ia membuka dialog untuk mengarang peringatan
kepada pembayar — WhatsApp (Murpati) dan/atau emel (Resend) — dengan teks
yang boleh disunting sebelum hantar.

Teks lalai diurus di **Admin > Notifikasi** (disimpan di bawah kunci
`followup` dalam `site_settings`) dan terpakai untuk semua susulan
seterusnya. Suntingan dalam dialog hanya untuk penghantaran itu sahaja.

Teks menyokong tag pemboleh ubah: `{{nama}}`, `{{rujukan}}`, `{{jumlah}}`,
`{{hari}}`, `{{kategori}}` dan `{{pautan}}`.

`{{pautan}}` menghasilkan `/bayar/<rujukan>` — satu route yang membawa
pembayar terus ke halaman bayaran CHIP. Purchase asal digunakan semula jika
masih boleh dibayar; jika sudah luput, satu purchase baharu dijana automatik
(dan sumbangan berstatus *Gagal* dikembalikan ke *Menunggu*), supaya pautan
susulan tidak pernah membawa ke halaman mati. Bayaran manual pula dihalakan
ke `/status?ref=…` kerana ia tiada checkout CHIP.

Bilangan susulan dan tarikh susulan terakhir disimpan pada rekod sumbangan
(`followup_count`, `last_followup_at`) dan dipaparkan pada butang, supaya
pembayar yang sama tidak dihubungi berulang kali tanpa disedari.

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
