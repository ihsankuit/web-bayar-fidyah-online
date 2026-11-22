import { describe, expect, it } from "vitest";

import {
  summariseUpsell,
  upsellAmount,
  buildRangeSeries,
  resolveRange,
  sumPaid,
  donationWhen,
} from "./stats";
import type { Donation } from "./database.types";

// 2026-11-22 10:00 Malaysia time = 02:00 UTC.
const NOW = new Date("2026-11-22T02:00:00Z");

const d = (over: Partial<Donation>): Donation =>
  ({
    id: Math.random().toString(),
    status: "paid",
    amount_sen: 1000,
    payer_email: "a@x.com",
    created_at: "2026-11-20T00:00:00Z",
    paid_at: null,
    ...over,
  }) as Donation;

describe("resolveRange", () => {
  it("7d covers today and the 6 days before, in Malaysian days", () => {
    const r = resolveRange({ range: "7d" }, NOW);
    expect(r.days).toBe(7);
    expect(r.to.toISOString()).toBe("2026-11-22T16:00:00.000Z"); // 23 Nov 00:00 MYT
    expect(r.from.toISOString()).toBe("2026-11-15T16:00:00.000Z"); // 16 Nov 00:00 MYT
    expect(r.granularity).toBe("day");
  });

  it("a payment at 00:30 MYT belongs to that Malaysian day, not the UTC one before", () => {
    const r = resolveRange({ range: "7d" }, NOW);
    const late = d({ paid_at: "2026-11-21T16:30:00Z" }); // 22 Nov 00:30 MYT
    const series = buildRangeSeries([late], r);
    expect(series).toHaveLength(7);
    expect(series[6].count).toBe(1); // 22 Nov is the last bucket
  });

  it("bulan-ini starts on the 1st (MYT) and bulan-lepas ends there", () => {
    const a = resolveRange({ range: "bulan-ini" }, NOW);
    const b = resolveRange({ range: "bulan-lepas" }, NOW);
    expect(a.from.toISOString()).toBe("2026-10-31T16:00:00.000Z");
    expect(b.to.getTime()).toBe(a.from.getTime());
    expect(b.days).toBe(31);
  });

  it("custom is inclusive of the end day and tolerates backwards dates", () => {
    const r = resolveRange({ range: "custom", from: "2026-11-10", to: "2026-11-12" }, NOW);
    expect(r.days).toBe(3);
    const back = resolveRange({ range: "custom", from: "2026-11-12", to: "2026-11-10" }, NOW);
    expect(back.from.getTime()).toBe(r.from.getTime());
    expect(back.to.getTime()).toBe(r.to.getTime());
  });

  it("falls back to the default for junk input instead of throwing", () => {
    for (const input of [
      { range: "nonsense" },
      { range: "custom", from: "2026-02-31", to: "2026-03-01" },
      { range: "custom", from: "abc", to: "def" },
      {},
    ]) {
      const r = resolveRange(input, NOW);
      expect(r.key).toBe("6m");
      expect(r.days).toBeGreaterThan(0);
    }
  });

  it("the previous window is the same length and directly before", () => {
    const r = resolveRange({ range: "30d" }, NOW);
    expect(r.previous?.to.getTime()).toBe(r.from.getTime());
    expect(r.to.getTime() - r.from.getTime()).toBe(r.from.getTime() - r.previous!.from.getTime());
  });

  it("'semua' has no previous window and starts at the first payment's month", () => {
    const r = resolveRange({ range: "semua" }, NOW, new Date("2026-03-15T00:00:00Z"));
    expect(r.previous).toBeNull();
    expect(r.granularity).toBe("month");
    expect(buildRangeSeries([], r)).toHaveLength(9); // Mar..Nov
  });

  it("long ranges bucket by month and label years when they span two", () => {
    const r = resolveRange({ range: "custom", from: "2025-11-01", to: "2026-02-28" }, NOW);
    const s = buildRangeSeries([], r);
    expect(s.map((p) => p.count)).toEqual([0, 0, 0, 0]);
    expect(s[0].label).toMatch(/25$/);
  });
});

describe("sumPaid / buildRangeSeries", () => {
  const r = resolveRange({ range: "30d" }, NOW);

  it("counts only paid money inside the window, placed by paid_at over created_at", () => {
    const rows = [
      d({ amount_sen: 4000 }),
      d({ amount_sen: 2000, created_at: "2026-01-01T00:00:00Z", paid_at: "2026-11-21T00:00:00Z" }),
      d({ amount_sen: 9999, status: "pending" }),
      d({ amount_sen: 8888, created_at: "2026-01-01T00:00:00Z" }), // outside
    ];
    const s = sumPaid(rows, r.from, r.to);
    expect(s.totalSen).toBe(6000);
    expect(s.count).toBe(2);
    expect(s.payers).toBe(1);
  });

  it("window is half-open: includes `from`, excludes `to`", () => {
    const at = (t: Date) => d({ paid_at: t.toISOString() });
    expect(sumPaid([at(r.from)], r.from, r.to).count).toBe(1);
    expect(sumPaid([at(r.to)], r.from, r.to).count).toBe(0);
  });

  it("series totals equal sumPaid", () => {
    const rows = [d({ amount_sen: 500 }), d({ amount_sen: 700, paid_at: "2026-11-05T03:00:00Z" })];
    const total = buildRangeSeries(rows, r).reduce((a, p) => a + p.total, 0);
    expect(total).toBe(sumPaid(rows, r.from, r.to).totalSen);
  });

  it("donationWhen prefers paid_at", () => {
    expect(donationWhen(d({ paid_at: "2026-11-01T00:00:00Z" })).toISOString()).toBe(
      "2026-11-01T00:00:00.000Z"
    );
  });
});

describe("upsell revenue", () => {
  const r = resolveRange({ range: "30d" }, NOW);
  const up = (over: Partial<Donation>) =>
    d({ amount_sen: 5000, upsell_accepted: true, upsell_amount_sen: 1000, upsell_title: "Wakaf", ...over });

  it("counts only the upsell part, only on paid donations that took it", () => {
    const rows = [
      up({}),
      up({ upsell_title: "Sedekah", upsell_amount_sen: 3000 }),
      up({ status: "pending" }), // not paid
      d({ amount_sen: 4000 }), // paid, no upsell
      d({ amount_sen: 4000, upsell_accepted: false, upsell_amount_sen: 500 }), // declined: leftover amount ignored
    ];
    const s = summariseUpsell(rows, r.from, r.to);
    expect(s.totalSen).toBe(4000);
    expect(s.count).toBe(2);
    expect(s.paidCount).toBe(4);
    expect(s.takeRate).toBe(50);
    expect(s.shareOfRevenue).toBe(Math.round((4000 / 18000) * 1000) / 10);
    expect(s.byTitle.map((t) => t.title)).toEqual(["Sedekah", "Wakaf"]);
    expect(s.byTitle[0].percent).toBe(100);
  });

  it("handles no payments and no upsells without dividing by zero", () => {
    const s = summariseUpsell([], r.from, r.to);
    expect(s).toMatchObject({ totalSen: 0, takeRate: 0, shareOfRevenue: 0, byTitle: [] });
  });

  it("series sums to the summary and ignores non-takers", () => {
    const rows = [up({}), up({ amount_sen: 6000, upsell_amount_sen: 2000 }), d({})];
    const total = buildRangeSeries(rows, r, upsellAmount).reduce((a, p) => a + p.total, 0);
    expect(total).toBe(summariseUpsell(rows, r.from, r.to).totalSen);
  });

  it("an untitled upsell is still listed", () => {
    const s = summariseUpsell([up({ upsell_title: null })], r.from, r.to);
    expect(s.byTitle[0].title).toBe("Kempen Tambahan");
  });
});
