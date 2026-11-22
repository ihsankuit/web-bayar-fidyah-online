import type { Donation } from "@/lib/database.types";
import type { PaymentPoint } from "@/components/admin/payments-chart";

const monthFmt = new Intl.DateTimeFormat("ms-MY", { month: "short" });

/**
 * Bucket paid donations into the last `months` calendar months (inclusive of
 * the current month), returning totals in sen and counts per month. Months
 * with no payments are included with zero so the axis stays continuous.
 */
export function buildMonthlySeries(
  donations: Donation[],
  months = 6
): PaymentPoint[] {
  const now = new Date();
  const buckets = new Map<string, PaymentPoint>();
  const order: string[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    order.push(key);
    buckets.set(key, { label: monthFmt.format(d), total: 0, count: 0 });
  }

  for (const donation of donations) {
    if (donation.status !== "paid") continue;
    const when = new Date(donation.paid_at ?? donation.created_at);
    const key = `${when.getFullYear()}-${when.getMonth()}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.total += donation.amount_sen;
      bucket.count += 1;
    }
  }

  return order.map((key) => buckets.get(key)!);
}

export interface BreakdownItem {
  label: string;
  totalSen: number;
  count: number;
  percent: number;
}

/**
 * Sum paid donation amounts grouped by an arbitrary key (category or negeri),
 * sorted descending. `percent` is relative to the largest bucket, for simple
 * bar-chart widths.
 */
export function buildBreakdown(
  donations: Donation[],
  keyOf: (d: Donation) => string
): BreakdownItem[] {
  const buckets = new Map<string, { totalSen: number; count: number }>();

  for (const donation of donations) {
    if (donation.status !== "paid") continue;
    const key = keyOf(donation);
    const bucket = buckets.get(key) ?? { totalSen: 0, count: 0 };
    bucket.totalSen += donation.amount_sen;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const items = Array.from(buckets.entries())
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.totalSen - a.totalSen);

  const max = items[0]?.totalSen ?? 0;
  return items.map((item) => ({
    ...item,
    percent: max > 0 ? Math.round((item.totalSen / max) * 100) : 0,
  }));
}

/** Percentage change from `previous` to `current`, or null if not computable. */
export function momChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface SourcePoint {
  source: string;
  total: number;
  count: number;
}

/**
 * Rank paid donations by `utm_source` (falling back to "Direct" when unset),
 * highest total first. Used to show which campaigns/channels are converting.
 */
export function buildSourceBreakdown(
  donations: Donation[],
  limit = 6
): SourcePoint[] {
  const buckets = new Map<string, SourcePoint>();

  for (const donation of donations) {
    if (donation.status !== "paid") continue;
    const key = donation.utm_source?.trim() || "Direct";
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.total += donation.amount_sen;
      bucket.count += 1;
    } else {
      buckets.set(key, { source: key, total: donation.amount_sen, count: 1 });
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Date ranges for the dashboard
// ---------------------------------------------------------------------------

/** Malaysia is UTC+8 all year (no daylight saving), so a fixed shift is exact. */
const MYT_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant at which the Malaysian day containing `d` began. */
function mytDayStart(d: Date): Date {
  const s = new Date(d.getTime() + MYT_MS);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) - MYT_MS);
}

/** The instant the Malaysian month containing `d` (shifted by `offset` months) began. */
function mytMonthStart(d: Date, offset = 0): Date {
  const s = new Date(d.getTime() + MYT_MS);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + offset, 1) - MYT_MS);
}

export type RangeKey =
  | "7d"
  | "30d"
  | "90d"
  | "6m"
  | "bulan-ini"
  | "bulan-lepas"
  | "tahun-ini"
  | "semua"
  | "custom";

export const RANGE_PRESETS: { key: Exclude<RangeKey, "custom">; label: string }[] = [
  { key: "7d", label: "7 hari" },
  { key: "30d", label: "30 hari" },
  { key: "90d", label: "90 hari" },
  { key: "6m", label: "6 bulan" },
  { key: "bulan-ini", label: "Bulan ini" },
  { key: "bulan-lepas", label: "Bulan lepas" },
  { key: "tahun-ini", label: "Tahun ini" },
  { key: "semua", label: "Semua" },
];

export const DEFAULT_RANGE: RangeKey = "6m";

export interface DateRange {
  key: RangeKey;
  /** Inclusive start. */
  from: Date;
  /** Exclusive end. */
  to: Date;
  /** Whole days covered. */
  days: number;
  /** Chart bucket size: days for a short range, months for a long one. */
  granularity: "day" | "month";
  /** e.g. "16 Nov 2026 – 22 Nov 2026" */
  label: string;
  /** The window of equal length immediately before, or null when meaningless. */
  previous: { from: Date; to: Date } | null;
}

const dayFmt = new Intl.DateTimeFormat("ms-MY", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function fmtDay(instant: Date): string {
  return dayFmt.format(new Date(instant.getTime() + MYT_MS));
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A YYYY-MM-DD typed as a Malaysian date, as the instant its day began; null if invalid. */
function parseMytDay(value: string | undefined): Date | null {
  const m = value ? ISO_DAY.exec(value) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const check = new Date(t);
  // Reject 2026-02-31 and friends rather than letting Date roll them over.
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return new Date(t - MYT_MS);
}

/**
 * Turn the dashboard's query string into a concrete range. Anything unknown or
 * malformed falls back to the default rather than erroring: a bad link should
 * still show a dashboard.
 *
 * `earliest` is only used by "semua", to start the axis at the first payment
 * instead of at the dawn of time.
 */
export function resolveRange(
  input: { range?: string; from?: string; to?: string },
  now: Date,
  earliest?: Date | null
): DateRange {
  const today = mytDayStart(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  let key = (input.range as RangeKey) ?? DEFAULT_RANGE;
  let from: Date;
  let to: Date = tomorrow;

  const lastNDays = (n: number) => new Date(tomorrow.getTime() - n * DAY_MS);

  if (key === "custom") {
    const a = parseMytDay(input.from);
    const b = parseMytDay(input.to);
    if (a && b) {
      // Typed backwards? Mean what they plainly meant.
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      from = lo;
      to = new Date(hi.getTime() + DAY_MS); // the end day is included
    } else {
      key = DEFAULT_RANGE;
      from = mytMonthStart(now, -5);
    }
  } else if (key === "7d") from = lastNDays(7);
  else if (key === "30d") from = lastNDays(30);
  else if (key === "90d") from = lastNDays(90);
  else if (key === "bulan-ini") from = mytMonthStart(now);
  else if (key === "bulan-lepas") {
    from = mytMonthStart(now, -1);
    to = mytMonthStart(now);
  } else if (key === "tahun-ini") {
    const s = new Date(now.getTime() + MYT_MS);
    from = new Date(Date.UTC(s.getUTCFullYear(), 0, 1) - MYT_MS);
  } else if (key === "semua") {
    from = earliest ? mytMonthStart(earliest) : mytMonthStart(now, -11);
  } else {
    key = "6m";
    from = mytMonthStart(now, -5);
  }

  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
  const granularity = days <= 62 ? "day" : "month";
  const label = `${fmtDay(from)} – ${fmtDay(new Date(to.getTime() - 1))}`;
  const previous =
    key === "semua"
      ? null
      : { from: new Date(from.getTime() - (to.getTime() - from.getTime())), to: from };

  return { key, from, to, days, granularity, label, previous };
}

/** When a donation counts for reporting: when it was paid, else when it was made. */
export function donationWhen(d: Donation): Date {
  return new Date(d.paid_at ?? d.created_at);
}

export function inWindow(when: Date, from: Date, to: Date): boolean {
  return when >= from && when < to;
}

/** Sum and count of paid donations inside a window. */
export function sumPaid(
  donations: Donation[],
  from: Date,
  to: Date
): { totalSen: number; count: number; payers: number } {
  let totalSen = 0;
  let count = 0;
  const payers = new Set<string>();
  for (const d of donations) {
    if (d.status !== "paid" || !inWindow(donationWhen(d), from, to)) continue;
    totalSen += d.amount_sen;
    count += 1;
    payers.add(d.payer_email);
  }
  return { totalSen, count, payers: payers.size };
}

const shortMonth = new Intl.DateTimeFormat("ms-MY", { month: "short", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("ms-MY", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Bucket paid donations across a range: one bar per day for a short range,
 * one per month for a long one. Empty buckets are kept so the axis is
 * continuous and a quiet day reads as quiet, not missing.
 */
export function buildRangeSeries(donations: Donation[], range: DateRange): PaymentPoint[] {
  const buckets = new Map<string, PaymentPoint>();
  const order: string[] = [];
  const keyOf = (instant: Date) => {
    const s = new Date(instant.getTime() + MYT_MS);
    return range.granularity === "day"
      ? `${s.getUTCFullYear()}-${s.getUTCMonth()}-${s.getUTCDate()}`
      : `${s.getUTCFullYear()}-${s.getUTCMonth()}`;
  };

  if (range.granularity === "day") {
    for (let t = range.from.getTime(); t < range.to.getTime(); t += DAY_MS) {
      const at = new Date(t);
      const key = keyOf(at);
      order.push(key);
      buckets.set(key, {
        label: shortDay.format(new Date(t + MYT_MS)),
        total: 0,
        count: 0,
      });
    }
  } else {
    const first = new Date(range.from.getTime() + MYT_MS);
    const last = new Date(range.to.getTime() - 1 + MYT_MS);
    const multiYear = first.getUTCFullYear() !== last.getUTCFullYear();
    let y = first.getUTCFullYear();
    let m = first.getUTCMonth();
    while (y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth())) {
      const key = `${y}-${m}`;
      order.push(key);
      const name = shortMonth.format(new Date(Date.UTC(y, m, 1)));
      buckets.set(key, {
        label: multiYear ? `${name} ${String(y).slice(2)}` : name,
        total: 0,
        count: 0,
      });
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  }

  for (const d of donations) {
    if (d.status !== "paid") continue;
    const when = donationWhen(d);
    if (!inWindow(when, range.from, range.to)) continue;
    const bucket = buckets.get(keyOf(when));
    if (bucket) {
      bucket.total += d.amount_sen;
      bucket.count += 1;
    }
  }
  return order.map((k) => buckets.get(k)!);
}
