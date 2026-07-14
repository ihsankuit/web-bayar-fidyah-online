"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendWebhook } from "@/lib/webhooks";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

export interface IntegrationState {
  error?: string;
  ok?: boolean;
  message?: string;
}

/** Save the webhook URL + signing secret (leaves api_key untouched). */
export async function saveIntegrations(
  _prev: IntegrationState,
  formData: FormData
): Promise<IntegrationState> {
  const supabase = await requireUser();

  const n8n_webhook_url =
    (formData.get("n8n_webhook_url") as string)?.trim() || null;
  const webhook_signing_secret =
    (formData.get("webhook_signing_secret") as string)?.trim() || null;

  if (n8n_webhook_url && !/^https?:\/\//i.test(n8n_webhook_url)) {
    return { error: "URL webhook mesti bermula dengan http:// atau https://" };
  }

  const { error } = await supabase.from("integration_settings").upsert(
    {
      id: 1,
      n8n_webhook_url,
      webhook_signing_secret,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/integrasi");
  return { ok: true, message: "Tetapan webhook disimpan." };
}

/** Save analytics/tracking ids (Google Analytics + Facebook Pixel/CAPI). */
export async function saveTracking(
  _prev: IntegrationState,
  formData: FormData
): Promise<IntegrationState> {
  const supabase = await requireUser();

  const get = (k: string) => (formData.get(k) as string)?.trim() || null;

  const { error } = await supabase.from("integration_settings").upsert(
    {
      id: 1,
      ga_measurement_id: get("ga_measurement_id"),
      ga_api_secret: get("ga_api_secret"),
      fb_pixel_id: get("fb_pixel_id"),
      fb_capi_access_token: get("fb_capi_access_token"),
      fb_test_event_code: get("fb_test_event_code"),
      google_ads_id: get("google_ads_id"),
      google_ads_conversion_label: get("google_ads_conversion_label"),
      gtm_id: get("gtm_id"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/integrasi");
  revalidatePath("/", "layout");
  return { ok: true, message: "Tetapan analitik disimpan." };
}

/** Generate a fresh API key. */
export async function regenerateApiKey(): Promise<void> {
  const supabase = await requireUser();
  const api_key = "sk_" + crypto.randomBytes(24).toString("hex");
  await supabase.from("integration_settings").upsert(
    { id: 1, api_key, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  revalidatePath("/admin/integrasi");
}

/** Revoke (clear) the API key, disabling the REST API. */
export async function revokeApiKey(): Promise<void> {
  const supabase = await requireUser();
  await supabase.from("integration_settings").upsert(
    { id: 1, api_key: null, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  revalidatePath("/admin/integrasi");
}

/** Send a test event to the configured webhook so the user can verify n8n. */
export async function testWebhook(): Promise<IntegrationState> {
  await requireUser();
  await sendWebhook("donation.paid", {
    reference: "FID-TEST0000",
    status: "paid",
    payer_name: "Ujian Webhook",
    payer_email: "test@example.com",
    category: "uzur_tua",
    days: 7,
    multiplier: 1,
    amount: 14,
    amount_sen: 1400,
    currency: "MYR",
    test: true,
    paid_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
  return { ok: true, message: "Ujian webhook dihantar. Semak workflow n8n anda." };
}
