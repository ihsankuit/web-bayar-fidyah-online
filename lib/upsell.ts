import { createClient } from "@/lib/supabase/public";
import type { UpsellSettings } from "@/lib/database.types";

export const DEFAULT_UPSELL: UpsellSettings = {
  enabled: false,
  title: "",
  description: "",
  amount_sen: 1000,
  poster_image_url: "",
  accept_label: "Ya, Saya Nak Sertai",
  skip_label: "Teruskan Bayar Fidyah Sahaja",
};

/**
 * Read the upsell campaign shown at checkout from `site_settings` (key
 * "upsell"), merged over the defaults. Falls back to defaults (disabled) if
 * Supabase is unavailable/unconfigured.
 */
export async function getUpsellSettings(): Promise<UpsellSettings> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "upsell")
      .maybeSingle();

    if (data?.value) {
      return { ...DEFAULT_UPSELL, ...(data.value as Partial<UpsellSettings>) };
    }
  } catch {
    // ignore — use defaults
  }
  return DEFAULT_UPSELL;
}
