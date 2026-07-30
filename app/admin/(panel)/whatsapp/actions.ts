"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity-log";
import {
  sendWhatsAppMessage,
  sendWhatsAppMedia,
  normalizePhone,
} from "@/lib/murpati";
import type { Donation, WhatsappBlastRecipient } from "@/lib/database.types";

const MAX_RECIPIENTS = 500;
const BATCH_SIZE = 5;
const SEND_DELAY_MS = 500;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return { supabase, user };
}

interface Recipient {
  donationId: string;
  name: string;
  phone: string;
}

/** Paid donations in [dateFrom, dateTo], deduped by normalized phone. */
async function matchingRecipients(
  dateFrom: string,
  dateTo: string
): Promise<{ recipients: Recipient[]; skipped: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("donations")
    .select("id, payer_name, payer_phone")
    .eq("status", "paid")
    .not("payer_phone", "is", null)
    .gte("paid_at", `${dateFrom}T00:00:00.000Z`)
    .lte("paid_at", `${dateTo}T23:59:59.999Z`);

  const rows =
    (data as Pick<Donation, "id" | "payer_name" | "payer_phone">[]) ?? [];

  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  let skipped = 0;

  for (const d of rows) {
    const phone = d.payer_phone ? normalizePhone(d.payer_phone) : null;
    if (!phone) {
      skipped++;
      continue;
    }
    if (seen.has(phone)) continue;
    seen.add(phone);
    recipients.push({ donationId: d.id, name: d.payer_name, phone });
  }

  return { recipients, skipped };
}

function validateRange(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom || !dateTo) return "Sila pilih tarikh mula dan tarikh akhir.";
  if (dateFrom > dateTo) return "Tarikh mula mesti sebelum atau sama dengan tarikh akhir.";
  return null;
}

export interface PreviewResult {
  error?: string;
  count?: number;
  skipped?: number;
  sample?: { name: string; phone: string }[];
}

export async function previewRecipients(
  _prev: PreviewResult,
  formData: FormData
): Promise<PreviewResult> {
  await requireUser();
  const dateFrom = (formData.get("date_from") as string) ?? "";
  const dateTo = (formData.get("date_to") as string) ?? "";

  const rangeError = validateRange(dateFrom, dateTo);
  if (rangeError) return { error: rangeError };

  const { recipients, skipped } = await matchingRecipients(dateFrom, dateTo);

  return {
    count: recipients.length,
    skipped,
    sample: recipients.slice(0, 10).map((r) => ({ name: r.name, phone: r.phone })),
  };
}

export interface StartBlastState {
  error?: string;
  blastId?: string;
  total?: number;
}

export async function startBlast(
  _prev: StartBlastState,
  formData: FormData
): Promise<StartBlastState> {
  const { user } = await requireUser();

  const dateFrom = (formData.get("date_from") as string) ?? "";
  const dateTo = (formData.get("date_to") as string) ?? "";
  const message = (formData.get("message") as string)?.trim() ?? "";
  const mediaUrl = (formData.get("media_url") as string)?.trim() || null;

  const rangeError = validateRange(dateFrom, dateTo);
  if (rangeError) return { error: rangeError };
  if (!message) return { error: "Sila tulis mesej." };
  if (message.length > 3000) {
    return { error: "Mesej terlalu panjang (maksimum 3000 aksara)." };
  }
  if (mediaUrl && !/^https:\/\//i.test(mediaUrl)) {
    return { error: "Lampiran tidak sah." };
  }

  const { recipients } = await matchingRecipients(dateFrom, dateTo);

  if (recipients.length === 0) {
    return {
      error:
        "Tiada penerima sah (pembayaran berjaya dengan no. telefon) dalam julat tarikh ini.",
    };
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return {
      error: `${recipients.length} penerima melebihi had ${MAX_RECIPIENTS} setiap blast. Sila kecilkan julat tarikh dan hantar berasingan.`,
    };
  }

  const admin = createAdminClient();
  const { data: blast, error: blastError } = await admin
    .from("whatsapp_blasts")
    .insert({
      message,
      media_url: mediaUrl,
      date_from: dateFrom,
      date_to: dateTo,
      total_recipients: recipients.length,
      created_by: user.email ?? "unknown",
    })
    .select("id")
    .single();

  if (blastError || !blast) {
    return { error: blastError?.message ?? "Gagal mencipta blast." };
  }

  const { error: recipientsError } = await admin
    .from("whatsapp_blast_recipients")
    .insert(
      recipients.map((r) => ({
        blast_id: blast.id as string,
        donation_id: r.donationId,
        payer_name: r.name,
        phone: r.phone,
      }))
    );

  if (recipientsError) {
    return { error: recipientsError.message };
  }

  await logActivity("whatsapp.blast_start", {
    blast_id: blast.id,
    date_from: dateFrom,
    date_to: dateTo,
    total_recipients: recipients.length,
  });

  return { blastId: blast.id as string, total: recipients.length };
}

export interface BatchResult {
  error?: string;
  processed: number;
  sent: number;
  failed: number;
  remaining: number;
  done: boolean;
}

/**
 * Send the next small batch of pending recipients for a blast. Called
 * repeatedly (sequentially) from the admin UI until `done` — Murpati has no
 * bulk-send endpoint, and processing everyone in one call would risk hitting
 * a serverless function's execution time limit for large recipient lists.
 */
export async function processBlastBatch(blastId: string): Promise<BatchResult> {
  await requireUser();
  const admin = createAdminClient();

  const { data: pendingRows } = await admin
    .from("whatsapp_blast_recipients")
    .select("id, phone, payer_name")
    .eq("blast_id", blastId)
    .eq("status", "pending")
    .limit(BATCH_SIZE);

  const pending =
    (pendingRows as Pick<WhatsappBlastRecipient, "id" | "phone" | "payer_name">[]) ??
    [];

  const { data: blastRow } = await admin
    .from("whatsapp_blasts")
    .select("message, media_url")
    .eq("id", blastId)
    .maybeSingle();

  if (!blastRow) return { error: "Blast tidak ditemui.", processed: 0, sent: 0, failed: 0, remaining: 0, done: true };

  const template = blastRow.message as string;
  const mediaUrl = blastRow.media_url as string | null;

  let sent = 0;
  let failed = 0;

  for (const r of pending) {
    const personalized = template.replaceAll("{{nama}}", r.payer_name);
    const result = mediaUrl
      ? await sendWhatsAppMedia(r.phone, mediaUrl, personalized)
      : await sendWhatsAppMessage(r.phone, personalized);

    if (result.ok) {
      sent++;
      await admin
        .from("whatsapp_blast_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", r.id);
    } else {
      failed++;
      await admin
        .from("whatsapp_blast_recipients")
        .update({ status: "failed", error: result.error ?? "Ralat tidak diketahui" })
        .eq("id", r.id);
    }

    // Small delay between sends — avoid tripping WhatsApp/Murpati anti-spam throttling.
    await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
  }

  const [{ count: sentCount }, { count: failedCount }, { count: remaining }] =
    await Promise.all([
      admin
        .from("whatsapp_blast_recipients")
        .select("id", { count: "exact", head: true })
        .eq("blast_id", blastId)
        .eq("status", "sent"),
      admin
        .from("whatsapp_blast_recipients")
        .select("id", { count: "exact", head: true })
        .eq("blast_id", blastId)
        .eq("status", "failed"),
      admin
        .from("whatsapp_blast_recipients")
        .select("id", { count: "exact", head: true })
        .eq("blast_id", blastId)
        .eq("status", "pending"),
    ]);

  await admin
    .from("whatsapp_blasts")
    .update({ sent_count: sentCount ?? 0, failed_count: failedCount ?? 0 })
    .eq("id", blastId);

  const done = (remaining ?? 0) === 0;
  if (done) {
    await admin
      .from("whatsapp_blasts")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", blastId);
  }

  return {
    processed: pending.length,
    sent,
    failed,
    remaining: remaining ?? 0,
    done,
  };
}
