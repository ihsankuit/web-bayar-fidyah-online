"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMYR } from "@/lib/utils";

export interface PaymentPoint {
  label: string;
  /** Total collected in that period, in sen. */
  total: number;
  /** Number of paid donations in that period. */
  count: number;
}

/** Y-axis tick: compact Ringgit (e.g. RM1.2k). */
function yTick(sen: number): string {
  const rm = sen / 100;
  if (rm >= 1000) return `RM${(rm / 1000).toFixed(rm % 1000 === 0 ? 0 : 1)}k`;
  return `RM${rm}`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: PaymentPoint }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-popover-foreground">{label}</p>
      <p className="text-primary">{formatMYR(point.total)}</p>
      <p className="text-xs text-muted-foreground">
        {point.count} pembayaran
      </p>
    </div>
  );
}

export function PaymentsChart({ data }: { data: PaymentPoint[] }) {
  const hasData = data.some((d) => d.total > 0);

  if (!hasData) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        Belum ada pembayaran berjaya untuk dipaparkan.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
        barCategoryGap="30%"
      >
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          dy={8}
        />
        <YAxis
          width={56}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickFormatter={yTick}
        />
        <Tooltip
          cursor={{ fill: "var(--accent)", opacity: 0.4 }}
          content={<ChartTooltip />}
        />
        <Bar
          dataKey="total"
          fill="var(--primary)"
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
