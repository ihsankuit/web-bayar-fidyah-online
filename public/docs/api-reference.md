# Bayar Fidyah Online — Developer / API Reference

This document is for developers integrating with **bayarfidyahonline.com** —
reading donation data, receiving payment events, or building automations
(n8n, spreadsheets, dashboards, chatbots, etc.).

There are two integration surfaces:

1. **REST API** (pull) — query donations and aggregate stats on demand.
2. **Outbound webhooks** (push) — get notified the moment a donation is
   created or paid.

Both are configured from **Dashboard → Integrasi** in the admin panel.

---

## 1. REST API

### Base URL

```
https://bayarfidyahonline.com/api/v1
```

### Authentication

Every request requires an API key, sent as either:

```
Authorization: Bearer <API_KEY>
```

or

```
X-API-Key: <API_KEY>
```

Get the key from **Dashboard → Integrasi → REST API Key** (or set the
`API_KEY` environment variable on the server as a fallback). If no key is
configured, the API is disabled and every request returns `401`.

Comparison is constant-time (HMAC-safe), so there's no timing side-channel
on the key.

### Rate limits

Per client IP, sliding window:

| Endpoint | Limit |
| --- | --- |
| `GET /donations` | 120 requests / 60s |
| `GET /donations/{reference}` | 120 requests / 60s |
| `GET /stats` | 30 requests / 60s |

Exceeding the limit returns `429 { "error": "Rate limit exceeded" }`.

### Errors

| Status | Meaning |
| --- | --- |
| 401 | Missing/invalid API key |
| 404 | Donation reference not found |
| 429 | Rate limit exceeded |
| 500 | Server error |

Error responses are always `{ "error": "<message>" }`. The manual-payment
endpoints add a machine-readable `"code"`.

---

### `GET /donations`

List donations, newest first.

**Query params** (all optional):

| Param | Type | Notes |
| --- | --- | --- |
| `status` | `pending` \| `paid` \| `failed` | Filter by status |
| `utm_source` | string | Filter by exact traffic source (e.g. `facebook`) |
| `limit` | integer | Optional, uncapped. Omit to return **every** matching row |
| `offset` | integer | Default 0 — start position |
| `from` | ISO 8601 | `created_at >= from` |
| `to` | ISO 8601 | `created_at <= to` |

**Example**

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://bayarfidyahonline.com/api/v1/donations?status=paid&limit=20&from=2026-07-01T00:00:00Z"
```

**Response `200`**

```json
{
  "data": [
    {
      "reference": "FID-AB12CD34",
      "status": "paid",
      "payer_name": "Ahmad bin Ali",
      "payer_email": "ahmad@example.com",
      "payer_phone": "60123456789",
      "negeri": "Selangor",
      "category": "uzur_tua",
      "days": 7,
      "multiplier": 1,
      "amount": 14.00,
      "amount_sen": 1400,
      "currency": "MYR",
      "message": "Bayaran bagi pihak arwah ayah.",
      "utm_source": "facebook",
      "utm_medium": "cpc",
      "utm_campaign": "ramadan-2026",
      "utm_term": null,
      "utm_content": "video-a",
      "gclid": "Cj0KCQ...",
      "gbraid": null,
      "wbraid": null,
      "paid_at": "2026-07-15T03:22:10.000Z",
      "created_at": "2026-07-15T03:20:44.000Z"
    }
  ],
  "count": 137,
  "limit": 20,
  "offset": 0
}
```

`count` is the total number of matching rows. Omit `limit` to get them all
in one response; or page with `limit`/`offset` when you prefer smaller pages
(`limit` is `null` in the response when it wasn't set).

---

### `GET /donations/{reference}`

Fetch a single donation by its reference code (e.g. `FID-AB12CD34`).

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://bayarfidyahonline.com/api/v1/donations/FID-AB12CD34"
```

**Response `200`**

```json
{ "data": { "reference": "FID-AB12CD34", "status": "paid", "...": "..." } }
```

Same object shape as one row in `GET /donations`. Returns `404` if the
reference doesn't exist.

---

### `GET /stats`

Aggregate totals — for dashboards or periodic reports.

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://bayarfidyahonline.com/api/v1/stats"
```

**Response `200`**

```json
{
  "currency": "MYR",
  "total_collected": 18432.00,
  "total_collected_sen": 1843200,
  "count_paid": 1316,
  "count_pending": 24,
  "count_failed": 7,
  "unique_payers": 1189,
  "by_category": {
    "uzur_tua": { "count": 420, "amount": 5880.00 },
    "sakit_kronik": { "count": 180, "amount": 2520.00 },
    "hamil_menyusu": { "count": 95, "amount": 1330.00 },
    "lewat_qada": { "count": 510, "amount": 7140.00 },
    "meninggal_dunia": { "count": 111, "amount": 1554.00 }
  },
  "by_utm_source": {
    "facebook": { "count": 640, "amount": 8960.00 },
    "google": { "count": 210, "amount": 2940.00 },
    "direct": { "count": 466, "amount": 6532.00 }
  }
}
```

`by_category` only includes categories with at least one **paid** donation.
`by_utm_source` attributes paid revenue by traffic source; payments with no
UTM (direct/organic) are grouped under `"direct"`, so its figures always
reconcile with `total_collected`. Totals are computed across every paid row
(not capped at 1000), so they stay accurate as the dataset grows.

---

### `POST /donations/manual`

Record a payment that was **already made** by DuitNow QR or bank transfer — for
example one the WhatsApp chatbot handled outside the site. Until now such a
payment left no record, receipt or report.

The record **always starts as `review` ("Perlu Semak")**. This endpoint cannot
mark anything `paid`: staff match it against the bank statement in
**Admin → Sumbangan** and confirm it there. That confirmation is what sends the
receipt, fires the `donation.paid` webhook and the Purchase analytics event —
exactly once, as for an online payment. Creating a record here creates no
gateway link, sends no receipt, and fires only `donation.created`.

> Run `supabase/add-manual-payments.sql` once before first use. Until then this
> endpoint answers `503 MIGRATION_REQUIRED`.

**Body** (JSON):

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | **Required**, max 120 |
| `email` | string | **Required**, valid email |
| `phone`, `negeri` | string | Optional |
| `message` | string | Optional note, max 500 — e.g. `"Bagi pihak arwah NAMA"` |
| `category` | string | **Required**: `uzur_tua`, `sakit_kronik`, `hamil_menyusu`, `lewat_qada`, `meninggal_dunia`, `lain` |
| `days` | integer | **Required** for every category except `lewat_qada` (1–365) |
| `qada` | array | **Required** for `lewat_qada`: `[{"hijri_year": 1446, "days": 7}]`, 1–30 days per year. Not allowed on other categories |
| `amount_sen` | integer | **Required.** What the sender believes was paid. Never trusted: the server recomputes with the same logic as `POST /quote` and answers `409 AMOUNT_MISMATCH` with the real amount if it differs |
| `method` | `"qr"` \| `"bank_transfer"` | **Required** |
| `paid_at` | ISO 8601 | Optional. When the sender paid. Not in the future, not older than a year. Used as the paid time on the receipt once staff confirm |
| `utm_source` | string | Optional, default `chatbot-wa` |
| `idempotency_key` | string | **Required.** 8–200 printable characters, no spaces, unique per payment |

Sending a `status` field is rejected (`400`): the caller has no say in it.

**Idempotency.** Repeating a request with the same `idempotency_key` returns the
existing record with **HTTP 200** (and `"idempotent_replay": true`) instead of
creating a duplicate (**201**). Concurrent requests with the same key are safe.

```bash
curl -X POST "https://bayarfidyahonline.com/api/v1/donations/manual" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ahmad bin Ali",
    "email": "ahmad@example.com",
    "phone": "60123456789",
    "negeri": "Selangor",
    "message": "Bagi pihak arwah Ali bin Abu",
    "category": "meninggal_dunia",
    "days": 10,
    "amount_sen": 4000,
    "method": "qr",
    "paid_at": "2026-11-22T10:15:00+08:00",
    "idempotency_key": "wa-60123456789-1732245300"
  }'
```

For `lewat_qada`, send the years instead of `days`:

```bash
curl -X POST "https://bayarfidyahonline.com/api/v1/donations/manual" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Siti Aminah",
    "email": "siti@example.com",
    "category": "lewat_qada",
    "qada": [{"hijri_year": 1445, "days": 7}, {"hijri_year": 1446, "days": 5}],
    "amount_sen": 5600,
    "method": "bank_transfer",
    "idempotency_key": "wa-siti-20261122-001"
  }'
```

(Use `POST /quote` first to get the exact `amount_sen` for the current date.)

**Response `201`** (`200` on a replay):

```json
{
  "data": {
    "reference": "FID-K3J9X2AB",
    "status": "review",
    "status_label": "Perlu Semak",
    "amount": 40.00,
    "amount_sen": 4000,
    "currency": "MYR",
    "method": "qr",
    "created_at": "2026-11-22T02:31:09.000Z",
    "requires_staff_review": false
  }
}
```

`requires_staff_review` is `true` at RM5,000 and over. Every record here is
checked by staff regardless; the flag marks the large ones.

**Errors**

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | Body failed validation (`issues` lists each field) |
| 400 | `INVALID_ORDER` | Unknown category, bad `qada` years/days, or below RM1.00 |
| 409 | `AMOUNT_MISMATCH` | `amount_sen` differs from the server's figure; the body carries `amount_sen` (the real amount) and `expected_amount_sen` (what you sent) |
| 429 | `RATE_LIMITED` | More than 60 requests a minute per API key |
| 503 | `MIGRATION_REQUIRED` | `supabase/add-manual-payments.sql` has not been run |

---

### `POST /donations/{reference}/proof`

Attach proof of payment to a record created by `POST /donations/manual`. Send
**either**:

- `multipart/form-data` with a `file` field, **or**
- JSON `{"proof_url": "https://api.murpati.com/..."}` — the server downloads it.

```bash
# Upload a file
curl -X POST "https://bayarfidyahonline.com/api/v1/donations/FID-K3J9X2AB/proof" \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@resit.jpg"

# Or let the server fetch it
curl -X POST "https://bayarfidyahonline.com/api/v1/donations/FID-K3J9X2AB/proof" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"proof_url": "https://api.murpati.com/media/abc123.jpg"}'
```

**Response `200`:** `{ "data": { "reference": "FID-K3J9X2AB", "proof_attached": true } }`

Rules:

- Only a record created by `POST /donations/manual` that is **still `review`** can
  take a proof. An online (CHIP) record, or one staff have already confirmed,
  is refused with `409`.
- JPG, PNG, WEBP or PDF, **5MB at most**. The type is read from the file's own
  bytes; the declared Content-Type and the file name are ignored.
- A new proof **replaces** any earlier one.
- `proof_url` must be **HTTPS** on an allowed host (`api.murpati.com`). IP
  addresses, `localhost` and internal names are refused, redirects are not
  followed, and the download is cut off after **15 seconds**.
- A multipart body is also subject to the host's own request-size limit (about
  4.5MB on Vercel). For anything larger, use `proof_url`.

**Errors**

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` / `EMPTY_FILE` | No `file` / empty file / bad JSON body |
| 400 | `PROOF_URL_NOT_ALLOWED` | `proof_url` is not HTTPS, is an IP, or is not on the allowed host list |
| 404 | `NOT_FOUND` | No such reference |
| 409 | `NOT_MANUAL_PAYMENT` | The record is an online payment |
| 409 | `NOT_AWAITING_REVIEW` | The record is no longer `review` (already confirmed) |
| 413 | `FILE_TOO_LARGE` | Over 5MB |
| 415 | `UNSUPPORTED_FILE_TYPE` | Not JPG / PNG / WEBP / PDF |
| 429 | `RATE_LIMITED` | More than 30 requests a minute per API key |
| 502 / 504 | `PROOF_URL_FETCH_FAILED` / `PROOF_URL_TIMEOUT` | Could not download `proof_url` |

---

### `GET /blog`

List blog posts (any status — this endpoint is authenticated, unlike the
public `/blog` page which only shows published posts).

**Query params** (all optional): `status` (`draft` | `published`), `limit`
(default 50, max 200), `offset`.

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://bayarfidyahonline.com/api/v1/blog?status=draft"
```

**Response `200`**

```json
{
  "data": [
    {
      "id": "b1e6...",
      "slug": "kepentingan-membayar-fidyah",
      "title": "Kepentingan Membayar Fidyah",
      "excerpt": "Ringkasan ringkas...",
      "content": "# Markdown content...",
      "cover_image": "https://.../cover.jpg",
      "status": "published",
      "author": "Admin",
      "published_at": "2026-06-01T00:00:00.000Z",
      "created_at": "2026-05-30T10:00:00.000Z",
      "updated_at": "2026-06-01T00:00:00.000Z"
    }
  ],
  "count": 42,
  "limit": 50,
  "offset": 0
}
```

### `POST /blog`

Create a post.

**Body** (JSON):

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | **Required** |
| `slug` | string | Optional — derived from `title` if omitted |
| `excerpt` | string \| null | Optional |
| `content` | string | Optional — Markdown, defaults to `""` |
| `cover_image` | string \| null | Optional — URL |
| `author` | string \| null | Optional |
| `status` | `"draft"` \| `"published"` | Optional, defaults to `"draft"` |
| `published_at` | ISO 8601 | Optional. Only used when `status: "published"`; defaults to now if omitted (lets you schedule a future date) |

```bash
curl -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"title": "Kepentingan Membayar Fidyah", "content": "# Isi kandungan...", "status": "published"}' \
  "https://bayarfidyahonline.com/api/v1/blog"
```

**Response `201`**: `{ "data": { ...same shape as a list row... } }`

**`409`** if the (auto-derived or given) slug already exists —
`{ "error": "Slug \"...\" already exists" }`.

### `PATCH /blog/{slug}`

Partial update — send only the fields you want to change. Accepts the same
fields as `POST`, plus `slug` (to rename). Setting `status: "draft"` clears
`published_at`; setting `status: "published"` with no `published_at` and no
prior publish date publishes immediately.

```bash
curl -X PATCH -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"status": "published"}' \
  "https://bayarfidyahonline.com/api/v1/blog/kepentingan-membayar-fidyah"
```

**Response `200`**: `{ "data": { ...updated row... } }`. `404` if the slug
doesn't exist, `409` on a slug rename collision.

### `DELETE /blog/{slug}`

```bash
curl -X DELETE -H "Authorization: Bearer $API_KEY" \
  "https://bayarfidyahonline.com/api/v1/blog/kepentingan-membayar-fidyah"
```

**Response `200`**: `{ "data": { "slug": "...", "deleted": true } }`. `404`
if not found.

> All blog writes revalidate the public `/blog` pages immediately and are
> recorded in the admin activity log (actor `"api"`).

---

## 2. Outbound webhooks (push)

Configure a webhook URL at **Dashboard → Integrasi → Webhook Keluar
(n8n)** to receive events the moment they happen — no polling required.

### Events

| Event | Fires when |
| --- | --- |
| `donation.created` | A donation record is created (before payment; for a `POST /donations/manual` record the payment is already made and `status` is `review`) |
| `donation.paid` | A payment is confirmed (CHIP webhook or manual admin approval) |
| `donation.abandoned` | A pending payment is auto-expired (CHIP after 24h, manual after 7d with no proof) — useful for abandoned-cart follow-ups |

`donation.failed` is defined in the codebase but not currently emitted by
any flow.

### Request

`POST` to your configured URL, JSON body:

```json
{
  "event": "donation.paid",
  "data": {
    "reference": "FID-AB12CD34",
    "status": "paid",
    "payer_name": "Ahmad bin Ali",
    "payer_email": "ahmad@example.com",
    "payer_phone": "60123456789",
    "negeri": "Selangor",
    "category": "uzur_tua",
    "days": 7,
    "multiplier": 1,
    "rate_sen": 200,
    "amount_sen": 1400,
    "amount": 14.00,
    "currency": "MYR",
    "message": null,
    "payment_method": "chip",
    "utm_source": "facebook",
    "utm_medium": "cpc",
    "utm_campaign": "ramadan-2026",
    "utm_term": null,
    "utm_content": "video-a",
    "gclid": "Cj0KCQ...",
    "gbraid": null,
    "wbraid": null,
    "paid_at": "2026-07-15T03:22:10.000Z",
    "created_at": "2026-07-15T03:20:44.000Z"
  },
  "timestamp": "2026-07-15T03:22:10.400Z"
}
```

`data` is the full internal donation row (all columns) plus a convenience
Ringgit `amount` field — so UTM attribution (`utm_source`, `utm_medium`,
`utm_campaign`, `utm_term`, `utm_content`) and Google Ads click ids
(`gclid`, `gbraid`, `wbraid`) arrive with every event. Use the click ids to
import the confirmed conversion back into Google Ads (offline conversion
import). Expect `data` to gain new fields over time; don't treat it as a
closed schema.

Headers:

```
Content-Type: application/json
X-Webhook-Event: donation.paid
X-Signature: sha256=<hmac>   (only if a signing secret is configured)
```

### Verifying the signature

If you set a **Signing Secret** in Integrasi, every request includes
`X-Signature: sha256=<hex hmac>` — an HMAC-SHA256 of the *raw request body*
using the secret as the key. Verify it before trusting the payload:

```js
const crypto = require("crypto");

function verify(rawBody, signatureHeader, secret) {
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}
```

### Delivery notes

- Best-effort, fire-and-forget: a 5 second timeout, no retries. If your
  endpoint is down, the event is lost (the payment itself is never blocked
  by webhook delivery).
- Use **Dashboard → Integrasi → Hantar Ujian** to send a test
  `donation.paid` event with `reference: "FID-TEST0000"` and `"test": true`.

---

## 3. Reference data

### Donation status (`status`)

| Value | Meaning |
| --- | --- |
| `pending` | Created, awaiting payment |
| `paid` | Payment confirmed |
| `failed` | Payment failed/expired |
| `review` | **Perlu Semak.** A QR / bank-transfer payment recorded over the API: already paid, waiting for staff to confirm. Filter with `GET /donations?status=review`; it is not included in `?status=pending` |

### Payment method (`payment_method`)

| Value | Meaning |
| --- | --- |
| `chip` | FPX/card/QR via CHIP gateway |
| `manual` | Manual bank transfer with uploaded proof |
| `qr` | DuitNow QR, recorded over the API (`POST /donations/manual`) |
| `bank_transfer` | Bank transfer, recorded over the API (`POST /donations/manual`) |

### Category (`category`)

| Value | Label (Malay) |
| --- | --- |
| `uzur_tua` | Warga emas / uzur |
| `sakit_kronik` | Sakit berpanjangan |
| `hamil_menyusu` | Ibu hamil & menyusu |
| `lewat_qada` | Lewat qada' puasa |
| `meninggal_dunia` | Bagi pihak si mati |
| `lain` | Lain-lain |

### `negeri` (state)

One of: `Johor`, `Kedah`, `Kelantan`, `Melaka`, `Negeri Sembilan`, `Pahang`,
`Perak`, `Perlis`, `Pulau Pinang`, `Sabah`, `Sarawak`, `Selangor`,
`Terengganu`, `W.P. Kuala Lumpur`, `W.P. Labuan`, `W.P. Putrajaya`, or `null`
if not specified.

### Amount fields

`amount` is Ringgit (float, e.g. `14.00`). `amount_sen` is the same value in
sen (integer, e.g. `1400`) — prefer `amount_sen` for exact arithmetic to
avoid floating-point rounding.

---

## 4. Not part of the public API

These exist in the codebase but are **not** intended for third-party use —
listed here only so you don't mistake them for public integration points:

- `POST /api/chip/callback` — CHIP's own server-to-server webhook
  (RSA-SHA256 `X-Signature` verified against CHIP's public key). Only CHIP
  calls this.
- `POST /api/fidyah/create`, `POST /api/fidyah/upload-proof` — used by the
  public payment form itself (IP rate-limited, no API key).
- `POST /api/track/purchase` — server-side GA4/Facebook CAPI conversion
  tracking, called by the `/status` page.

---

## 5. Changelog

- **v1** (current) — `GET /donations`, `GET /donations/{reference}`,
  `GET /stats`, `GET/POST /blog`, `GET/PATCH/DELETE /blog/{slug}`,
  `donation.created`/`donation.paid`/`donation.abandoned` webhooks. Donation
  objects and `/stats` now carry UTM attribution (`utm_*` fields,
  `by_utm_source`, and a `utm_source` filter on `GET /donations`) plus Google
  Ads click ids (`gclid`/`gbraid`/`wbraid`) for offline conversion import;
  webhook payloads carry the same fields.
- **Manual payments** — `POST /donations/manual` and
  `POST /donations/{reference}/proof`; new status value `review`
  (`?status=review`), new `payment_method` values `qr` and `bank_transfer`, and
  `payment_method`, `proof_attached` and `claimed_paid_at` on donation objects.
