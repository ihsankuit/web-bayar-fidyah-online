"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  deleteDonation,
  markDonationPaid,
  settleDonationByReference,
} from "@/lib/donations";
import { getPurchase } from "@/lib/chip";
import { sendFollowUpEmail, sendReceiptEmail } from "@/lib/resend";
import { logActivity } from "@/lib/activity-log";
import {
  applyFollowUpVariables,
  DEFAULT_FOLLOWUP,
  paymentLink,
} from "@/lib/followup";
import {
  getMurpatiSettings,
  isMurpatiSessionConnected,
  normalizeMalaysianPhone,
  sendMurpatiText,
} from "@/lib/murpati";
import type { Donation, FollowUpSettings } from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

function revalidateAll() {
  revalidatePath("/admin/sumbangan");
  revalidatePath("/admin");
}

/** Re-check a pending/failed donation's true status directly against CHIP. */
export async function recheckChipStatus(formData: FormData) {
  const supabase = await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const { data: donation } = await supabase
    .from("donations")
    .select("*")
    .eq("id", id)
    .maybeSingle<Donation>();

  if (!donation?.chip_purchase_id) return;

  try {
    const purchase = await getPurchase(donation.chip_purchase_id);
    const paid = purchase.status === "paid";
    await settleDonationByReference(donation.reference, paid, null);
    await logActivity("donation.recheck_chip", {
      reference: donation.reference,
      chip_status: purchase.status,
    });
  } catch (err) {
    console.error("[sumbangan/recheckChipStatus] failed:", err);
  }
  revalidateAll();
}

/** Confirm a manual bank transfer donation as paid (admin verified the proof). */
export async function confirmManualPayment(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const donation = await markDonationPaid(id);
  if (donation) {
    await logActivity("donation.confirm_manual_paid", {
      reference: donation.reference,
      amount_sen: donation.amount_sen,
    });
  }
  revalidateAll();
}

/** Manually resend the payment receipt email for an already-paid donation. */
export async function resendReceipt(formData: FormData) {
  const supabase = await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const { data: donation } = await supabase
    .from("donations")
    .select("*")
    .eq("id", id)
    .maybeSingle<Donation>();

  if (!donation || donation.status !== "paid") return;

  await sendReceiptEmail(donation);
  await logActivity("donation.resend_receipt", {
    reference: donation.reference,
    to: donation.payer_email,
  });
  revalidateAll();
}

export interface FollowUpState {
  error?: string;
  ok?: boolean;
  message?: string;
}

/**
 * Send a manually-composed follow-up reminder (WhatsApp and/or email) to a
 * payer whose payment is still pending or has failed. The admin edits the
 * text in the dialog before sending; variable tags are substituted here with
 * this donation's own values.
 */
export async function sendFollowUp(
  _prev: FollowUpState,
  formData: FormData
): Promise<FollowUpState> {
  const supabase = await requireUser();
  const id = formData.get("id") as string;
  if (!id) return { error: "Sumbangan tidak sah." };

  const viaWhatsapp = formData.get("via_whatsapp") === "on";
  const viaEmail = formData.get("via_email") === "on";
  if (!viaWhatsapp && !viaEmail) {
    return { error: "Sila pilih sekurang-kurangnya satu saluran (WhatsApp atau emel)." };
  }

  const { data: donation } = await supabase
    .from("donations")
    .select("*")
    .eq("id", id)
    .maybeSingle<Donation>();
  if (!donation) return { error: "Rekod sumbangan tidak dijumpai." };
  if (donation.status === "paid") {
    return { error: "Sumbangan ini sudah dibayar — tiada susulan diperlukan." };
  }

  const sent: string[] = [];
  const failed: string[] = [];

  if (viaWhatsapp) {
    const phone = normalizeMalaysianPhone(donation.payer_phone ?? "");
    if (!phone) {
      failed.push("WhatsApp (tiada no. telefon sah)");
    } else {
      const settings = await getMurpatiSettings();
      if (!settings.apiKey || !settings.sessionId) {
        failed.push("WhatsApp (Murpati belum disediakan di Integrasi)");
      } else if (!(await isMurpatiSessionConnected(settings))) {
        failed.push("WhatsApp (peranti Murpati tidak disambung)");
      } else {
        const message = applyFollowUpVariables(
          ((formData.get("whatsapp_message") as string) || "").trim(),
          donation
        );
        if (!message) {
          failed.push("WhatsApp (mesej kosong)");
        } else {
          const result = await sendMurpatiText(settings, phone, message);
          if (result.ok) sent.push("WhatsApp");
          else failed.push(`WhatsApp (${result.error})`);
        }
      }
    }
  }

  if (viaEmail) {
    const subject = applyFollowUpVariables(
      ((formData.get("email_subject") as string) || "").trim(),
      donation
    );
    const body = applyFollowUpVariables(
      ((formData.get("email_body") as string) || "").trim(),
      donation
    );
    if (!subject || !body) {
      failed.push("Emel (tajuk atau kandungan kosong)");
    } else {
      const ok = await sendFollowUpEmail(
        donation.payer_email,
        subject,
        body,
        paymentLink(donation)
      );
      if (ok) sent.push("Emel");
      else failed.push("Emel (hantar gagal — semak tetapan Resend)");
    }
  }

  if (sent.length > 0) {
    await supabase
      .from("donations")
      .update({
        followup_count: (donation.followup_count ?? 0) + 1,
        last_followup_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  await logActivity("donation.followup", {
    reference: donation.reference,
    status: donation.status,
    sent: sent.join(", ") || "-",
    failed: failed.join(", ") || "-",
  });

  revalidateAll();

  if (sent.length === 0) {
    return { error: `Susulan gagal dihantar — ${failed.join("; ")}` };
  }
  return {
    ok: true,
    message:
      `Susulan dihantar melalui ${sent.join(" & ")}.` +
      (failed.length > 0 ? ` Gagal: ${failed.join("; ")}.` : ""),
  };
}

/** Save the follow-up templates as the defaults used to prefill the dialog. */
export async function saveFollowUpTemplates(
  _prev: FollowUpState,
  formData: FormData
): Promise<FollowUpState> {
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

  revalidateAll();
  return { ok: true, message: "Teks lalai susulan disimpan." };
}

/** Permanently delete a donation record. */
export async function deleteDonationAction(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const donation = await deleteDonation(id);
  if (donation) {
    await logActivity("donation.delete", {
      reference: donation.reference,
      payer_name: donation.payer_name,
      amount_sen: donation.amount_sen,
      status: donation.status,
    });
  }
  revalidateAll();
}
