import { Badge } from "@/components/ui/badge";
import type { DonationStatus } from "@/lib/database.types";

const map: Record<
  DonationStatus,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  paid: { label: "Berjaya", variant: "success" },
  pending: { label: "Menunggu", variant: "warning" },
  failed: { label: "Gagal", variant: "destructive" },
};

/**
 * `review` is derived, not stored (see needsReview in lib/payment-methods):
 * a pending payment that someone has already paid and staff now have to check
 * against a bank statement. It replaces "Menunggu", which would wrongly say
 * the payer still has something to do.
 */
export function StatusBadge({
  status,
  review = false,
}: {
  status: DonationStatus;
  review?: boolean;
}) {
  if (review && status === "pending") {
    return <Badge variant="warning">Perlu Semak</Badge>;
  }
  const item = map[status] ?? map.pending;
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
