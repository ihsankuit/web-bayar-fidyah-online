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
