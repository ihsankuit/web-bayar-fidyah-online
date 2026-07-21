"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_UPSELL } from "@/lib/upsell";
import type { UpsellSettings } from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

export interface UpsellState {
  error?: string;
  ok?: boolean;
}

export async function saveUpsell(
  _prev: UpsellState,
  formData: FormData
): Promise<UpsellState> {
  const supabase = await requireUser();

  const amountRinggit = Number(formData.get("amount") ?? 0);
  if (!Number.isFinite(amountRinggit) || amountRinggit <= 0) {
    return { error: "Jumlah kempen tidak sah." };
  }

  const value: UpsellSettings = {
    enabled: formData.get("enabled") === "on",
    title: (formData.get("title") as string)?.trim() || DEFAULT_UPSELL.title,
    description:
      (formData.get("description") as string)?.trim() ||
      DEFAULT_UPSELL.description,
    amount_sen: Math.round(amountRinggit * 100),
    poster_image_url: (formData.get("poster_image_url") as string)?.trim() || "",
    accept_label:
      (formData.get("accept_label") as string)?.trim() ||
      DEFAULT_UPSELL.accept_label,
    skip_label:
      (formData.get("skip_label") as string)?.trim() ||
      DEFAULT_UPSELL.skip_label,
  };

  if (value.enabled && !value.title) {
    return { error: "Sila masukkan tajuk kempen sebelum mengaktifkannya." };
  }

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "upsell", value }, { onConflict: "key" });

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin/kempen");
  return { ok: true };
}
