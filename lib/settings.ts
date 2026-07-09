import { createClient } from "@/lib/supabase/public";
import { DEFAULT_LANDING } from "@/lib/content";
import type { LandingContent } from "@/lib/database.types";

/**
 * Read the editable landing page content from `site_settings`, merged over the
 * defaults. Falls back to defaults if Supabase is unavailable/unconfigured.
 */
export async function getLandingContent(): Promise<LandingContent> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "landing")
      .maybeSingle();

    if (data?.value) {
      return { ...DEFAULT_LANDING, ...(data.value as Partial<LandingContent>) };
    }
  } catch {
    // ignore — use defaults
  }
  return DEFAULT_LANDING;
}
