import type { Donation } from "@/lib/database.types";

/**
 * Google Ads "offline conversion import" file for paid donations.
 *
 * Browser-side conversion tracking only fires if the payer lands back on the
 * status page, and only if the ad click survives the trip through the payment
 * gateway. This builds the file that tells Google about the rest, from the
 * click id we stored when the payer submitted the form.
 *
 * Upload in Google Ads under Goals > Conversions > Uploads. Google ignores a
 * row it has already seen (same click id, conversion name and time), so
 * re-uploading an overlapping date range does not double count.
 */

export type AdsClickIdType = "gclid" | "gbraid" | "wbraid";

const COLUMN: Record<AdsClickIdType, string> = {
  gclid: "Google Click ID",
  gbraid: "Gbraid",
  wbraid: "Wbraid",
};

const MYT = "Asia/Kuala_Lumpur";

/** "2026-11-20 10:01:17+0800": Malaysia time with its offset spelled out. */
export function adsConversionTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MYT,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(iso));
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "00";
  return `${p("year")}-${p("month")}-${p("day")} ${p("hour")}:${p("minute")}:${p("second")}+0800`;
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export interface AdsExportOptions {
  /** Which click id the file carries; Google wants one kind per file. */
  type: AdsClickIdType;
  /** Must match the conversion action's name in Google Ads exactly. */
  conversionName: string;
}

export interface AdsExport {
  csv: string;
  /** Rows written, for the caller's own bookkeeping. */
  count: number;
}

/** Only paid donations that carry the chosen click id become rows. */
export function buildAdsConversionCsv(
  donations: Donation[],
  { type, conversionName }: AdsExportOptions
): AdsExport {
  const header = [
    COLUMN[type],
    "Conversion Name",
    "Conversion Time",
    "Conversion Value",
    "Conversion Currency",
  ].join(",");

  const rows: string[] = [];
  const seen = new Set<string>();
  for (const d of donations) {
    if (d.status !== "paid") continue;
    const id = (d[type] ?? "").trim();
    if (!id) continue;
    // One row per click id and time; a payer submitting twice from the same
    // click is two real payments, but an identical row would be a duplicate.
    const time = adsConversionTime(d.paid_at ?? d.created_at);
    const key = `${id}|${time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(
      [
        id,
        conversionName,
        time,
        (d.amount_sen / 100).toFixed(2),
        "MYR",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return { csv: [header, ...rows].join("\r\n") + "\r\n", count: rows.length };
}
