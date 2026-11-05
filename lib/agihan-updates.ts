import { createClient } from "@/lib/supabase/public";
import type { AgihanUpdate } from "@/lib/database.types";

/**
 * Public distribution-update timeline shown on the landing page. Newest first
 * (by the date the distribution happened). Returns [] on any failure so the
 * landing page never breaks when the table is missing or Supabase is down.
 */
export async function getAgihanUpdates(limit = 12): Promise<AgihanUpdate[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("agihan_updates")
      .select("*")
      .order("happened_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data as AgihanUpdate[]) ?? [];
  } catch {
    return [];
  }
}

/** The update's photos, preferring the array and falling back to legacy single. */
export function updateImages(u: AgihanUpdate): string[] {
  if (u.image_urls?.length) return u.image_urls;
  return u.image_url ? [u.image_url] : [];
}

/** The update's storage paths (for deletion), array with legacy fallback. */
export function updateStoragePaths(u: AgihanUpdate): string[] {
  if (u.storage_paths?.length) return u.storage_paths;
  return u.storage_path ? [u.storage_path] : [];
}
