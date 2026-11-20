import type { QadaBreakdownRow } from "@/lib/database.types";

/**
 * When Ramadan begins, and how many have begun since a given year.
 *
 * Fidyah for a delayed qada' is owed per Ramadan that arrives while the
 * qada' is still outstanding. Under the Shafi'i position the obligation
 * attaches when the next Ramadan ENTERS, not when it ends, so a Ramadan
 * counts as "passed" from its first day.
 *
 * Dates come from the Umm al-Qura calendar via Intl, which needs no data
 * file and works for every year a payer could plausibly owe. It can differ
 * from Malaysia's own announcement by a day, since JAKIM decides each year's
 * start by sighting criteria. A day only matters on the boundary itself, and
 * when JAKIM announces a year the correct date goes in RAMADAN_START_OVERRIDES
 * below — which wins over the calculation.
 */

/** A calendar date with no time or zone attached. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Official Malaysian start dates, as "YYYY-MM-DD", keyed by Hijri year.
 *
 * Empty on purpose: a date added here that is wrong is worse than the
 * calculation it replaces. Fill each one in from the JAKIM announcement,
 * and do it for the upcoming year before Ramadan so the calculator flips on
 * the right day.
 */
export const RAMADAN_START_OVERRIDES: Record<number, string> = {};

const MS_PER_DAY = 86_400_000;
const MEAN_LUNAR_MONTH_DAYS = 29.530588853;
/** 1 Muharram 1 AH, as days relative to the Unix epoch (JD 1948439.5). */
const HIJRI_EPOCH_UNIX_DAYS = 1948439.5 - 2440587.5;
/** Malaysia is UTC+8 with no daylight saving. */
const MYT_OFFSET_MS = 8 * 3_600_000;
/** Longest a Ramadan can run, and so the most days a year can owe. */
export const MAX_RAMADAN_DAYS = 30;
/** The category whose fidyah is owed per Ramadan that passed unmade. */
export const QADA_CATEGORY_ID = "lewat_qada";
/** How many Ramadans back a payer can say they missed. */
export const QADA_YEAR_SPAN = 40;
/** One row per missed year, so as many as can be offered. */
export const MAX_QADA_ROWS = 40;
/**
 * A lewat qada' total at or above this (RM5,000, in sen) is not charged
 * online: the payer is sent to bank transfer, where staff check the proof,
 * because the days are only what the payer says they missed.
 */
export const QADA_REVIEW_THRESHOLD_SEN = 500_000;

const hijriFormatter = (() => {
  try {
    return new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return null;
  }
})();

const startCache = new Map<number, CalendarDate>();

function toDate(unixDays: number): Date {
  // Noon UTC, so no zone rounding can tip it onto the neighbouring day.
  return new Date(Math.round(unixDays) * MS_PER_DAY + 12 * 3_600_000);
}

function toCalendarDate(date: Date): CalendarDate {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function dateKey(d: CalendarDate): number {
  return d.year * 10_000 + d.month * 100 + d.day;
}

function parseOverride(iso: string): CalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** The Hijri {year, month, day} of a moment, or null without Intl support. */
function hijriOf(date: Date): { year: number; month: number; day: number } | null {
  if (!hijriFormatter) return null;
  const parts = hijriFormatter.formatToParts(date);
  const read = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const year = read("year");
  const month = read("month");
  const day = read("day");
  if (![year, month, day].every(Number.isFinite)) return null;
  return { year, month, day };
}

/** The Gregorian date of 1 Ramadan in a Hijri year. */
export function ramadanStart(hijriYear: number): CalendarDate {
  const override = RAMADAN_START_OVERRIDES[hijriYear];
  if (override) {
    const parsed = parseOverride(override);
    if (parsed) return parsed;
  }

  const cached = startCache.get(hijriYear);
  if (cached) return cached;

  // The mean lunar calendar lands within a few days of the real one, so
  // estimate and then look for the exact day the calendar says is 1 Ramadan.
  // Ramadan is the 9th month, i.e. 8 whole months after 1 Muharram.
  const estimate =
    HIJRI_EPOCH_UNIX_DAYS +
    ((hijriYear - 1) * 12 + 8) * MEAN_LUNAR_MONTH_DAYS;

  let found: CalendarDate | null = null;
  for (let offset = -8; offset <= 8 && !found; offset++) {
    const candidate = toDate(estimate + offset);
    const h = hijriOf(candidate);
    if (h && h.year === hijriYear && h.month === 9 && h.day === 1) {
      found = toCalendarDate(candidate);
    }
  }

  // No Intl support: the estimate is still within a few days, which is far
  // better than refusing to calculate.
  const result = found ?? toCalendarDate(toDate(estimate));
  startCache.set(hijriYear, result);
  return result;
}

/** Today's date in Malaysia, whatever zone the device is set to. */
function todayInMalaysia(now: Date): CalendarDate {
  return toCalendarDate(new Date(now.getTime() + MYT_OFFSET_MS));
}

/** The most recent Hijri year whose Ramadan has already begun. */
export function latestRamadanHijriYear(now: Date): number {
  const today = dateKey(todayInMalaysia(now));
  const unixDays = now.getTime() / MS_PER_DAY;
  let year = Math.floor((unixDays - HIJRI_EPOCH_UNIX_DAYS) / (12 * MEAN_LUNAR_MONTH_DAYS)) + 1;

  while (dateKey(ramadanStart(year + 1)) <= today) year++;
  while (dateKey(ramadanStart(year)) > today) year--;
  return year;
}

/** How many Ramadans have begun since the Ramadan of `hijriYear`. */
export function ramadansPassedSince(hijriYear: number, now: Date): number {
  return Math.max(0, latestRamadanHijriYear(now) - hijriYear);
}

/** The next Ramadan that has not started yet. */
export function nextRamadan(now: Date): { hijriYear: number; start: CalendarDate } {
  const hijriYear = latestRamadanHijriYear(now) + 1;
  return { hijriYear, start: ramadanStart(hijriYear) };
}

export interface QadaYearOption {
  hijriYear: number;
  gregorianYear: number;
  /** "2025 (1446H)" */
  label: string;
}

/**
 * The years a payer can say they missed, newest first.
 *
 * Only Ramadans that have already begun are offered: a fast cannot have been
 * missed in a Ramadan that has not happened.
 */
export function qadaYearOptions(now: Date, count = QADA_YEAR_SPAN): QadaYearOption[] {
  const latest = latestRamadanHijriYear(now);
  return Array.from({ length: count }, (_, i) => {
    const hijriYear = latest - i;
    const gregorianYear = ramadanStart(hijriYear).year;
    return { hijriYear, gregorianYear, label: `${gregorianYear} (${hijriYear}H)` };
  });
}

export interface QadaRowInput {
  hijriYear: number;
  days: number;
}

export interface QadaRowResult {
  hijriYear: number;
  label: string;
  /** Days the payer says they missed that year, as entered (clamped). */
  days: number;
  /** Ramadans that have begun since — what the days are multiplied by. */
  multiplier: number;
  subtotalSen: number;
}

export interface QadaResult {
  rows: QadaRowResult[];
  /** Everything the payer declared, including years with no fidyah yet. */
  declaredDays: number;
  /** Days x multiplier summed across rows: what is actually charged for. */
  chargeableDays: number;
  rateSen: number;
  totalSen: number;
}

/** Fidyah for delayed qada', row by row. */
export function calculateQada(
  rows: QadaRowInput[],
  rateSen: number,
  now: Date
): QadaResult {
  const results: QadaRowResult[] = rows.map((row) => {
    const days = Math.min(
      MAX_RAMADAN_DAYS,
      Math.max(0, Math.floor(row.days || 0))
    );
    const multiplier = ramadansPassedSince(row.hijriYear, now);
    return {
      hijriYear: row.hijriYear,
      label: `${ramadanStart(row.hijriYear).year} (${row.hijriYear}H)`,
      days,
      multiplier,
      subtotalSen: days * multiplier * rateSen,
    };
  });

  const chargeableDays = results.reduce((sum, r) => sum + r.days * r.multiplier, 0);
  return {
    rows: results,
    declaredDays: results.reduce((sum, r) => sum + r.days, 0),
    chargeableDays,
    rateSen,
    totalSen: chargeableDays * rateSen,
  };
}

/**
 * One line recording how a lewat-qada' total was reached.
 *
 * The donation row stores a single days figure and a single multiplier, so
 * a total built from several years has to be flattened to fit. This is what
 * keeps the arithmetic recoverable by whoever reads the record afterwards.
 */
export function qadaBreakdownNote(result: QadaResult): string {
  const parts = result.rows.map((r) => `${r.label} ${r.days} hari x${r.multiplier}`);
  return `Lewat qada': ${parts.join("; ")}. Hari dikenakan: ${result.chargeableDays}.`;
}

export type QadaValidation =
  | { ok: true; rows: QadaRowInput[] }
  | { ok: false; error: string };

/**
 * Whether a set of rows is something a payer could really owe.
 *
 * The form can only produce valid rows, so on the form's own requests this
 * guards against a stale tab or a hand-built request. For the API it is the
 * actual check: a bot can send anything. Unlike calculateQada, which clamps
 * so the form never shows a broken figure, this rejects, because a payment
 * should never be taken for a number nobody asked for.
 */
export function validateQadaRows(rows: QadaRowInput[], now: Date): QadaValidation {
  if (rows.length === 0) {
    return { ok: false, error: "Sila pilih sekurang-kurangnya satu tahun." };
  }
  if (rows.length > MAX_QADA_ROWS) {
    return { ok: false, error: `Paling banyak ${MAX_QADA_ROWS} tahun sekali bayar.` };
  }

  const latest = latestRamadanHijriYear(now);
  const oldest = latest - (QADA_YEAR_SPAN - 1);
  const seen = new Set<number>();

  for (const row of rows) {
    if (!Number.isInteger(row.hijriYear)) {
      return { ok: false, error: "Tahun Hijrah tidak sah." };
    }
    if (row.hijriYear > latest) {
      return {
        ok: false,
        error: `Ramadan ${row.hijriYear}H belum bermula, jadi tiada puasa yang boleh ditinggalkan.`,
      };
    }
    if (row.hijriYear < oldest) {
      return {
        ok: false,
        error: `Tahun ${row.hijriYear}H terlalu lama. Pilih ${oldest}H hingga ${latest}H.`,
      };
    }
    if (seen.has(row.hijriYear)) {
      return { ok: false, error: `Tahun ${row.hijriYear}H dipilih lebih sekali.` };
    }
    seen.add(row.hijriYear);

    if (!Number.isInteger(row.days) || row.days < 1 || row.days > MAX_RAMADAN_DAYS) {
      return {
        ok: false,
        error: `Bilangan hari bagi ${row.hijriYear}H mesti antara 1 dan ${MAX_RAMADAN_DAYS}.`,
      };
    }
  }
  return { ok: true, rows };
}

export type QadaOrder =
  | {
      ok: true;
      /** Days x multiplier summed: what is charged for. */
      chargeableDays: number;
      totalSen: number;
      breakdown: QadaBreakdownRow[];
      /** The same working as one line, for where a table will not fit. */
      note: string;
    }
  | { ok: false; error: string };

/**
 * Turn the years a payer chose into an amount, the way the server does it.
 *
 * Everything that charges for lewat qada' goes through here, so the form, the
 * API and the chatbot cannot disagree about what a set of years costs.
 */
export function resolveQadaOrder(
  rows: QadaRowInput[],
  rateSen: number,
  now: Date
): QadaOrder {
  const valid = validateQadaRows(rows, now);
  if (!valid.ok) return valid;

  const result = calculateQada(valid.rows, rateSen, now);
  if (result.totalSen === 0) {
    return {
      ok: false,
      error:
        "Tiada fidyah kelewatan bagi tahun yang dipilih lagi. Qada' puasa sebelum Ramadan berikutnya.",
    };
  }

  return {
    ok: true,
    chargeableDays: result.chargeableDays,
    totalSen: result.totalSen,
    breakdown: result.rows.map((r) => ({
      hijri_year: r.hijriYear,
      label: r.label,
      days: r.days,
      multiplier: r.multiplier,
      subtotal_sen: r.subtotalSen,
    })),
    note: qadaBreakdownNote(result),
  };
}

/** A stored breakdown as one line: "2025 (1446H) 12 hari x1; ...". */
export function formatQadaBreakdown(rows: QadaBreakdownRow[]): string {
  return rows.map((r) => `${r.label} ${r.days} hari x${r.multiplier}`).join("; ");
}

function isoDate(d: CalendarDate): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}

/**
 * What a caller needs to choose years without doing any calendar work: the
 * years on offer, what each is multiplied by today, and when that next
 * changes. For the API, so a chatbot never has to reason about Hijri dates.
 */
export function qadaYearsInfo(now: Date, rateSen: number) {
  const upcoming = nextRamadan(now);
  return {
    rate_sen: rateSen,
    max_days_per_year: MAX_RAMADAN_DAYS,
    max_years: MAX_QADA_ROWS,
    years: qadaYearOptions(now).map((o) => ({
      hijri_year: o.hijriYear,
      gregorian_year: o.gregorianYear,
      label: o.label,
      multiplier: ramadansPassedSince(o.hijriYear, now),
    })),
    next_ramadan: {
      hijri_year: upcoming.hijriYear,
      approx_start: isoDate(upcoming.start),
      note: "Gandaan setiap tahun bertambah satu apabila Ramadan ini bermula.",
    },
  };
}

const MONTHS_MS = [
  "Jan", "Feb", "Mac", "Apr", "Mei", "Jun",
  "Jul", "Ogos", "Sep", "Okt", "Nov", "Dis",
];

/** "8 Feb 2027" */
export function formatCalendarDate(d: CalendarDate): string {
  return `${d.day} ${MONTHS_MS[d.month - 1]} ${d.year}`;
}
