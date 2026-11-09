import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMalaysianPhone } from "@/lib/murpati";
import type { Donation } from "@/lib/database.types";

/**
 * Payer profiling — one profile per unique payer, aggregating every donation
 * that person has made. Identity key is the phone number (normalized to
 * 60XXXXXXXXX so 0123…, +60123… and 60123… collapse to one payer); when a
 * donation has no usable phone, the email address is used instead.
 *
 * To avoid splitting one person across a phone profile and an email profile,
 * an email-only donation is merged into a phone profile when that same email
 * appears on any of the payer's phoned donations.
 *
 * Aggregation runs in the app over all rows — fine at the current scale; if the
 * dataset grows into the tens of thousands this should move to a stored
 * identity key + SQL grouping.
 */
export interface PayerProfile {
  /** Unique identity: normalized phone, or lowercased email. URL segment
   *  (encode it — an email key contains "@"). */
  key: string;
  keyType: "phone" | "email";
  /** Normalized phone if this payer has one, else null. */
  phone: string | null;
  /** Phone as the payer last typed it, if any. */
  displayPhone: string | null;
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
  /** Donations with neither a usable phone nor an email (can't be profiled). */
  withoutContact: number;
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

function emailOf(d: Donation): string {
  return (d.payer_email ?? "").trim().toLowerCase();
}

/** Group donations into payer profiles keyed by phone (falling back to email). */
export function aggregatePayers(donations: Donation[]): PayersResult {
  // Pass 1: learn which email belongs to which phone, so a later phone-less
  // donation with a known email joins the right person instead of forking off.
  const emailToPhone = new Map<string, string>();
  for (const d of donations) {
    const phone = normalizeMalaysianPhone(d.payer_phone ?? "");
    const email = emailOf(d);
    if (phone && email && !emailToPhone.has(email)) {
      emailToPhone.set(email, phone);
    }
  }

  // Pass 2: assign every donation to an identity key.
  const map = new Map<string, Donation[]>();
  let withoutContact = 0;
  for (const d of donations) {
    const phone = normalizeMalaysianPhone(d.payer_phone ?? "");
    const email = emailOf(d);
    let key: string;
    if (phone) key = phone;
    else if (email) key = emailToPhone.get(email) ?? email;
    else {
      withoutContact += 1;
      continue;
    }
    (map.get(key) ?? map.set(key, []).get(key)!).push(d);
  }

  const payers: PayerProfile[] = [];
  for (const [key, rows] of map) {
    const sorted = [...rows].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const paid = sorted.filter((r) => r.status === "paid");
    const keyType: "phone" | "email" = key.includes("@") ? "email" : "phone";
    // Prefer the most recent donation that actually carries a phone for the
    // display number; fall back to the latest overall.
    const withPhone = sorted.find((r) =>
      normalizeMalaysianPhone(r.payer_phone ?? "")
    );
    const latest = sorted[0];

    payers.push({
      key,
      keyType,
      phone: keyType === "phone" ? key : null,
      displayPhone: withPhone?.payer_phone ?? null,
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

  payers.sort(
    (a, b) =>
      b.totalPaidSen - a.totalPaidSen ||
      new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
  );

  return { payers, withoutContact };
}

/** Fetch + aggregate every payer profile. */
export async function getPayers(
  supabase: SupabaseClient
): Promise<PayersResult> {
  const donations = await fetchAllDonations(supabase);
  return aggregatePayers(donations);
}

/** Fetch a single payer profile by identity key (phone or email), or null. */
export async function getPayerByKey(
  supabase: SupabaseClient,
  key: string
): Promise<PayerProfile | null> {
  const { payers } = await getPayers(supabase);
  return payers.find((p) => p.key === key) ?? null;
}
