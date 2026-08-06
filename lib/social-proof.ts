import { createAdminClient } from "@/lib/supabase/admin";

export interface SocialProofItem {
  firstName: string;
  negeri: string | null;
  paidAt: string;
}

/**
 * Recent paid donations for the homepage's social-proof notification.
 * Deliberately minimal — first name + negeri only, no amount, no
 * email/phone — to stay privacy-conscious while still showing real, recent
 * activity (never fabricated; a donation site lying about this would be
 * dishonest). `donations` has no public RLS read policy, so this must use
 * the service role rather than the public/anon client.
 */
export async function getRecentSocialProof(limit = 15): Promise<SocialProofItem[]> {
  try {
    const supabase = createAdminClient();
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from("donations")
      .select("payer_name, negeri, paid_at")
      .eq("status", "paid")
      .not("paid_at", "is", null)
      .gte("paid_at", cutoff)
      .order("paid_at", { ascending: false })
      .limit(limit);

    if (!data) return [];

    return data
      .filter(
        (d): d is { payer_name: string; negeri: string | null; paid_at: string } =>
          Boolean(d.paid_at)
      )
      .map((d) => ({
        firstName: d.payer_name.trim().split(/\s+/)[0] || "Seseorang",
        negeri: d.negeri,
        paidAt: d.paid_at,
      }));
  } catch {
    return [];
  }
}
