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
