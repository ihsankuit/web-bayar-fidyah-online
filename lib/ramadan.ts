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
export function qadaYearOptions(now: Date, count = 20): QadaYearOption[] {
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

const MONTHS_MS = [
  "Jan", "Feb", "Mac", "Apr", "Mei", "Jun",
  "Jul", "Ogos", "Sep", "Okt", "Nov", "Dis",
];

/** "8 Feb 2027" */
export function formatCalendarDate(d: CalendarDate): string {
  return `${d.day} ${MONTHS_MS[d.month - 1]} ${d.year}`;
}
