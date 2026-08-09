import { createClient } from "@/lib/supabase/public";
import type { Donation, FollowUpSettings } from "@/lib/database.types";
import { formatMYR } from "@/lib/utils";
import { getCategory } from "@/lib/fidyah";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bayarfidyahonline.com";

/** Variable tags available in follow-up templates, for the admin UI. */
export const FOLLOWUP_TAGS: { tag: string; label: string }[] = [
  { tag: "{{nama}}", label: "Nama pembayar" },
  { tag: "{{rujukan}}", label: "No. rujukan" },
  { tag: "{{jumlah}}", label: "Jumlah" },
  { tag: "{{hari}}", label: "Bilangan hari" },
  { tag: "{{kategori}}", label: "Kategori" },
  { tag: "{{pautan}}", label: "Pautan sambung bayar" },
];

export const DEFAULT_FOLLOWUP: FollowUpSettings = {
  whatsapp_message:
    "Assalamualaikum {{nama}},\n\nKami perasan pembayaran fidyah anda ({{rujukan}}) berjumlah {{jumlah}} masih belum selesai.\n\nAnda boleh menyambung pembayaran di sini:\n{{pautan}}\n\nJika anda telah pun membayar, abaikan mesej ini. Terima kasih.",
  email_subject: "Pembayaran fidyah anda belum selesai — {{rujukan}}",
  email_body:
    "Assalamualaikum {{nama}},\n\nKami perasan pembayaran fidyah anda ({{rujukan}}) berjumlah {{jumlah}} bagi {{hari}} hari masih belum selesai.\n\nAnda boleh menyambung pembayaran melalui pautan di bawah.\n\nJika anda telah pun membayar, abaikan emel ini. Terima kasih.",
};

/**
 * Read the follow-up templates from `site_settings` (key "followup"),
 * merged over the defaults. Falls back to defaults if Supabase is
 * unavailable/unconfigured.
 */
export async function getFollowUpSettings(): Promise<FollowUpSettings> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "followup")
      .maybeSingle();

    if (data?.value) {
      return {
        ...DEFAULT_FOLLOWUP,
        ...(data.value as Partial<FollowUpSettings>),
      };
    }
  } catch {
    // ignore — use defaults
  }
  return DEFAULT_FOLLOWUP;
}

/**
 * "Continue payment" link for a payer. Resolves to a live CHIP checkout via
 * `/bayar/[reference]`, which reissues one if the original has gone stale.
 */
export function paymentLink(donation: Donation): string {
  return `${siteUrl}/bayar/${encodeURIComponent(donation.reference)}`;
}

/** Substitutes the follow-up variable tags with this donation's own values. */
export function applyFollowUpVariables(
  text: string,
  donation: Donation
): string {
  return text
    .replaceAll("{{nama}}", donation.payer_name)
    .replaceAll("{{rujukan}}", donation.reference)
    .replaceAll("{{jumlah}}", formatMYR(donation.amount_sen))
    .replaceAll("{{hari}}", String(donation.days))
    .replaceAll(
      "{{kategori}}",
      getCategory(donation.category)?.title ?? donation.category
    )
    .replaceAll("{{pautan}}", paymentLink(donation));
}
