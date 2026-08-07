"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { logActivity } from "@/lib/activity-log";
import {
  getMurpatiSettings,
  isMurpatiSessionConnected,
  normalizeMalaysianPhone,
  sendMurpatiMedia,
  sendMurpatiText,
} from "@/lib/murpati";

const BUCKET = "media";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return { supabase, email: user.email ?? "unknown" };
}

interface Recipient {
  name: string;
  phone: string;
}

/** Paid donors within [dateFrom, dateTo] (inclusive), deduped by phone number. */
async function resolveRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dateFrom: string,
  dateTo: string
): Promise<Recipient[]> {
  const { data } = await supabase
    .from("donations")
    .select("payer_name, payer_phone")
    .eq("status", "paid")
    .not("payer_phone", "is", null)
    .gte("paid_at", `${dateFrom}T00:00:00.000Z`)
    .lte("paid_at", `${dateTo}T23:59:59.999Z`);

  const byPhone = new Map<string, Recipient>();
  for (const row of (data as { payer_name: string; payer_phone: string | null }[]) ?? []) {
    const phone = normalizeMalaysianPhone(row.payer_phone ?? "");
    if (!phone || byPhone.has(phone)) continue;
    byPhone.set(phone, { name: row.payer_name, phone });
  }
  return Array.from(byPhone.values());
}

export interface PreviewState {
  error?: string;
  checked?: boolean;
  count?: number;
  names?: string[];
}

/** Resolves and previews recipients for a date range, without sending anything. */
export async function previewRecipients(
  _prev: PreviewState,
  formData: FormData
): Promise<PreviewState> {
  const { supabase } = await requireUser();
  const dateFrom = formData.get("date_from") as string;
  const dateTo = formData.get("date_to") as string;

  if (!dateFrom || !dateTo) return { error: "Sila pilih julat tarikh." };
  if (dateFrom > dateTo)
    return { error: "Tarikh 'dari' mesti sebelum atau sama dengan tarikh 'hingga'." };

  const recipients = await resolveRecipients(supabase, dateFrom, dateTo);

  return {
    checked: true,
    count: recipients.length,
    names: recipients.slice(0, 12).map((r) => r.name),
  };
}

export interface SendState {
  error?: string;
  ok?: boolean;
  sent?: number;
  failed?: number;
  total?: number;
}

/**
 * Sends a fidyah distribution update (text + optional image) via WhatsApp to
 * every paid donor within the given date range, then records the send in
 * `fidyah_distributions` for the history list and the activity log.
 */
export async function sendAgihanUpdate(
  _prev: SendState,
  formData: FormData
): Promise<SendState> {
  const { supabase, email } = await requireUser();

  const dateFrom = formData.get("date_from") as string;
  const dateTo = formData.get("date_to") as string;
  const message = ((formData.get("message") as string) || "").trim();
  const file = formData.get("image") as File | null;

  if (!dateFrom || !dateTo) return { error: "Sila pilih julat tarikh." };
  if (dateFrom > dateTo)
    return { error: "Tarikh 'dari' mesti sebelum atau sama dengan tarikh 'hingga'." };
  if (!message) return { error: "Sila masukkan makluman agihan." };
  if (file && file.size > 10 * 1024 * 1024)
    return { error: "Saiz gambar melebihi had 10MB." };

  const settings = await getMurpatiSettings();
  if (!settings.apiKey || !settings.sessionId) {
    return {
      error:
        "WhatsApp (Murpati) belum disediakan. Sila isi API Key & Session ID di Integrasi.",
    };
  }

  const connected = await isMurpatiSessionConnected(settings);
  if (!connected) {
    return {
      error:
        "Peranti WhatsApp Murpati tidak disambung. Sila semak status peranti di murpati.com/devices.",
    };
  }

  const recipients = await resolveRecipients(supabase, dateFrom, dateTo);
  if (recipients.length === 0) {
    return {
      error: "Tiada pembayar (dengan no. telefon) dijumpai dalam julat tarikh ini.",
    };
  }

  let imageUrl: string | null = null;
  if (file && file.size > 0) {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "agihan";
    const path = `agihan/${Date.now()}-${base}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
    if (uploadError) return { error: uploadError.message };

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);
    imageUrl = publicUrl;
  }

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const result = imageUrl
      ? await sendMurpatiMedia(settings, recipient.phone, imageUrl, message)
      : await sendMurpatiText(settings, recipient.phone, message);
    if (result.ok) sent++;
    else failed++;
  }

  await supabase.from("fidyah_distributions").insert({
    message,
    image_url: imageUrl,
    date_from: dateFrom,
    date_to: dateTo,
    recipient_count: recipients.length,
    sent_count: sent,
    failed_count: failed,
    created_by: email,
  });

  await logActivity("agihan.send", {
    date_from: dateFrom,
    date_to: dateTo,
    recipient_count: recipients.length,
    sent,
    failed,
  });

  revalidatePath("/admin/agihan");

  return { ok: true, sent, failed, total: recipients.length };
}
