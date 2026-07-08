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

export function StatusBadge({ status }: { status: DonationStatus }) {
  const item = map[status] ?? map.pending;
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
