"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  deleteDonation,
  markDonationPaid,
  settleDonationByReference,
} from "@/lib/donations";
import { getPurchase } from "@/lib/chip";
import { getCategory } from "@/lib/fidyah";
import { sendFollowUpEmail, sendReceiptEmail } from "@/lib/resend";
import { logActivity } from "@/lib/activity-log";
import { applyFollowUpVariables, paymentLink } from "@/lib/followup";
import {
  getMurpatiSettings,
  isMurpatiSessionConnected,
  normalizeMalaysianPhone,
  sendMurpatiText,
} from "@/lib/murpati";
import type { Donation } from "@/lib/database.types";

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

  // The reminder going out matters more than the bookkeeping, so a failure
  // here doesn't fail the action — but it must not pass silently either. An
  // admin who sees "sent" while the counter stays at zero has no way to tell
  // whether the message actually went, or how many times they've now chased
  // the same payer.
  let countWarning = "";
  if (sent.length > 0) {
    const { error: countError } = await supabase
      .from("donations")
      .update({
        followup_count: (donation.followup_count ?? 0) + 1,
        last_followup_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (countError) {
      console.error("[followup] could not record the count:", countError);
      countWarning =
        " Amaran: kiraan susulan tidak direkod — lajur followup_count/last_followup_at mungkin belum wujud dalam pangkalan data (lihat supabase/schema.sql).";
    }
  }

  await logActivity("donation.followup", {
    reference: donation.reference,
    status: donation.status,
    // Which step of the sequence went out, so the log reads as a history of
    // how a payer was chased rather than a run of identical entries.
    stage: ((formData.get("stage_name") as string) || "").trim() || "-",
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
      (failed.length > 0 ? ` Gagal: ${failed.join("; ")}.` : "") +
      countWarning,
  };
}

export interface EditDonationState {
  error?: string;
  ok?: boolean;
  message?: string;
}

const editSchema = z.object({
  payer_name: z.string().trim().min(1, "Nama pembayar diperlukan.").max(120),
  payer_email: z.string().trim().email("Alamat emel tidak sah.").max(160),
  payer_phone: z.string().trim().max(30),
  negeri: z.string().trim().max(60),
  category: z.string().trim().min(1),
  days: z.coerce
    .number()
    .int()
    .min(1, "Bilangan hari mesti sekurang-kurangnya 1.")
    .max(365, "Bilangan hari tidak boleh melebihi 365."),
  multiplier: z.coerce
    .number()
    .int()
    .min(1, "Gandaan mesti sekurang-kurangnya 1.")
    .max(20, "Gandaan tidak boleh melebihi 20."),
  amount: z.coerce.number().min(1, "Jumlah minimum ialah RM1.00").max(1_000_000),
  message: z.string().trim().max(500),
  status: z.enum(["pending", "paid", "failed"]),
});

/** Human-readable field labels for the activity log, so the audit trail reads. */
const FIELD_LABELS: Record<string, string> = {
  payer_name: "nama",
  payer_email: "emel",
  payer_phone: "telefon",
  negeri: "negeri",
  category: "kategori",
  days: "hari",
  multiplier: "gandaan",
  amount_sen: "jumlah (sen)",
  message: "catatan",
  status: "status",
};

/**
 * Edit a donation record and, optionally, settle it.
 *
 * This exists for payments that happened outside the gateway: a payer whose
 * CHIP attempt failed, who then paid some other way and sent the receipt over
 * WhatsApp. The admin uploads that receipt against the record and confirms
 * it here, which is the only way such a payment ever reaches `paid`.
 *
 * Field changes are written before any status change, so that a confirmation
 * sends the receipt with the corrected amount rather than the stale one. The
 * before/after of every changed field goes to the activity log — this action
 * can move money figures, so it must not be silent.
 */
export async function updateDonation(
  _prev: EditDonationState,
  formData: FormData
): Promise<EditDonationState> {
  const supabase = await requireUser();
  const id = formData.get("id") as string;
  if (!id) return { error: "Sumbangan tidak sah." };

  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Maklumat tidak sah." };
  }
  const input = parsed.data;

  if (!getCategory(input.category)) {
    return { error: "Kategori tidak sah." };
  }

  const { data: donation } = await supabase
    .from("donations")
    .select("*")
    .eq("id", id)
    .maybeSingle<Donation>();
  if (!donation) return { error: "Rekod sumbangan tidak dijumpai." };

  // Ringgit in the form, sen in the database. Rounding rather than truncating
  // so RM100.10 doesn't quietly become RM100.09.
  const amountSen = Math.round(input.amount * 100);

  const fields = {
    payer_name: input.payer_name,
    payer_email: input.payer_email,
    payer_phone: input.payer_phone || null,
    negeri: input.negeri || null,
    category: input.category,
    days: input.days,
    multiplier: input.multiplier,
    amount_sen: amountSen,
    message: input.message || null,
  };

  const changes: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    const before = donation[key as keyof Donation] ?? null;
    if (before !== value) {
      changes[FIELD_LABELS[key] ?? key] = `${before ?? "-"} → ${value ?? "-"}`;
    }
  }

  if (Object.keys(changes).length > 0) {
    const { error } = await supabase
      .from("donations")
      .update(fields)
      .eq("id", id);
    if (error) {
      console.error("[sumbangan/updateDonation] update failed:", error);
      return { error: `Gagal menyimpan perubahan: ${error.message}` };
    }
  }

  // Status is handled separately from the plain fields: moving to `paid` has
  // to go through markDonationPaid so the receipt, the WhatsApp confirmation,
  // the server-side conversion and the webhook each fire exactly once.
  let statusNote = "";
  if (input.status !== donation.status) {
    changes[FIELD_LABELS.status] = `${donation.status} → ${input.status}`;

    if (input.status === "paid") {
      const settled = await markDonationPaid(id);
      if (!settled) return { error: "Gagal mengesahkan pembayaran." };
      statusNote = " Resit dihantar kepada pembayar.";
    } else {
      // Reversing a confirmation. Nothing is sent, and paid_at is cleared so
      // the record doesn't claim a payment time for a payment that is no
      // longer confirmed.
      const { error } = await supabase
        .from("donations")
        .update({ status: input.status, paid_at: null })
        .eq("id", id);
      if (error) return { error: `Gagal menukar status: ${error.message}` };
      statusNote =
        donation.status === "paid"
          ? " Pengesahan pembayaran ditarik balik."
          : "";
    }
  }

  if (Object.keys(changes).length === 0) {
    return { ok: true, message: "Tiada perubahan untuk disimpan." };
  }

  await logActivity("donation.edit", {
    reference: donation.reference,
    ...changes,
  });

  revalidateAll();
  return {
    ok: true,
    message: `Sumbangan ${donation.reference} dikemaskini.${statusNote}`,
  };
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
