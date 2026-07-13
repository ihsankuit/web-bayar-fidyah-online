import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Simple Postgres-backed sliding-window rate limiter for public endpoints.
 * Records a hit per call and counts hits for `key` within the last
 * `windowSeconds`; returns false once `limit` is reached. Opportunistically
 * prunes old rows so the table doesn't grow unbounded.
 *
 * Fails open (allows the request) if the check itself errors — a rate
 * limiter must never be the reason a legitimate payment fails.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

    const { count } = await supabase
      .from("rate_limit_hits")
      .select("*", { count: "exact", head: true })
      .eq("key", key)
      .gte("created_at", windowStart);

    if ((count ?? 0) >= limit) return false;

    await supabase.from("rate_limit_hits").insert({ key });

    if (Math.random() < 0.05) {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      await supabase.from("rate_limit_hits").delete().lt("created_at", cutoff);
    }

    return true;
  } catch (err) {
    console.error("[rate-limit] check failed, allowing request:", err);
    return true;
  }
}

/** Best-effort client IP from common proxy headers (Vercel/Cloudflare set x-forwarded-for). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
