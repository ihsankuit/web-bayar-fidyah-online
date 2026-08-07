"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LandingContent } from "@/lib/database.types";
import { DEFAULT_SEO } from "@/lib/seo";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

export interface SeoState {
  error?: string;
  ok?: boolean;
}

export async function saveSeo(
  _prev: SeoState,
  formData: FormData
): Promise<SeoState> {
  const supabase = await requireUser();

  const title = (formData.get("title") as string)?.trim() || DEFAULT_SEO.title;
  const description =
    (formData.get("description") as string)?.trim() || DEFAULT_SEO.description;
  const keywords = ((formData.get("keywords") as string) || "")
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  const h1 = (formData.get("h1") as string)?.trim();

  // 1. Save SEO meta under the `seo` settings key.
  const { error: seoError } = await supabase.from("site_settings").upsert(
    {
      key: "seo",
      value: {
        title,
        description,
        keywords: keywords.length ? keywords : DEFAULT_SEO.keywords,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (seoError) return { error: seoError.message };

  // 2. The H1 is the hero title (stored in the `landing` key) — update it in
  // place without disturbing the rest of the landing content.
  if (h1) {
    const { data: existing } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "landing")
      .maybeSingle();
    const value = {
      ...((existing?.value as Partial<LandingContent>) ?? {}),
      hero_title: h1,
    };
    const { error: landingError } = await supabase
      .from("site_settings")
      .upsert(
        { key: "landing", value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (landingError) return { error: landingError.message };
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/seo");
  return { ok: true };
}
