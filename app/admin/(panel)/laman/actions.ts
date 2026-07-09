"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LANDING } from "@/lib/content";
import type { LandingContent } from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

export interface LandingState {
  error?: string;
  ok?: boolean;
}

export async function saveLanding(
  _prev: LandingState,
  formData: FormData
): Promise<LandingState> {
  const supabase = await requireUser();

  const rateRinggit = Number(formData.get("fidyah_rate") ?? 0);
  if (!Number.isFinite(rateRinggit) || rateRinggit <= 0) {
    return { error: "Kadar fidyah tidak sah." };
  }

  let stats: LandingContent["stats"];
  let faqs: LandingContent["faqs"];
  try {
    stats = JSON.parse((formData.get("stats_json") as string) || "[]");
    faqs = JSON.parse((formData.get("faqs_json") as string) || "[]");
    if (!Array.isArray(stats) || !Array.isArray(faqs)) {
      throw new Error("format");
    }
  } catch {
    return { error: "Format JSON untuk statistik atau FAQ tidak sah." };
  }

  const value: LandingContent = {
    hero_badge: (formData.get("hero_badge") as string) || DEFAULT_LANDING.hero_badge,
    hero_title: (formData.get("hero_title") as string) || DEFAULT_LANDING.hero_title,
    hero_subtitle:
      (formData.get("hero_subtitle") as string) || DEFAULT_LANDING.hero_subtitle,
    hero_cta: (formData.get("hero_cta") as string) || DEFAULT_LANDING.hero_cta,
    about_title:
      (formData.get("about_title") as string) || DEFAULT_LANDING.about_title,
    about_body:
      (formData.get("about_body") as string) || DEFAULT_LANDING.about_body,
    hukum_title:
      (formData.get("hukum_title") as string) || DEFAULT_LANDING.hukum_title,
    hukum_body:
      (formData.get("hukum_body") as string) || DEFAULT_LANDING.hukum_body,
    hadith_arabic:
      (formData.get("hadith_arabic") as string) ||
      DEFAULT_LANDING.hadith_arabic,
    hadith_meaning:
      (formData.get("hadith_meaning") as string) ||
      DEFAULT_LANDING.hadith_meaning,
    hadith_source:
      (formData.get("hadith_source") as string) ||
      DEFAULT_LANDING.hadith_source,
    fidyah_rate_sen: Math.round(rateRinggit * 100),
    stats,
    faqs,
    footer_note:
      (formData.get("footer_note") as string) || DEFAULT_LANDING.footer_note,
    qr_image_url: ((formData.get("qr_image_url") as string) || "").trim(),
    qr_bank_name: ((formData.get("qr_bank_name") as string) || "").trim(),
    qr_account_name:
      ((formData.get("qr_account_name") as string) || "").trim(),
    qr_account_number:
      ((formData.get("qr_account_number") as string) || "").trim(),
  };

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "landing", value }, { onConflict: "key" });

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin/laman");
  return { ok: true };
}
