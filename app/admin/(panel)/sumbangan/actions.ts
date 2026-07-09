"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { settleDonationByReference } from "@/lib/donations";
import { getPurchase } from "@/lib/chip";
import { sendReceiptEmail } from "@/lib/resend";
import { logActivity } from "@/lib/activity-log";
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
