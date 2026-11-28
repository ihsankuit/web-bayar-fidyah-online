---
name: bayar-fidyah-online
description: Use this skill when the user wants to interact with their Bayar Fidyah Online donation platform (bayarfidyahonline.com) via its REST API. Tasks include creating a donation and getting a payment link, listing or filtering donations, looking up a donation by reference, pulling aggregate stats (totals, counts, category breakdown), explaining or verifying incoming webhook events (donation.created, donation.paid), and reading/writing blog posts (list, create, update, publish, delete) on the platform's blog. Requires an API key issued from Dashboard > Integrasi in the admin panel.
---

# Bayar Fidyah Online API

## When to invoke this skill

Invoke when the user asks you to:
- List, filter, or count donations (by status, date range, category)
- Look up a specific donation by its reference code (format `FID-XXXXXXXX`)
- Report aggregate stats — total collected, paid/pending/failed counts, unique payers, breakdown by category
- Build a report, dashboard, or scheduled digest from donation data
- Verify or explain an incoming webhook payload from Bayar Fidyah Online (`donation.created` / `donation.paid`)
- Write blog content for the platform — draft, create, edit, publish, schedule, or delete a blog post

Also invoke if the user mentions **Bayar Fidyah Online**, **bayarfidyahonline.com**, or pastes an API key/reference in the format `FID-XXXXXXXX`.

## Prerequisites (collect before first call)

1. **An API key.** Issued from **Dashboard → Integrasi → REST API Key** in the admin panel (requires an admin login). If the user doesn't have one, tell them to generate it there — the API is disabled entirely until a key exists.
2. **(Optional) A webhook signing secret**, only needed if verifying `X-Signature` on incoming webhooks. Also set at **Dashboard → Integrasi**.

Never proceed without the API key. Ask the user directly; don't guess or invent one.

## Base URL

```
https://bayarfidyahonline.com/api/v1
```

(Replace the host if the user runs this on a different domain — ask if unsure.)

## Authentication

Every request needs the API key as a header — never in the URL or query string:

```
Authorization: Bearer <API_KEY>
```

(`X-API-Key: <API_KEY>` also works if the client can't set `Authorization`.)

**Security rules:**
- Treat the API key as a password. Never log it, echo it back in full, or paste it into third-party tools. If the user shares it with you in chat, confirm you've received it and suggest they keep it out of shared channels.
- If asked to hardcode the key into a script, write the script to read it from an environment variable instead (`BAYAR_FIDYAH_API_KEY`), not a literal.

## Endpoint reference

### `POST /donations`

Create a fidyah donation and get back a payment link. Use this for a chatbot
or automation that needs to take a payment — not `POST /api/fidyah/create`,
which is the browser's own endpoint and is throttled per IP at 15 per 10
minutes (one server address would burn that allowance across all its users).

**Body:**

```json
{
  "name": "Ahmad bin Abdullah",
  "email": "ahmad@contoh.com",
  "phone": "0123456789",
  "negeri": "Selangor",
  "category": "uzur_tua",
  "days": 7,
  "multiplier": 1,
  "message": "Bagi pihak arwah ayah",
  "method": "chip",
  "utm_source": "chatbot-wa"
}
```

Required: `name`, `email`, `category`, and `days` (not needed for
`lewat_qada` with `qada` rows, below). Everything else is optional.
`multiplier` defaults to 1 and is only for the non-qada categories, `method`
defaults to `"chip"`, and `utm_source` defaults to `"api"` so these rows can
be told apart from payers who came through the site.

Valid `category` values: `uzur_tua`, `sakit_kronik`, `hamil_menyusu`,
`lewat_qada`, `meninggal_dunia`, `lain`.

The amount is NOT caller-settable — it is computed from `days × multiplier ×
the current rate`, so a bot cannot charge an arbitrary figure.

**Lewat qada' (delayed makeup fasts) — send the years, not a multiplier.**
For `category: "lewat_qada"` pass `qada`, one entry per missed year, where
`hijri_year` is the Hijri year of that Ramadan and `days` is how many days
of it were missed (1–30). The server works out the multiplier itself: the
number of Ramadans that have *begun* since the missed one (a year whose next
Ramadan has not begun yet counts ×0). Do not compute it yourself.

```json
{
  "name": "Ali", "email": "ali@example.com", "category": "lewat_qada",
  "qada": [
    { "hijri_year": 1446, "days": 12 },
    { "hijri_year": 1447, "days": 13 }
  ]
}
```

Rules: 1–60 rows, no duplicate years, only years whose Ramadan has begun
(and at most 60 back). If every chosen year is still within its qada'
window the total is RM0 and the call fails with `400`. The response includes
`breakdown` (per-year `days`, `multiplier`, `subtotal_sen`) and the same
breakdown is stored on the donation (`qada_breakdown`) and printed on the
receipt. A lewat qada' total of RM5,000 or more is not charged online: `POST /donations` with `method: "chip"` fails with `422`, `code: "REVIEW_REQUIRED"`; refer the payer to staff or bank transfer. `POST /quote` returns `requires_staff_review: true` for these. For a payer who says they cannot afford the multiplier, send `qada_basic_only: true` (also accepted by `POST /quote`): each year is then charged days × rate with no multiplier, and `breakdown` rows carry `waived_multiplier` with the real figure. Only offer this if the payer says so; never apply it on your own. Optionally send `expected_amount_sen` (from an earlier quote): if the
figure has since changed (a Ramadan began meanwhile) the call fails with
`409`, `code: "AMOUNT_CHANGED"` and the new `amountSen`, so re-quote and
confirm with the payer again.

**Response `201`:**

```json
{
  "data": {
    "reference": "FID-ABC123",
    "status": "pending",
    "amount": 28,
    "amount_sen": 2800,
    "currency": "MYR",
    "method": "chip",
    "payment_url": "https://gate.chip-in.asia/p/...",
    "status_url": "https://www.bayarfidyahonline.com/status?ref=FID-ABC123"
  }
}
```

Send `payment_url` to the payer. With `"method": "manual"` the response
carries a `bank` object instead of `payment_url`.

**Important:** the donation starts `pending` and creating it moves no money.
It becomes `paid` only once CHIP confirms. Never tell the user their fidyah
is settled off the back of a `201` — poll `GET /donations/{reference}` or
wait for the `donation.paid` webhook.

Errors: `400` with an `issues` array on validation failure, `401` on a bad
key, `429` past 60 per minute per key, `502` if the payment gateway is
unreachable.

### `POST /quote`

What an order would cost right now, creating nothing. Same body as
`POST /donations` for the pricing fields only (`category`, `days` /
`multiplier`, or `qada`). Uses the same code as the real charge, so the
quote is the charge. Use it to tell the payer the total before sending a link.

```json
{ "data": { "amount": 48, "amount_sen": 4800, "currency": "MYR",
  "chargeable_days": 12, "rate_sen": 400,
  "breakdown": [ { "hijri_year": 1446, "label": "2025 (1446H)", "days": 12,
                   "multiplier": 1,
      "qada_breakdown": null, "subtotal_sen": 4800 } ] } }
```

### `GET /qada-years`

The years a payer can pick for lewat qada' today, newest first, each with the
multiplier it carries now (`years[].multiplier`), the rate, limits
(`max_days_per_year`, `max_years`) and `next_ramadan` (when the multipliers
step up next). Ask this instead of reasoning about Hijri dates. Ramadan dates
come from the Umm al-Qura calendar and can differ from JAKIM by a day.

### `GET /donations`

List donations, newest first.

**Query params** (all optional):
- `status`: `pending` | `paid` | `failed`
- `limit`: integer, default 50, **max 200**
- `offset`: integer, default 0
- `from` / `to`: ISO 8601 timestamps, filters on `created_at`

**Response:**
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

`count` is the **total matching rows**, not just the current page — paginate with `limit`/`offset` until you've fetched `count` rows.

---

### `GET /donations/{reference}`

Fetch one donation by its reference code (e.g. `FID-AB12CD34`).

**Response:** `{ "data": { ...same shape as one row above... } }`

Returns `404 { "error": "Not found" }` if the reference doesn't exist — don't retry, the reference is simply wrong or was never created.

---

### `GET /stats`

Aggregate totals — no query params.

**Response:**
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
    "lewat_qada": { "count": 510, "amount": 7140.00 }
  }
}
```

`by_category` only lists categories with at least one **paid** donation — an empty or missing category key means zero paid donations there, not an error. `total_collected`/`by_category[*].amount` are computed only from `status: "paid"` rows.

---

### `GET /blog`

List blog posts, any status. Query params: `status` (`draft`|`published`), `limit` (default 50, max 200), `offset`.

### `POST /blog`

Create a post. Body:
```json
{
  "title": "Kepentingan Membayar Fidyah",
  "slug": "kepentingan-membayar-fidyah",
  "excerpt": "Ringkasan ringkas...",
  "content": "# Markdown content...",
  "cover_image": "https://.../cover.jpg",
  "author": "Admin",
  "status": "published",
  "published_at": "2026-06-01T00:00:00Z"
}
```
Only `title` is required — `slug` auto-derives from it if omitted, `status` defaults to `"draft"`, `content` defaults to `""`. Returns `201` with the created post, or `409` if the slug already exists.

### `PATCH /blog/{slug}`

Partial update — send only the fields to change (same field set as `POST`, plus `slug` to rename). Setting `status: "published"` with no prior publish date and no `published_at` publishes immediately; setting `status: "draft"` clears `published_at`. Returns `404` if the slug doesn't exist, `409` on a rename collision.

### `DELETE /blog/{slug}`

Deletes the post. Returns `404` if not found, else `{ "data": { "slug": "...", "deleted": true } }`.

All blog writes go live on the public `/blog` pages immediately (no cache delay) and are recorded in the platform's admin activity log.

## Rate limits

Per client IP, sliding window:

| Endpoint | Limit |
| --- | --- |
| `GET /donations` | 120 requests / 60s |
| `GET /donations/{reference}` | 120 requests / 60s |
| `GET /stats` | 30 requests / 60s |

All endpoints share the platform's own limiter (not a shared global bucket across endpoints — each row above is independent).

## Error codes

| Status | Meaning | What to do |
| --- | --- | --- |
| 401 | Missing/invalid API key | Confirm the key, or tell the user to check/regenerate it in Integrasi |
| 404 | Donation reference not found | Verify the reference string; don't retry |
| 429 | Rate limit exceeded | Back off and retry after a short pause; don't hammer it |
| 500 | Server error | Retry once with backoff; if it persists, tell the user to check platform status |

All error responses are `{"error": "<message>"}`.

## Reference data (field values)

**`status`**: `pending` (awaiting payment) | `paid` | `failed`

**`payment_method`** (present on raw donation objects, e.g. in webhook payloads): `chip` (FPX/card/QR) | `manual` (bank transfer + uploaded proof)

**`category`**:
| Value | Meaning |
| --- | --- |
| `uzur_tua` | Elderly / frail |
| `sakit_kronik` | Chronic illness |
| `hamil_menyusu` | Pregnant / breastfeeding |
| `lewat_qada` | Delayed makeup fasts |
| `meninggal_dunia` | On behalf of the deceased |
| `lain` | Other |

**`negeri`**: one of the 16 Malaysian states/federal territories (e.g. `Selangor`, `W.P. Kuala Lumpur`), or `null` if unspecified.

**Amounts**: `amount` is Ringgit (float, e.g. `14.00`); `amount_sen` is the same value in sen (integer, e.g. `1400`). Prefer `amount_sen` for any arithmetic/summing to avoid floating-point rounding, then divide by 100 for display.

## Do's and don'ts

**DO**
- Paginate `GET /donations` with `limit`/`offset` when `count` exceeds what you've fetched — don't assume the first page is everything.
- Use `amount_sen` (integer) for any summing/math; only use `amount` for display.
- Time-bound queries with `from`/`to` when the user asks about a specific period, rather than fetching everything and filtering client-side.
- Treat webhook `data` payloads as open-ended (they include the full internal row) — read only the fields you need, don't assume a closed schema.
- Before creating a blog post, check `GET /blog` for an existing post with a similar title/slug if the user is unsure whether it exists — avoids duplicate posts under near-identical slugs.
- Default new posts to `status: "draft"` unless the user explicitly says to publish — publishing goes live on the public site immediately.
- Confirm with the user before `DELETE`ing a post — it's not recoverable through the API.

**DON'T**
- Don't call `POST /api/chip/callback`, `POST /api/fidyah/create`, `POST /api/fidyah/upload-proof`, or `POST /api/track/purchase` — these are internal endpoints for the browser checkout and CHIP's own webhook, protected differently and not meant for third-party calls. To create a donation, use `POST /donations` on this API instead.
- Don't report a donation as paid because `POST /donations` returned `201`. That only means the record and the payment link exist; confirm with `GET /donations/{reference}` or the `donation.paid` webhook.
- Don't hardcode or echo the API key in output.
- Don't retry 401/404 — they mean "wrong key" / "wrong reference", not transient failures.
- Don't poll `GET /stats` faster than needed (30 req/min cap) — for near-real-time updates, prefer the `donation.paid` webhook instead of polling.

## Outbound webhooks (if the user is receiving events, not just querying)

The platform can `POST` events to a URL configured at **Dashboard → Integrasi → Webhook Keluar**:

| Event | Fires when |
| --- | --- |
| `donation.created` | A donation record is created, before payment |
| `donation.paid` | Payment is confirmed (gateway callback or manual admin approval) |

**Payload:**
```json
{
  "event": "donation.paid",
  "data": { "reference": "FID-AB12CD34", "status": "paid", "amount_sen": 1400, "...": "full donation row" },
  "timestamp": "2026-07-15T03:22:10.400Z"
}
```

Headers include `X-Webhook-Event: <event>` and, if a signing secret is configured, `X-Signature: sha256=<hmac>` — an HMAC-SHA256 of the **raw request body** using the secret as key. Verify before trusting the payload:

```js
const crypto = require("crypto");
function verify(rawBody, signatureHeader, secret) {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}
```

Delivery is best-effort (5s timeout, no retries) — don't assume every event arrives; reconcile periodically via `GET /donations` if completeness matters.

## Common workflow recipes

### Recipe 1: "How much fidyah has been collected so far?"

```
GET /stats
```
Report `total_collected` (with `currency`), plus `count_paid` for context. Mention `by_category` if the user wants a breakdown.

### Recipe 2: "List this week's paid donations"

```
GET /donations?status=paid&from=<monday 00:00:00Z>&to=<now>&limit=200
```
If `count` > 200, page with `offset` in steps of 200 until you've covered `count` rows.

### Recipe 3: "What's the status of reference FID-XXXXXXXX?"

```
GET /donations/FID-XXXXXXXX
```
Report `status`, `amount`, `paid_at` (or note it's still `pending`/`failed`).

### Recipe 4: Verify a webhook the user pasted

1. Check `event` is one of `donation.created` / `donation.paid`.
2. If they have the signing secret and raw body, verify `X-Signature` per the snippet above before trusting `data`.
3. Summarize `data` in plain language (payer, amount, category, status) rather than dumping raw JSON back at them.

### Recipe 5: "Write a blog post about X"

1. Draft `title` and `content` (Markdown) from what the user asked for.
2. `POST /blog` with `status: "draft"` unless they explicitly asked to publish now.
3. Share the returned `slug` and a short summary; ask if they want it published, or edited further via `PATCH /blog/{slug}`.
4. If they later say "publish it", `PATCH /blog/{slug}` with `{"status": "published"}` — don't recreate the post.

## When something goes wrong

Triage order:
1. Is the API key valid? (A `401` means check/regenerate it in Dashboard → Integrasi.)
2. Was a rate limit hit? (`429` — back off, don't hammer.)
3. Is the reference correct? (`404` on a single-donation lookup — don't retry, ask the user to re-check the code.)
4. Server error (`500`) — retry once with backoff; if it persists, it's a platform-side issue, not something to work around client-side.
