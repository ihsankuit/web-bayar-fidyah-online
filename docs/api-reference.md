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

Error responses are always `{ "error": "<message>" }`.

---

### `GET /donations`

List donations, newest first.

**Query params** (all optional):

| Param | Type | Notes |
| --- | --- | --- |
| `status` | `pending` \| `paid` \| `failed` | Filter by status |
| `limit` | integer | Default 50, max 200 |
| `offset` | integer | Default 0 |
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
      "paid_at": "2026-07-15T03:22:10.000Z",
      "created_at": "2026-07-15T03:20:44.000Z"
    }
  ],
  "count": 137,
  "limit": 20,
  "offset": 0
}
```

`count` is the total number of matching rows (not just the current page) —
use it with `limit`/`offset` to paginate.

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
  }
}
```

`by_category` only includes categories with at least one **paid** donation.
Totals are computed across every paid row (not capped at 1000), so they stay
accurate as the dataset grows.

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
| `donation.created` | A donation record is created (before payment) |
| `donation.paid` | A payment is confirmed (CHIP webhook or manual admin approval) |

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
    "paid_at": "2026-07-15T03:22:10.000Z",
    "created_at": "2026-07-15T03:20:44.000Z"
  },
  "timestamp": "2026-07-15T03:22:10.400Z"
}
```

`data` is the full internal donation row (all columns) plus a convenience
Ringgit `amount` field — expect it to gain new fields over time; don't treat
it as a closed schema.

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

### Payment method (`payment_method`)

| Value | Meaning |
| --- | --- |
| `chip` | FPX/card/QR via CHIP gateway |
| `manual` | Manual bank transfer with uploaded proof |

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
- The WhatsApp blast feature (Dashboard → WhatsApp) is admin-panel-only and
  has no public API surface.

---

## 5. Changelog

- **v1** (current) — `GET /donations`, `GET /donations/{reference}`,
  `GET /stats`, `GET/POST /blog`, `GET/PATCH/DELETE /blog/{slug}`,
  `donation.created`/`donation.paid` webhooks.
