import { beforeEach, describe, expect, it } from "vitest";

import { FakeDb } from "./test-helpers/fake-supabase";
import {
  createManualPayment,
  parseManualPaymentBody,
  type ManualPaymentInput,
} from "./manual-payment";
import {
  QADA_REVIEW_THRESHOLD_SEN,
  qadaYearOptions,
  ramadansPassedSince,
} from "./ramadan";
import type { Donation } from "./database.types";

// A fixed "today" so lewat qada' multipliers do not drift with the calendar.
const NOW = new Date("2026-11-22T04:00:00Z");
const RATE = 400; // RM4.00 a day

const base = {
  name: "Ahmad bin Ali",
  email: "ahmad@example.com",
  phone: "60123456789",
  negeri: "Selangor",
  category: "meninggal_dunia",
  days: 10,
  amount_sen: 4000,
  method: "qr",
  idempotency_key: "wa-60123456789-0001",
};

function parse(overrides: Record<string, unknown> = {}) {
  const r = parseManualPaymentBody({ ...base, ...overrides }, NOW);
  if (!r.ok) throw new Error(`unexpected validation failure: ${JSON.stringify(r.issues)}`);
  return r.data;
}

let db: FakeDb;
const create = (input: ManualPaymentInput) =>
  createManualPayment(input, { supabase: db.client(), rateSen: RATE, now: NOW, clientIp: "1.2.3.4" });

beforeEach(() => {
  db = new FakeDb();
});

describe("parseManualPaymentBody", () => {
  it("accepts a valid body and defaults utm_source to chatbot-wa", () => {
    const data = parse();
    expect(data.utm_source).toBe("chatbot-wa");
    expect(data.method).toBe("qr");
  });

  it("REJECTS a body that tries to set the status — the API cannot make a payment Berjaya", () => {
    for (const status of ["paid", "Berjaya", "review", "pending"]) {
      const r = parseManualPaymentBody({ ...base, status }, NOW);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues.map((i) => i.field)).toContain("status");
    }
  });

  it("requires an idempotency_key of a sensible length and shape", () => {
    expect(parseManualPaymentBody({ ...base, idempotency_key: undefined }, NOW).ok).toBe(false);
    expect(parseManualPaymentBody({ ...base, idempotency_key: "1" }, NOW).ok).toBe(false);
    expect(parseManualPaymentBody({ ...base, idempotency_key: "has spaces in it" }, NOW).ok).toBe(false);
    expect(parseManualPaymentBody({ ...base, idempotency_key: "x".repeat(201) }, NOW).ok).toBe(false);
    expect(parseManualPaymentBody({ ...base, idempotency_key: "abcdefgh" }, NOW).ok).toBe(true);
  });

  it("validates email, name length and method", () => {
    expect(parseManualPaymentBody({ ...base, email: "not-an-email" }, NOW).ok).toBe(false);
    expect(parseManualPaymentBody({ ...base, name: "" }, NOW).ok).toBe(false);
    expect(parseManualPaymentBody({ ...base, name: "x".repeat(121) }, NOW).ok).toBe(false);
    expect(parseManualPaymentBody({ ...base, method: "chip" }, NOW).ok).toBe(false);
    expect(parseManualPaymentBody({ ...base, method: "cash" }, NOW).ok).toBe(false);
    expect(parseManualPaymentBody({ ...base, method: "bank_transfer" }, NOW).ok).toBe(true);
  });

  it("needs days for most categories and qada for lewat_qada", () => {
    expect(parseManualPaymentBody({ ...base, days: undefined }, NOW).ok).toBe(false);
    const noQada = parseManualPaymentBody({ ...base, category: "lewat_qada", days: undefined }, NOW);
    expect(noQada.ok).toBe(false);
    if (!noQada.ok) expect(noQada.issues.map((i) => i.field)).toContain("qada");
  });

  it("limits qada days to 1–30 a year", () => {
    const row = (days: number) => ({
      ...base,
      category: "lewat_qada",
      days: undefined,
      qada: [{ hijri_year: 1445, days }],
    });
    expect(parseManualPaymentBody(row(0), NOW).ok).toBe(false);
    expect(parseManualPaymentBody(row(31), NOW).ok).toBe(false);
    expect(parseManualPaymentBody(row(1), NOW).ok).toBe(true);
    expect(parseManualPaymentBody(row(30), NOW).ok).toBe(true);
  });

  it("rejects a paid_at in the future or more than a year old, but accepts a recent one with an offset", () => {
    expect(parseManualPaymentBody({ ...base, paid_at: "2026-11-23T04:00:00Z" }, NOW).ok).toBe(false);
    expect(parseManualPaymentBody({ ...base, paid_at: "2025-01-01T00:00:00Z" }, NOW).ok).toBe(false);
    expect(parseManualPaymentBody({ ...base, paid_at: "not a date" }, NOW).ok).toBe(false);
    expect(parseManualPaymentBody({ ...base, paid_at: "2026-11-22T10:15:00+08:00" }, NOW).ok).toBe(true);
  });
});

describe("createManualPayment — creating", () => {
  it("creates a pending record with the right method, source and amount", async () => {
    const r = await create(parse());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.created).toBe(true);
    const row = db.tables.donations[0];
    expect(row.status).toBe("pending");
    expect(row.payment_method).toBe("qr");
    expect(row.amount_sen).toBe(4000);
    expect(row.days).toBe(10);
    expect(row.utm_source).toBe("chatbot-wa");
    expect(row.idempotency_key).toBe("wa-60123456789-0001");
    expect(row.payer_email).toBe("ahmad@example.com");
    expect(String(row.reference)).toMatch(/^FID-[A-Z0-9]+$/);
  });

  it("never sets the paid state: no paid_at, no conversion flag, no gateway purchase", async () => {
    await create(parse({ paid_at: "2026-11-22T10:15:00+08:00" }));
    const row = db.tables.donations[0];
    expect(row.status).toBe("pending");
    expect(row.paid_at).toBeUndefined();
    expect(row.conversion_sent_at).toBeUndefined();
    expect(row.chip_purchase_id).toBeUndefined();
  });

  it("keeps the sender's paid_at apart from paid_at, as claimed_paid_at", async () => {
    await create(parse({ paid_at: "2026-11-22T10:15:00+08:00" }));
    expect(db.tables.donations[0].claimed_paid_at).toBe("2026-11-22T02:15:00.000Z");
  });

  it("stores the bank-transfer method and a custom utm_source", async () => {
    await create(parse({ method: "bank_transfer", utm_source: "ejen-kl" }));
    const row = db.tables.donations[0];
    expect(row.payment_method).toBe("bank_transfer");
    expect(row.utm_source).toBe("ejen-kl");
  });

  it("carries the note, for a payment on behalf of someone who has died", async () => {
    await create(parse({ message: "Bagi pihak arwah Ali bin Abu" }));
    expect(db.tables.donations[0].message).toBe("Bagi pihak arwah Ali bin Abu");
  });

  it("marks the row as API-created and records the caller's address", async () => {
    await create(parse());
    const row = db.tables.donations[0];
    expect(row.user_agent).toBe("bayarfidyahonline-api/v1");
    expect(row.client_ip).toBe("1.2.3.4");
  });

  it("rejects an unknown category, and a year breakdown on a category that has none", async () => {
    const unknown = await create(parse({ category: "tak_wujud" }));
    expect(unknown.ok).toBe(false);

    const wrong = await create(
      parse({ qada: [{ hijri_year: 1445, days: 7 }], days: 10 })
    );
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.code).toBe("INVALID_ORDER");
    expect(db.tables.donations).toHaveLength(0);
  });
});

describe("createManualPayment — amount", () => {
  it("answers AMOUNT_MISMATCH with the real amount and creates nothing", async () => {
    const r = await create(parse({ amount_sen: 3000 })); // 10 days x RM4 is RM40
    expect(r.ok).toBe(false);
    if (r.ok) return;

    expect(r.status).toBe(409);
    expect(r.code).toBe("AMOUNT_MISMATCH");
    expect(r.details).toMatchObject({
      amount_sen: 4000,
      expected_amount_sen: 3000,
      amount: 40,
    });
    expect(db.tables.donations).toHaveLength(0);
  });

  it("recomputes from the days, never trusting a figure the caller supplies", async () => {
    // A sender who under-reports and a sender who over-reports are both refused.
    for (const wrong of [100, 3999, 4001, 999999]) {
      const r = await create(parse({ amount_sen: wrong }));
      expect(r.ok).toBe(false);
    }
    expect(db.tables.donations).toHaveLength(0);
  });
});

describe("createManualPayment — lewat qada'", () => {
  const years = qadaYearOptions(NOW);

  it("charges the delay multiplier per year, and stores the working", async () => {
    const hijri = years[2].hijriYear; // two Ramadans ago or so
    const passed = ramadansPassedSince(hijri, NOW);
    expect(passed).toBeGreaterThanOrEqual(2);

    const expected = 7 * passed * RATE;
    const r = await create(
      parse({
        category: "lewat_qada",
        days: undefined,
        qada: [{ hijri_year: hijri, days: 7 }],
        amount_sen: expected,
      })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.donation.amount_sen).toBe(expected);
    const row = db.tables.donations[0] as unknown as Donation;
    expect(row.qada_breakdown).toHaveLength(1);
    expect(row.qada_breakdown![0]).toMatchObject({
      hijri_year: hijri,
      days: 7,
      multiplier: passed,
      subtotal_sen: expected,
    });
  });

  it("sums several years, each with its own multiplier", async () => {
    const [a, b] = [years[1].hijriYear, years[3].hijriYear];
    const expected =
      5 * ramadansPassedSince(a, NOW) * RATE + 3 * ramadansPassedSince(b, NOW) * RATE;
    const r = await create(
      parse({
        category: "lewat_qada",
        days: undefined,
        qada: [
          { hijri_year: a, days: 5 },
          { hijri_year: b, days: 3 },
        ],
        amount_sen: expected,
      })
    );
    expect(r.ok).toBe(true);
  });

  it("answers AMOUNT_MISMATCH when the caller forgot the multiplier (days x rate only)", async () => {
    const hijri = years[2].hijriYear;
    const r = await create(
      parse({
        category: "lewat_qada",
        days: undefined,
        qada: [{ hijri_year: hijri, days: 7 }],
        amount_sen: 7 * RATE, // flat, no multiplier
      })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("AMOUNT_MISMATCH");
      expect((r.details as { amount_sen: number }).amount_sen).toBeGreaterThan(7 * RATE);
    }
  });

  it("refuses a year outside the supported range", async () => {
    const r = await create(
      parse({
        category: "lewat_qada",
        days: undefined,
        qada: [{ hijri_year: 1200, days: 7 }],
        amount_sen: 2800,
      })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_ORDER");
  });

  it("accepts RM5,000 and over by bank transfer and flags it requires_staff_review", async () => {
    // Every available year at the full 30 days is far past the threshold.
    const rows = years.map((y) => ({ hijri_year: y.hijriYear, days: 30 }));
    const total = rows.reduce(
      (sum, r) => sum + r.days * ramadansPassedSince(r.hijri_year, NOW) * RATE,
      0
    );
    expect(total).toBeGreaterThanOrEqual(QADA_REVIEW_THRESHOLD_SEN);

    const r = await create(
      parse({
        category: "lewat_qada",
        days: undefined,
        qada: rows,
        amount_sen: total,
        method: "bank_transfer",
      })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.requiresStaffReview).toBe(true);
    // Unlike an online payment, a large sum is not refused — it is recorded,
    // and stays pending for a person to check.
    expect(db.tables.donations[0].status).toBe("pending");
  });

  it("does not flag an ordinary amount", async () => {
    const r = await create(parse());
    expect(r.ok && r.requiresStaffReview).toBe(false);
  });
});

describe("createManualPayment — idempotency", () => {
  it("returns the existing record for a repeated key, and creates no duplicate", async () => {
    const first = await create(parse());
    const second = await create(parse());

    expect(first.ok && first.created).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.created).toBe(false);
    expect(second.donation.reference).toBe(first.donation.reference);
    expect(db.tables.donations).toHaveLength(1);
  });

  it("returns the original even if the repeat carries different details", async () => {
    const first = await create(parse());
    const second = await create(parse({ name: "Someone Else", days: 20, amount_sen: 8000 }));

    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.donation.reference).toBe(first.donation.reference);
    expect(second.donation.payer_name).toBe("Ahmad bin Ali");
    expect(db.tables.donations).toHaveLength(1);
  });

  it("treats different keys as different payments", async () => {
    await create(parse({ idempotency_key: "key-aaaaaaaa" }));
    await create(parse({ idempotency_key: "key-bbbbbbbb" }));
    expect(db.tables.donations).toHaveLength(2);
  });

  it("survives two requests racing: the loser gets the winner's record", async () => {
    // Our lookup finds nothing, then the "other request" inserts first, then
    // our insert hits the unique index.
    db.beforeInsert = (table) => {
      if (table !== "donations") return;
      db.beforeInsert = undefined;
      db.insertRow("donations", {
        reference: "FID-WINNER",
        idempotency_key: base.idempotency_key,
        payer_name: "Ahmad bin Ali",
        amount_sen: 4000,
        status: "pending",
        payment_method: "qr",
      });
    };

    const r = await create(parse());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.created).toBe(false);
    expect(r.donation.reference).toBe("FID-WINNER");
    expect(db.tables.donations).toHaveLength(1);
  });

  it("answers from the stored record even when the rate has changed since", async () => {
    const first = await create(parse());
    const afterRateChange = await createManualPayment(parse(), {
      supabase: db.client(),
      rateSen: 999,
      now: NOW,
    });
    expect(afterRateChange.ok).toBe(true);
    if (first.ok && afterRateChange.ok) {
      expect(afterRateChange.donation.reference).toBe(first.donation.reference);
    }
  });
});

describe("createManualPayment — database not migrated", () => {
  it("says so plainly instead of creating a record that could be duplicated", async () => {
    db.failNextInsert = {
      code: "PGRST204",
      message: "Could not find the 'idempotency_key' column of 'donations' in the schema cache",
    };
    const r = await create(parse());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(503);
      expect(r.code).toBe("MIGRATION_REQUIRED");
    }
  });

  it("recognises the old payment_method constraint refusing 'qr'", async () => {
    db.failNextInsert = {
      code: "23514",
      message:
        'new row for relation "donations" violates check constraint "donations_payment_method_check"',
    };
    const r = await create(parse());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MIGRATION_REQUIRED");
  });
});
