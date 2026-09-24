import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMalaysianPhone } from "@/lib/murpati";
import type { Donation } from "@/lib/database.types";

/**
 * Payer profiling — one profile per unique phone number, aggregating every
 * donation that person has made. Phone is the identity key (normalized to
 * 60XXXXXXXXX so 0123…, +60123… and 60123… collapse to the same payer).
 *
 * Donations with no usable phone can't be attributed to a payer and are
 * counted separately (see `withoutPhone`). Aggregation runs in the app over
 * all rows — fine at the current scale; if the dataset grows into the tens of
 * thousands this should move to a normalized phone column + SQL grouping.
 */
export interface PayerProfile {
  /** Normalized phone (60XXXXXXXXX). Unique key + URL segment. */
  phone: string;
  /** Phone as the payer last typed it, for display. */
  displayPhone: string;
  name: string;
  email: string;
  negeri: string | null;
  totalPaidSen: number;
  totalCount: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  firstAt: string;
  lastAt: string;
  categories: string[];
  utmSource: string | null;
  /** All of this payer's donations, newest first. */
  donations: Donation[];
}

export interface PayersResult {
  payers: PayerProfile[];
  /** Donations that had no usable phone number (can't be profiled). */
  withoutPhone: number;
}

/** Page through every donation row (PostgREST caps a plain select at ~1000). */
async function fetchAllDonations(
  supabase: SupabaseClient
): Promise<Donation[]> {
  const PAGE = 1000;
  const all: Donation[] = [];
  for (let offset = 0; offset < 50_000; offset += PAGE) {
    const { data, error } = await supabase
      .from("donations")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = (data as Donation[]) ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

/** Group donations into payer profiles keyed by normalized phone. */
export function aggregatePayers(donations: Donation[]): PayersResult {
  const map = new Map<string, Donation[]>();
  let withoutPhone = 0;

  for (const d of donations) {
    const phone = normalizeMalaysianPhone(d.payer_phone ?? "");
    if (!phone) {
      withoutPhone += 1;
      continue;
    }
    (map.get(phone) ?? map.set(phone, []).get(phone)!).push(d);
  }

  const payers: PayerProfile[] = [];
  for (const [phone, rows] of map) {
    // Rows arrive newest-first from the query; the most recent one carries the
    // payer's latest name/email/state.
    const sorted = [...rows].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latest = sorted[0];
    const paid = sorted.filter((r) => r.status === "paid");

    payers.push({
      phone,
      displayPhone: latest.payer_phone ?? phone,
      name: latest.payer_name,
      email: latest.payer_email,
      negeri: latest.negeri,
      totalPaidSen: paid.reduce((s, r) => s + r.amount_sen, 0),
      totalCount: sorted.length,
      paidCount: paid.length,
      pendingCount: sorted.filter((r) => r.status === "pending").length,
      failedCount: sorted.filter((r) => r.status === "failed").length,
      firstAt: sorted[sorted.length - 1].created_at,
      lastAt: latest.created_at,
      categories: [...new Set(sorted.map((r) => r.category))],
      utmSource: latest.utm_source,
      donations: sorted,
    });
  }

  // Most valuable payers first (by amount actually paid), then most recent.
  payers.sort(
    (a, b) =>
      b.totalPaidSen - a.totalPaidSen ||
      new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
  );

  return { payers, withoutPhone };
}

/** Fetch + aggregate every payer profile. */
export async function getPayers(
  supabase: SupabaseClient
): Promise<PayersResult> {
  const donations = await fetchAllDonations(supabase);
  return aggregatePayers(donations);
}

/** Fetch a single payer profile by normalized phone, or null. */
export async function getPayerByPhone(
  supabase: SupabaseClient,
  phone: string
): Promise<PayerProfile | null> {
  const { payers } = await getPayers(supabase);
  return payers.find((p) => p.phone === phone) ?? null;
}
