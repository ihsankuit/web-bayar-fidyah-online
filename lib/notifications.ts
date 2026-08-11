import { createClient } from "@/lib/supabase/public";
import type { Donation, PaymentSuccessSettings } from "@/lib/database.types";
import { formatMYR, formatDate } from "@/lib/utils";
import { getCategory } from "@/lib/fidyah";
import {
  getMurpatiSettings,
  isMurpatiSessionConnected,
  normalizeMalaysianPhone,
  sendMurpatiMedia,
  sendMurpatiText,
} from "@/lib/murpati";
import { SITE_URL } from "@/lib/site-url";

/** Variable tags available in payment-success templates, for the admin UI. */
export const SUCCESS_TAGS: { tag: string; label: string }[] = [
  { tag: "{{nama}}", label: "Nama pembayar" },
  { tag: "{{rujukan}}", label: "No. rujukan" },
  { tag: "{{jumlah}}", label: "Jumlah dibayar" },
  { tag: "{{hari}}", label: "Bilangan hari" },
  { tag: "{{kategori}}", label: "Kategori" },
  { tag: "{{tarikh}}", label: "Tarikh bayaran" },
  { tag: "{{resit}}", label: "Pautan resit PDF" },
];

export const DEFAULT_PAYMENT_SUCCESS: PaymentSuccessSettings = {
  email_subject: "Resit Fidyah — {{rujukan}}",
  email_intro:
    "Assalamualaikum {{nama}},\n\nPembayaran fidyah anda telah berjaya diterima. Berikut adalah butiran resit anda.",
  email_attach_pdf: true,
  whatsapp_enabled: false,
  whatsapp_message:
    "Assalamualaikum {{nama}},\n\nAlhamdulillah, pembayaran fidyah anda sebanyak {{jumlah}} ({{rujukan}}) telah berjaya diterima pada {{tarikh}}.\n\nResit rasmi anda boleh dimuat turun di sini:\n{{resit}}\n\nSemoga Allah SWT menerima amalan anda. Terima kasih.",
  whatsapp_attach_pdf: true,
};

/**
 * Read the payment-success notification templates from `site_settings`
 * (key "payment_success"), merged over the defaults.
 */
export async function getPaymentSuccessSettings(): Promise<PaymentSuccessSettings> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "payment_success")
      .maybeSingle();

    if (data?.value) {
      return {
        ...DEFAULT_PAYMENT_SUCCESS,
        ...(data.value as Partial<PaymentSuccessSettings>),
      };
    }
  } catch {
    // ignore — use defaults
  }
  return DEFAULT_PAYMENT_SUCCESS;
}

/** Public URL of this donation's PDF receipt. */
export function receiptLink(donation: Donation): string {
  return `${SITE_URL}/resit/${encodeURIComponent(donation.reference)}`;
}

/** Substitutes the payment-success variable tags with this donation's values. */
export function applySuccessVariables(
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
    .replaceAll(
      "{{tarikh}}",
      formatDate(donation.paid_at ?? donation.created_at)
    )
    .replaceAll("{{resit}}", receiptLink(donation));
}

/**
 * WhatsApp confirmation for a settled payment. Opt-in (off by default) since
 * it spends Murpati quota and needs a connected device. Fails soft — the
 * payment is already recorded and the receipt email is the primary channel.
 */
export async function sendPaymentSuccessWhatsApp(
  donation: Donation
): Promise<void> {
  try {
    const settings = await getPaymentSuccessSettings();
    if (!settings.whatsapp_enabled) return;

    const phone = normalizeMalaysianPhone(donation.payer_phone ?? "");
    if (!phone) return;

    const murpati = await getMurpatiSettings();
    if (!murpati.apiKey || !murpati.sessionId) return;
    if (!(await isMurpatiSessionConnected(murpati))) {
      console.warn("[notifications] Murpati not connected — skipping WhatsApp.");
      return;
    }

    const message = applySuccessVariables(settings.whatsapp_message, donation);

    // Murpati fetches the media itself, so the receipt route has to be
    // publicly reachable — which it is, keyed by the reference.
    const result = settings.whatsapp_attach_pdf
      ? await sendMurpatiMedia(murpati, phone, receiptLink(donation), message)
      : await sendMurpatiText(murpati, phone, message);

    if (!result.ok) {
      console.error("[notifications] WhatsApp receipt failed:", result.error);
    }
  } catch (err) {
    console.error("[notifications] WhatsApp receipt threw:", err);
  }
}
