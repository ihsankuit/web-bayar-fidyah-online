"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_FOLLOWUP } from "@/lib/followup";
import { DEFAULT_PAYMENT_SUCCESS } from "@/lib/notifications";
import { logActivity } from "@/lib/activity-log";
import type {
  FollowUpSettings,
  PaymentSuccessSettings,
} from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

export interface NotificationState {
  error?: string;
  ok?: boolean;
  message?: string;
}

/**
 * Save the follow-up templates used to prefill every follow-up reminder
 * (Admin > Sumbangan > Susulan).
 */
export async function saveFollowUpTemplates(
  _prev: NotificationState,
  formData: FormData
): Promise<NotificationState> {
  const supabase = await requireUser();

  const value: FollowUpSettings = {
    whatsapp_message:
      ((formData.get("whatsapp_message") as string) || "").trim() ||
      DEFAULT_FOLLOWUP.whatsapp_message,
    email_subject:
      ((formData.get("email_subject") as string) || "").trim() ||
      DEFAULT_FOLLOWUP.email_subject,
    email_body:
      ((formData.get("email_body") as string) || "").trim() ||
      DEFAULT_FOLLOWUP.email_body,
  };

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "followup", value }, { onConflict: "key" });
  if (error) return { error: error.message };

  await logActivity("notifikasi.save_followup", {});

  revalidatePath("/admin/notifikasi");
  revalidatePath("/admin/sumbangan");
  return { ok: true, message: "Templat notifikasi susulan disimpan." };
}

/**
 * Save the templates for the notification sent when a payment succeeds
 * (receipt email, and the optional WhatsApp confirmation).
 */
export async function savePaymentSuccess(
  _prev: NotificationState,
  formData: FormData
): Promise<NotificationState> {
  const supabase = await requireUser();

  const value: PaymentSuccessSettings = {
    email_subject:
      ((formData.get("email_subject") as string) || "").trim() ||
      DEFAULT_PAYMENT_SUCCESS.email_subject,
    email_intro:
      ((formData.get("email_intro") as string) || "").trim() ||
      DEFAULT_PAYMENT_SUCCESS.email_intro,
    email_attach_pdf: formData.get("email_attach_pdf") === "on",
    whatsapp_enabled: formData.get("whatsapp_enabled") === "on",
    whatsapp_message:
      ((formData.get("whatsapp_message") as string) || "").trim() ||
      DEFAULT_PAYMENT_SUCCESS.whatsapp_message,
    whatsapp_attach_pdf: formData.get("whatsapp_attach_pdf") === "on",
  };

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "payment_success", value }, { onConflict: "key" });
  if (error) return { error: error.message };

  await logActivity("notifikasi.save_payment_success", {
    whatsapp_enabled: value.whatsapp_enabled,
  });

  revalidatePath("/admin/notifikasi");
  return { ok: true, message: "Templat notifikasi pembayaran berjaya disimpan." };
}
