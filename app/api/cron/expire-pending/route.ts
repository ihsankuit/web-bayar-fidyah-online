import { NextResponse, after } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { emitDonationEvent } from "@/lib/webhooks";
import type { Donation } from "@/lib/database.types";

const CHIP_TIMEOUT_HOURS = 24;
const MANUAL_TIMEOUT_DAYS = 7;

/**
 * Scheduled cleanup (Vercel Cron, see vercel.json) for donations abandoned
 * mid-flow:
 * - CHIP: pending past 24h almost certainly means the payer left checkout
 *   without paying (a real payment settles via webhook/redirect quickly).
 * - Manual transfer: only expired past 7 days AND with no proof uploaded —
 *   a proof means it's awaiting admin review and must never be auto-failed.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET belum dikonfigurasi." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Tidak dibenarkan." }, { status: 401 });
  }

  const supabase = createAdminClient();

  const chipCutoff = new Date(
    Date.now() - CHIP_TIMEOUT_HOURS * 60 * 60 * 1000
  ).toISOString();
  const manualCutoff = new Date(
    Date.now() - MANUAL_TIMEOUT_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: expiredChip } = await supabase
    .from("donations")
    .update({ status: "failed" })
    .eq("status", "pending")
    .eq("payment_method", "chip")
    .lt("created_at", chipCutoff)
    .select("*");

  const { data: expiredManual } = await supabase
    .from("donations")
    .update({ status: "failed" })
    .eq("status", "pending")
    .eq("payment_method", "manual")
    .is("proof_of_payment_path", null)
    .lt("created_at", manualCutoff)
    .select("*");

  const chipCount = expiredChip?.length ?? 0;
  const manualCount = expiredManual?.length ?? 0;

  if (chipCount + manualCount > 0) {
    await supabase.from("admin_activity_log").insert({
      actor: "system:cron",
      action: "donation.auto_expire",
      details: { chip: chipCount, manual: manualCount },
    });

    // Let the follow-up automation (e.g. n8n) know so it can nudge the payer
    // to retry — fired after the response so a slow receiver never delays cron.
    const expired = [
      ...((expiredChip ?? []) as Donation[]),
      ...((expiredManual ?? []) as Donation[]),
    ];
    after(() =>
      Promise.all(expired.map((d) => emitDonationEvent("donation.failed", d)))
    );
  }

  return NextResponse.json({ ok: true, expired: { chip: chipCount, manual: manualCount } });
}
