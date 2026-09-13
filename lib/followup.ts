import { createClient } from "@/lib/supabase/public";
import type {
  Donation,
  FollowUpSettings,
  FollowUpStage,
} from "@/lib/database.types";
import { formatMYR } from "@/lib/utils";
import { getCategory } from "@/lib/fidyah";
import { SITE_URL } from "@/lib/site-url";

/** Variable tags available in follow-up templates, for the admin UI. */
export const FOLLOWUP_TAGS: { tag: string; label: string }[] = [
  { tag: "{{nama}}", label: "Nama pembayar" },
  { tag: "{{rujukan}}", label: "No. rujukan" },
  { tag: "{{jumlah}}", label: "Jumlah" },
  { tag: "{{hari}}", label: "Bilangan hari" },
  { tag: "{{kategori}}", label: "Kategori" },
  { tag: "{{pautan}}", label: "Pautan sambung bayar" },
];

/**
 * More than this and the sequence stops being a follow-up and starts being
 * pestering — which, for a religious obligation someone chose to fulfil
 * voluntarily, does more harm than the unpaid record is worth.
 */
export const MAX_FOLLOWUP_STAGES = 5;

/**
 * The shipped sequence. The tone softens rather than hardens as it goes:
 * step 1 assumes they simply forgot, step 2 assumes something went wrong and
 * offers help, step 3 steps back and leaves the door open without asking
 * again.
 *
 * Written to sound like a person, not a system reporting on a record. That
 * means naming a likely reason the payment stalled rather than just stating
 * that it did, short sentences over formal ones, and the reference number at
 * the bottom in brackets — nobody opens a message to a person with a case
 * number. The emails skip the reference in the body because it is already in
 * the subject, and skip {{pautan}} because a "Sambung Pembayaran" button is
 * appended to every one of them automatically.
 */
export const DEFAULT_FOLLOWUP_STAGES: FollowUpStage[] = [
  {
    name: "Susulan 1 — Peringatan lembut",
    whatsapp_message:
      "Assalamualaikum {{nama}},\n\nKami perasan pembayaran fidyah {{jumlah}} yang anda mulakan tempoh hari belum sempat selesai. Selalunya halaman bayaran tertutup dahulu sebelum sempat habis — perkara biasa.\n\nKalau mahu sambung, boleh terus dari sini:\n{{pautan}}\n\nKalau sudah dibayar, abaikan sahaja mesej ini. Terima kasih.\n\n(Rujukan: {{rujukan}})",
    email_subject: "Fidyah anda belum sempat selesai ({{rujukan}})",
    email_body:
      "Assalamualaikum {{nama}},\n\nKami perasan pembayaran fidyah {{jumlah}} bagi {{hari}} hari yang anda mulakan tempoh hari belum sempat selesai. Selalunya halaman bayaran tertutup dahulu sebelum sempat habis — perkara biasa, dan mudah disambung semula.\n\nButang di bawah membawa anda terus ke tempat anda berhenti.\n\nKalau sudah dibayar, abaikan sahaja emel ini. Terima kasih.",
  },
  {
    name: "Susulan 2 — Tawaran bantuan",
    whatsapp_message:
      "Assalamualaikum {{nama}},\n\nFidyah {{hari}} hari ({{jumlah}}) yang anda mulakan masih belum selesai.\n\nAda masalah semasa membayar? Kadangkala bank menolak transaksi, atau OTP lambat sampai. Kalau begitu keadaannya, balas sahaja mesej ini — kami bantu uruskan.\n\nKalau mahu cuba semula sendiri:\n{{pautan}}\n\nKalau sudah dibayar, abaikan ya. Terima kasih.\n\n(Rujukan: {{rujukan}})",
    email_subject: "Ada masalah semasa membayar fidyah? ({{rujukan}})",
    email_body:
      "Assalamualaikum {{nama}},\n\nFidyah {{hari}} hari ({{jumlah}}) yang anda mulakan masih belum selesai.\n\nAda masalah semasa membayar? Kadangkala bank menolak transaksi, atau halaman tertutup sebelum sempat disahkan. Kalau begitu keadaannya, balas sahaja emel ini dan kami bantu uruskan.\n\nKalau mahu cuba semula sendiri, gunakan butang di bawah.\n\nKalau sudah dibayar, abaikan ya. Terima kasih.",
  },
  {
    name: "Susulan 3 — Tanpa desakan",
    whatsapp_message:
      "Assalamualaikum {{nama}},\n\nIni mesej terakhir daripada kami tentang fidyah {{jumlah}} itu — bukan kerana ada tempoh tamat, tetapi kerana kami tidak mahu mengganggu anda berulang kali.\n\nPautan ini kekal terbuka. Tiada tarikh luput, tiada desakan. Sambung bila-bila masa yang senang untuk anda:\n{{pautan}}\n\nKalau sekarang bukan masanya, kami faham. Kalau sudah dibayar dengan cara lain, abaikan sahaja mesej ini.\n\nSemoga Allah memudahkan urusan anda.\n\n(Rujukan: {{rujukan}})",
    email_subject: "Pautan fidyah anda kekal terbuka ({{rujukan}})",
    email_body:
      "Assalamualaikum {{nama}},\n\nIni emel terakhir daripada kami tentang fidyah {{jumlah}} bagi {{hari}} hari itu — bukan kerana ada tempoh tamat, tetapi kerana kami tidak mahu mengganggu anda berulang kali.\n\nPautan di bawah kekal terbuka. Tiada tarikh luput, tiada desakan — sambung bila-bila masa yang senang untuk anda.\n\nKalau sekarang bukan masanya, kami faham. Kalau sudah dibayar dengan cara lain, abaikan sahaja emel ini.\n\nSemoga Allah memudahkan urusan anda.",
  },
];

export const DEFAULT_FOLLOWUP: FollowUpSettings = {
  stages: DEFAULT_FOLLOWUP_STAGES,
};

/**
 * Coerce whatever is stored under the "followup" key into the current shape.
 *
 * Settings saved before the sequence existed are a single flat
 * {whatsapp_message, email_subject, email_body} object. That wording is the
 * admin's own, so it becomes step 1 rather than being replaced by the
 * default — and the later steps are appended so the sequence is usable
 * immediately without anyone having to migrate anything by hand.
 */
export function normalizeFollowUpSettings(value: unknown): FollowUpSettings {
  const raw = (value ?? {}) as Record<string, unknown>;

  const stages = Array.isArray(raw.stages)
    ? (raw.stages as unknown[])
        .map((entry, i) => coerceStage(entry, i))
        .filter((s): s is FollowUpStage => s !== null)
    : [];

  if (stages.length > 0) return { stages: stages.slice(0, MAX_FOLLOWUP_STAGES) };

  const legacy = coerceStage(raw, 0);
  if (legacy) return { stages: [legacy, ...DEFAULT_FOLLOWUP_STAGES.slice(1)] };

  return DEFAULT_FOLLOWUP;
}

/** A stage with every field filled, or null if there was nothing usable. */
function coerceStage(value: unknown, index: number): FollowUpStage | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const text = (key: string): string =>
    typeof raw[key] === "string" ? (raw[key] as string).trim() : "";

  const whatsapp = text("whatsapp_message");
  const subject = text("email_subject");
  const body = text("email_body");
  if (!whatsapp && !subject && !body) return null;

  const fallback =
    DEFAULT_FOLLOWUP_STAGES[index] ?? DEFAULT_FOLLOWUP_STAGES[0];
  return {
    name: text("name") || fallback.name || `Susulan ${index + 1}`,
    whatsapp_message: whatsapp || fallback.whatsapp_message,
    email_subject: subject || fallback.email_subject,
    email_body: body || fallback.email_body,
  };
}

/**
 * The step to preselect for a payer who has already had `count` reminders —
 * none yet means step 1, and anyone chased past the end of the sequence
 * stays on the last (gentlest, final) step rather than falling off it.
 */
export function stageIndexForCount(
  settings: FollowUpSettings,
  count: number | null | undefined
): number {
  const last = Math.max(0, settings.stages.length - 1);
  return Math.min(Math.max(count ?? 0, 0), last);
}

/**
 * Read the follow-up templates from `site_settings` (key "followup").
 * Falls back to defaults if Supabase is unavailable/unconfigured.
 */
export async function getFollowUpSettings(): Promise<FollowUpSettings> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "followup")
      .maybeSingle();

    if (data?.value) return normalizeFollowUpSettings(data.value);
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
  return `${SITE_URL}/bayar/${encodeURIComponent(donation.reference)}`;
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
