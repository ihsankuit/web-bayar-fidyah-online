# Bayar Fidyah Online

Platform pembayaran fidyah puasa secara dalam talian — kalkulator automatik,
pembayaran selamat melalui **Billplz** (FPX & kad), resit emel automatik
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
| **Pembayaran** | Kalkulator hari × kadar × gandaan qada', integrasi Billplz, pengesahan X-Signature. |
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
    fidyah/create/          Cipta rekod + bil Billplz
    billplz/callback/       Webhook X-Signature (server-to-server)
    billplz/redirect/       Redirect selepas bayaran (browser)
components/                 UI (shadcn), site/, admin/
lib/                        supabase/, billplz, resend, fidyah, settings, content
supabase/schema.sql         Skema DB + RLS + storage bucket
proxy.ts                    Refresh sesi + lindung /admin
```

## Prasyarat

- Node.js 20+
- Akaun [Supabase](https://supabase.com), [Billplz](https://www.billplz.com),
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
> Supabase & Billplz dikonfigurasi.

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

## 3. Billplz (gerbang pembayaran)

1. Di dashboard Billplz, cipta satu **Collection** untuk fidyah.
2. Di **Settings → API keys**, salin:
   - `Secret Key` → `BILLPLZ_API_KEY`
   - `X Signature Key` → `BILLPLZ_X_SIGNATURE_KEY`
   - `Collection ID` → `BILLPLZ_COLLECTION_ID`
3. Untuk ujian, gunakan akaun [sandbox](https://www.billplz-sandbox.com) dan set
   `BILLPLZ_SANDBOX=true`. Tukar ke `false` untuk pengeluaran.

Aliran pembayaran:
`/api/fidyah/create` → cipta rekod `pending` + bil Billplz → pengguna bayar →
Billplz panggil `/api/billplz/callback` (webhook, sahkan X-Signature, tanda
`paid`, hantar resit) dan alihkan pengguna ke `/api/billplz/redirect` →
`/status`.

## 4. Resend (emel resit)

1. Sahkan domain anda di Resend (atau guna `onboarding@resend.dev` untuk ujian).
2. Salin API key → `RESEND_API_KEY`.
3. Set `RESEND_FROM_EMAIL` kepada penghantar yang disahkan.

## 5. Deploy ke Vercel

1. Push repositori ini ke GitHub dan import ke Vercel (Next.js auto-dikesan).
2. Di **Project Settings → Environment Variables**, masukkan semua nilai dari
   `.env.example` (termasuk `NEXT_PUBLIC_SITE_URL` = domain pengeluaran anda).
3. Deploy.

## 6. Cloudflare DNS

1. Tambah domain anda ke Cloudflare dan tukar nameserver di pendaftar domain.
2. Di Vercel, tambah domain tersuai anda dan ikut arahan DNS.
3. Di Cloudflare, tambah rekod yang diberi Vercel (`A`/`CNAME` untuk apex/`www`).
4. Pastikan `NEXT_PUBLIC_SITE_URL` sepadan dengan domain akhir supaya
   callback/redirect Billplz betul.

## Skrip

```bash
npm run dev     # pembangunan
npm run build   # build pengeluaran
npm run start   # jalankan build pengeluaran
npm run lint    # ESLint
```

## Nota keselamatan

- `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan dalam route handler/webhook server
  dan **tidak pernah** didedahkan ke pelayar.
- Semua callback Billplz disahkan menggunakan HMAC-SHA256 X-Signature.
- Row Level Security dikuatkuasakan: orang awam hanya boleh membaca artikel
  yang diterbitkan dan tetapan laman; selebihnya memerlukan pentadbir yang
  disahkan.

## Penafian

Kadar fidyah lalai (RM2.00/hari) hanyalah nilai asas. Sila rujuk pihak berkuasa
agama negeri masing-masing untuk kadar rasmi terkini. Kadar boleh diubah dari
**Dashboard → Laman Utama**.
