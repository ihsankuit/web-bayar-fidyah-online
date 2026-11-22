import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeDb } from "./test-helpers/fake-supabase";

// Everything a confirmation fires, observed rather than performed.
const mocks = vi.hoisted(() => ({
  receipt: vi.fn(),
  whatsapp: vi.fn(),
  conversion: vi.fn(),
  webhook: vi.fn(),
  db: null as unknown as { client(): unknown },
}));

vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    void fn();
  },
}));
vi.mock("@/lib/resend", () => ({ sendReceiptEmail: mocks.receipt }));
vi.mock("@/lib/notifications", () => ({ sendPaymentSuccessWhatsApp: mocks.whatsapp }));
vi.mock("@/lib/tracking/conversions", () => ({ sendServerConversion: mocks.conversion }));
vi.mock("@/lib/webhooks", () => ({ emitDonationEvent: mocks.webhook }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mocks.db.client() }));

import { confirmDonationPaid, markDonationPaid } from "./donations";

let db: FakeDb;
let id: string;

function seed(overrides: Record<string, unknown> = {}) {
  const row = db.insertRow("donations", {
    reference: "FID-QR000001",
    payment_method: "qr",
    status: "pending",
    amount_sen: 4000,
    payer_name: "Ahmad",
    payer_email: "a@example.com",
    paid_at: null,
    claimed_paid_at: null,
    ...overrides,
  });
  id = String(row.id);
}

beforeEach(() => {
  vi.clearAllMocks();
  db = new FakeDb();
  mocks.db = db;
});

describe("confirming an API-recorded payment", () => {
  it("marks it paid and sends the receipt, webhook, WhatsApp and conversion once each", async () => {
    seed();
    const r = await confirmDonationPaid(id);

    expect(r.confirmed).toBe(true);
    expect(r.donation?.status).toBe("paid");
    expect(db.tables.donations[0].status).toBe("paid");
    expect(mocks.receipt).toHaveBeenCalledTimes(1);
    expect(mocks.webhook).toHaveBeenCalledTimes(1);
    expect(mocks.webhook.mock.calls[0][0]).toBe("donation.paid");
    expect(mocks.whatsapp).toHaveBeenCalledTimes(1);
    expect(mocks.conversion).toHaveBeenCalledTimes(1);
  });

  it("confirms exactly once when two staff confirm at the same moment", async () => {
    seed();
    const [a, b] = await Promise.all([confirmDonationPaid(id), confirmDonationPaid(id)]);

    // One of them won; the other found it already done.
    expect([a.confirmed, b.confirmed].filter(Boolean)).toHaveLength(1);
    expect(a.donation?.status).toBe("paid");
    expect(b.donation?.status).toBe("paid");

    // The acceptance criterion: one receipt, one paid event, one conversion,
    // however many times the button was pressed.
    expect(mocks.receipt).toHaveBeenCalledTimes(1);
    expect(mocks.webhook).toHaveBeenCalledTimes(1);
    expect(mocks.whatsapp).toHaveBeenCalledTimes(1);
    expect(mocks.conversion).toHaveBeenCalledTimes(1);
  });

  it("does nothing the second time it is confirmed", async () => {
    seed();
    await confirmDonationPaid(id);
    const again = await confirmDonationPaid(id);

    expect(again.confirmed).toBe(false);
    expect(mocks.receipt).toHaveBeenCalledTimes(1);
    expect(mocks.webhook).toHaveBeenCalledTimes(1);
  });

  it("hands back the record without side effects for markDonationPaid too", async () => {
    seed({ status: "paid" });
    const d = await markDonationPaid(id);
    expect(d?.status).toBe("paid");
    expect(mocks.receipt).not.toHaveBeenCalled();
  });

  it("uses the time the sender said they paid, once staff confirm", async () => {
    seed({ claimed_paid_at: "2026-11-22T02:15:00.000Z" });
    const r = await confirmDonationPaid(id);
    expect(r.donation?.paid_at).toBe("2026-11-22T02:15:00.000Z");
  });

  it("falls back to now when no payment time was reported", async () => {
    seed();
    const before = Date.now();
    const r = await confirmDonationPaid(id);
    const paidAt = new Date(String(r.donation?.paid_at)).getTime();
    expect(paidAt).toBeGreaterThanOrEqual(before);
    expect(paidAt).toBeLessThanOrEqual(Date.now());
  });

  it("returns nothing for a record that does not exist", async () => {
    const r = await confirmDonationPaid("nope");
    expect(r.donation).toBeNull();
    expect(r.confirmed).toBe(false);
    expect(mocks.receipt).not.toHaveBeenCalled();
  });
});
