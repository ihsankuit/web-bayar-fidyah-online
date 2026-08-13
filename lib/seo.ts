import { createClient } from "@/lib/supabase/public";

/** SEO / meta settings, editable from Admin > SEO (stored under the `seo` key). */
export interface SeoSettings {
  title: string;
  description: string;
  keywords: string[];
}

export const DEFAULT_SEO: SeoSettings = {
  // NOTE: only used when Admin > SEO has no saved title — the stored value
  // wins. Change it there too, or this default stays invisible.
  title: "Bayar Fidyah Online — Cara Bayar Fidyah Puasa & Kalkulator 2026/2027",
  description:
    "Bayar fidyah puasa Ramadan secara online di semua negeri di Malaysia — Selangor, Kedah, Johor, Pahang, Perak & lain-lain. Kiraan automatik, pembayaran selamat FPX, kad & QR, resit ke emel. Bayar dalam 3 minit — kadar RM4.00 sehari.",
  keywords: [
    "fidyah",
    "bayar fidyah",
    "bayar fidyah online",
    "fidyah online",
    "fidyah puasa",
    "bayaran fidyah",
    "kalkulator fidyah",
    "kalkulator fidyah online",
    "fidyah Malaysia",
    "cara bayar fidyah",
    "cara bayar fidyah online",
    "kadar fidyah Malaysia",
    "kadar fidyah 2026",
    "hukum fidyah puasa",
    "qada fidyah",
    "fidyah selangor",
    "fidyah kedah",
    "fidyah johor",
    "fidyah pahang",
    "fidyah perak",
    "fidyah orang meninggal",
    "cupak beras fidyah",
  ],
};

/** Read SEO settings, merged over defaults. Falls back to defaults on failure. */
export async function getSeoSettings(): Promise<SeoSettings> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "seo")
      .maybeSingle();

    if (data?.value) {
      const v = data.value as Partial<SeoSettings>;
      return {
        title: v.title?.trim() || DEFAULT_SEO.title,
        description: v.description?.trim() || DEFAULT_SEO.description,
        keywords:
          Array.isArray(v.keywords) && v.keywords.length
            ? v.keywords
            : DEFAULT_SEO.keywords,
      };
    }
  } catch {
    // ignore — use defaults
  }
  return DEFAULT_SEO;
}
