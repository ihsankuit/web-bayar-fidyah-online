import { describe, expect, it } from "vitest";
import {
  calculateQada,
  formatCalendarDate,
  latestRamadanHijriYear,
  MAX_RAMADAN_DAYS,
  nextRamadan,
  qadaBreakdownNote,
  qadaYearOptions,
  ramadanStart,
  ramadansPassedSince,
  formatQadaBreakdown,
  qadaYearsInfo,
  QADA_REVIEW_THRESHOLD_SEN,
  resolveQadaOrder,
  validateQadaRows,
} from "./ramadan";

/** A fixed "today" inside Malaysia: 20 Nov 2026, after Ramadan 1447H. */
const NOV_2026 = new Date("2026-11-20T03:00:00Z");
const RATE = 400;

describe("ramadanStart", () => {
  it("matches a start date Malaysia and Umm al-Qura agree on", () => {
    // 1 Mac 2025: JAKIM and the calendar both say so, so it is safe to pin.
    expect(ramadanStart(1446)).toEqual({ year: 2025, month: 3, day: 1 });
  });

  it("moves about 11 days earlier each Gregorian year", () => {
    for (let y = 1430; y < 1450; y++) {
      const a = ramadanStart(y);
      const b = ramadanStart(y + 1);
      const gap =
        (Date.UTC(b.year, b.month - 1, b.day) -
          Date.UTC(a.year, a.month - 1, a.day)) /
        86_400_000;
      // A Hijri year is 354 or 355 days.
      expect(gap).toBeGreaterThanOrEqual(354);
      expect(gap).toBeLessThanOrEqual(355);
    }
  });
});

describe("latestRamadanHijriYear", () => {
  it("is 1447 in November 2026, after that year's Ramadan", () => {
    expect(latestRamadanHijriYear(NOV_2026)).toBe(1447);
  });

  it("counts a Ramadan as begun on its first day, not its last", () => {
    const first = ramadanStart(1446); // 1 Mac 2025
    // Noon Malaysia time on the first day.
    const onFirstDay = new Date(
      Date.UTC(first.year, first.month - 1, first.day, 4, 0, 0)
    );
    expect(latestRamadanHijriYear(onFirstDay)).toBe(1446);
  });

  it("is still the previous year the day before Ramadan starts", () => {
    const first = ramadanStart(1446);
    const dayBefore = new Date(
      Date.UTC(first.year, first.month - 1, first.day - 1, 4, 0, 0)
    );
    expect(latestRamadanHijriYear(dayBefore)).toBe(1445);
  });

  it("uses Malaysia's date, not the device's or UTC's", () => {
    const first = ramadanStart(1446);
    // 23:00 UTC the evening before is already 07:00 on the first day in
    // Malaysia, so Ramadan has begun there.
    const lateUtc = new Date(
      Date.UTC(first.year, first.month - 1, first.day - 1, 23, 0, 0)
    );
    expect(latestRamadanHijriYear(lateUtc)).toBe(1446);

    // 15:00 UTC the evening before is 23:00 the evening before in Malaysia:
    // not yet.
    const earlyUtc = new Date(
      Date.UTC(first.year, first.month - 1, first.day - 1, 15, 0, 0)
    );
    expect(latestRamadanHijriYear(earlyUtc)).toBe(1445);
  });
});

describe("ramadansPassedSince", () => {
  it("counts Ramadans after the missed one", () => {
    expect(ramadansPassedSince(1446, NOV_2026)).toBe(1);
    expect(ramadansPassedSince(1444, NOV_2026)).toBe(3);
  });

  it("is zero for the most recent Ramadan: the next has not arrived", () => {
    expect(ramadansPassedSince(1447, NOV_2026)).toBe(0);
  });

  it("never goes negative for a year that has not happened", () => {
    expect(ramadansPassedSince(1450, NOV_2026)).toBe(0);
  });
});

describe("nextRamadan", () => {
  it("is 1448 in November 2026, early in February 2027", () => {
    const next = nextRamadan(NOV_2026);
    expect(next.hijriYear).toBe(1448);
    expect(next.start.year).toBe(2027);
    expect(next.start.month).toBe(2);
  });
});

describe("qadaYearOptions", () => {
  it("offers the latest begun Ramadan first, newest to oldest", () => {
    const options = qadaYearOptions(NOV_2026, 5);
    expect(options.map((o) => o.hijriYear)).toEqual([1447, 1446, 1445, 1444, 1443]);
    expect(options[1].label).toBe("2025 (1446H)");
  });

  it("never offers a Ramadan that has not started", () => {
    const options = qadaYearOptions(NOV_2026);
    expect(options.every((o) => o.hijriYear <= 1447)).toBe(true);
  });
});

describe("calculateQada", () => {
  it("charges the delay multiplier per year, as in the worked example", () => {
    // 12 days missed in 2025: one Ramadan has passed, so x1. 13 days missed
    // in 2026: the next Ramadan has not arrived, so x0.
    const result = calculateQada(
      [
        { hijriYear: 1446, days: 12 },
        { hijriYear: 1447, days: 13 },
      ],
      RATE,
      NOV_2026
    );

    expect(result.rows.map((r) => r.multiplier)).toEqual([1, 0]);
    expect(result.rows.map((r) => r.subtotalSen)).toEqual([4800, 0]);
    expect(result.declaredDays).toBe(25);
    expect(result.chargeableDays).toBe(12);
    expect(result.totalSen).toBe(4800);
  });

  it("multiplies an older year by every Ramadan since", () => {
    // Missed in 1444 (2023); 1445, 1446 and 1447 have all begun since.
    const result = calculateQada([{ hijriYear: 1444, days: 5 }], RATE, NOV_2026);
    expect(result.rows[0].multiplier).toBe(3);
    expect(result.chargeableDays).toBe(15);
    expect(result.totalSen).toBe(6000);
  });

  it("is zero when every year is still within its qada' window", () => {
    const result = calculateQada([{ hijriYear: 1447, days: 10 }], RATE, NOV_2026);
    expect(result.totalSen).toBe(0);
    expect(result.declaredDays).toBe(10);
    expect(result.chargeableDays).toBe(0);
  });

  it("flips the day the next Ramadan begins", () => {
    const start = nextRamadan(NOV_2026).start;
    const dayBefore = new Date(
      Date.UTC(start.year, start.month - 1, start.day - 1, 4)
    );
    const onTheDay = new Date(
      Date.UTC(start.year, start.month - 1, start.day, 4)
    );
    const rows = [{ hijriYear: 1447, days: 10 }];

    expect(calculateQada(rows, RATE, dayBefore).totalSen).toBe(0);
    expect(calculateQada(rows, RATE, onTheDay).totalSen).toBe(10 * 1 * RATE);
  });

  it("caps a year at the length of Ramadan", () => {
    const result = calculateQada([{ hijriYear: 1446, days: 99 }], RATE, NOV_2026);
    expect(result.rows[0].days).toBe(MAX_RAMADAN_DAYS);
    expect(result.declaredDays).toBe(MAX_RAMADAN_DAYS);
  });

  it("treats a negative or fractional day count safely", () => {
    const result = calculateQada(
      [
        { hijriYear: 1446, days: -4 },
        { hijriYear: 1445, days: 2.9 },
      ],
      RATE,
      NOV_2026
    );
    expect(result.rows.map((r) => r.days)).toEqual([0, 2]);
  });

  it("handles no rows at all", () => {
    const result = calculateQada([], RATE, NOV_2026);
    expect(result.totalSen).toBe(0);
    expect(result.rows).toEqual([]);
  });

  it("follows the rate it is given", () => {
    const result = calculateQada([{ hijriYear: 1446, days: 10 }], 500, NOV_2026);
    expect(result.totalSen).toBe(5000);
  });
});

describe("qadaBreakdownNote", () => {
  it("records each year's days and multiplier plus the charged total", () => {
    const result = calculateQada(
      [
        { hijriYear: 1446, days: 12 },
        { hijriYear: 1447, days: 13 },
      ],
      RATE,
      NOV_2026
    );
    expect(qadaBreakdownNote(result)).toBe(
      "Lewat qada': 2025 (1446H) 12 hari x1; 2026 (1447H) 13 hari x0. Hari dikenakan: 12."
    );
  });
});

describe("formatCalendarDate", () => {
  it("writes the Malay month", () => {
    expect(formatCalendarDate({ year: 2027, month: 2, day: 8 })).toBe("8 Feb 2027");
    expect(formatCalendarDate({ year: 2025, month: 3, day: 1 })).toBe("1 Mac 2025");
  });
});

describe("validateQadaRows", () => {
  const ok = (rows: { hijriYear: number; days: number }[]) =>
    validateQadaRows(rows, NOV_2026).ok;

  it("accepts a normal selection", () => {
    expect(ok([{ hijriYear: 1446, days: 12 }])).toBe(true);
  });
  it("rejects nothing, too many rows, and duplicates", () => {
    expect(ok([])).toBe(false);
    const sixty = Array.from({ length: 60 }, (_, i) => ({ hijriYear: 1447 - i, days: 1 }));
    expect(ok(sixty)).toBe(true);
    const many = [...sixty, { hijriYear: 1386, days: 1 }];
    expect(ok(many)).toBe(false);
    expect(
      ok([
        { hijriYear: 1446, days: 1 },
        { hijriYear: 1446, days: 2 },
      ])
    ).toBe(false);
  });
  it("rejects a Ramadan that has not begun, or one too far back", () => {
    expect(ok([{ hijriYear: 1448, days: 1 }])).toBe(false);
    expect(ok([{ hijriYear: 1447 - 59, days: 1 }])).toBe(true);
    expect(ok([{ hijriYear: 1447 - 60, days: 1 }])).toBe(false);
  });
  it("rejects days outside 1-30 and non-integers", () => {
    expect(ok([{ hijriYear: 1446, days: 0 }])).toBe(false);
    expect(ok([{ hijriYear: 1446, days: 31 }])).toBe(false);
    expect(ok([{ hijriYear: 1446, days: 2.5 }])).toBe(false);
    expect(ok([{ hijriYear: 1446.5, days: 2 }])).toBe(false);
  });
});

describe("resolveQadaOrder", () => {
  it("prices the worked example and freezes the breakdown", () => {
    const r = resolveQadaOrder(
      [
        { hijriYear: 1446, days: 12 },
        { hijriYear: 1447, days: 13 },
      ],
      RATE,
      NOV_2026
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.totalSen).toBe(4800);
    expect(r.chargeableDays).toBe(12);
    expect(r.breakdown).toEqual([
      { hijri_year: 1446, label: "2025 (1446H)", days: 12, multiplier: 1, subtotal_sen: 4800 },
      { hijri_year: 1447, label: "2026 (1447H)", days: 13, multiplier: 0, subtotal_sen: 0 },
    ]);
    expect(formatQadaBreakdown(r.breakdown)).toBe(
      "2025 (1446H) 12 hari x1; 2026 (1447H) 13 hari x0"
    );
  });
  it("fails when nothing is chargeable yet", () => {
    const r = resolveQadaOrder([{ hijriYear: 1447, days: 5 }], RATE, NOV_2026);
    expect(r.ok).toBe(false);
  });
  it("passes validation errors through", () => {
    expect(resolveQadaOrder([], RATE, NOV_2026).ok).toBe(false);
  });
});

describe("qadaYearsInfo", () => {
  it("lists years newest first with today's multipliers", () => {
    const info = qadaYearsInfo(NOV_2026, RATE);
    expect(info.years[0]).toMatchObject({ hijri_year: 1447, multiplier: 0 });
    expect(info.years[1]).toMatchObject({ hijri_year: 1446, multiplier: 1 });
    expect(info.next_ramadan.hijri_year).toBe(1448);
    expect(info.max_years).toBe(60);
    expect(info.years).toHaveLength(60);
  });
});

describe("a long-owed qada'", () => {
  it("prices 30 years of 30 days, one Ramadan more for each older year", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ hijriYear: 1446 - i, days: 30 }));
    const r = resolveQadaOrder(rows, RATE, NOV_2026);
    if (!r.ok) throw new Error(r.error);
    // Multipliers 1..30, so 30 days x (1+2+...+30) x RM4.
    expect(r.chargeableDays).toBe(30 * (30 * 31) / 2);
    expect(r.totalSen).toBe(30 * 465 * RATE);
    expect(r.totalSen).toBeGreaterThanOrEqual(QADA_REVIEW_THRESHOLD_SEN);
  });
  it("keeps an ordinary payment under the review threshold", () => {
    const r = resolveQadaOrder([{ hijriYear: 1446, days: 12 }], RATE, NOV_2026);
    if (!r.ok) throw new Error(r.error);
    expect(r.totalSen).toBeLessThan(QADA_REVIEW_THRESHOLD_SEN);
  });
});

describe("basic-only qada' (cannot afford the multiplier)", () => {
  it("charges days x rate with no multiplier and records what was waived", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ hijriYear: 1447 - i, days: 30 }));
    const full = resolveQadaOrder(rows, RATE, NOV_2026);
    const basic = resolveQadaOrder(rows, RATE, NOV_2026, { basicOnly: true });
    if (!full.ok || !basic.ok) throw new Error("expected ok");
    // 1447H is the latest Ramadan and owes nothing yet, so 39 years are charged.
    expect(basic.totalSen).toBe(39 * 30 * RATE); // RM4,680
    expect(basic.totalSen).toBeLessThan(QADA_REVIEW_THRESHOLD_SEN);
    expect(full.totalSen).toBeGreaterThan(basic.totalSen);
    // The oldest year was x39 and is now charged x1, with the real figure kept.
    expect(basic.breakdown[39]).toMatchObject({ multiplier: 1, waived_multiplier: 39 });
    // A year already at x1 has nothing waived.
    expect(basic.breakdown[1].waived_multiplier).toBeUndefined();
  });
  it("still charges nothing for a year whose next Ramadan has not begun", () => {
    const r = calculateQada([{ hijriYear: 1447, days: 10 }], RATE, NOV_2026, { basicOnly: true });
    expect(r.totalSen).toBe(0);
  });
  it("shows what was waived in the one-line breakdown", () => {
    const r = resolveQadaOrder([{ hijriYear: 1444, days: 5 }], RATE, NOV_2026, { basicOnly: true });
    if (!r.ok) throw new Error(r.error);
    expect(r.totalSen).toBe(5 * RATE);
    expect(formatQadaBreakdown(r.breakdown)).toBe("2023 (1444H) 5 hari x1 (sebenar x3)");
  });
});

describe("a payer owing since 1982", () => {
  it("can choose from 1402H, whose Ramadan began on 23 June 1982", () => {
    expect(ramadanStart(1402)).toEqual({ year: 1982, month: 6, day: 23 });
    const rows = Array.from({ length: 45 }, (_, i) => ({ hijriYear: 1446 - i, days: 30 }));
    const full = resolveQadaOrder(rows, RATE, NOV_2026);
    const basic = resolveQadaOrder(rows, RATE, NOV_2026, { basicOnly: true });
    if (!full.ok || !basic.ok) throw new Error("expected ok");
    // Multipliers 1..45: 30 days x 1035 x RM4.
    expect(full.totalSen).toBe(30 * 1035 * RATE);
    // Basic: 45 years x 30 days x RM4, still over the online limit.
    expect(basic.totalSen).toBe(45 * 30 * RATE);
    expect(basic.totalSen).toBeGreaterThanOrEqual(QADA_REVIEW_THRESHOLD_SEN);
  });
});
