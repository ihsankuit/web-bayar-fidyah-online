import type { Donation, PaymentMethod } from "@/lib/database.types";

/**
 * What a payment method means across the app, in one place.
 *
 * "Not CHIP" used to mean "manual bank transfer" everywhere. Two more methods
 * exist now — a DuitNow QR or transfer already paid outside the site and
 * recorded over the REST API — so each place that branched on
 * `=== "manual"` needs to say which of those it means. These helpers are the
 * answer, so admin, exports, receipts and the API cannot drift apart.
 */

/** Methods that have no gateway checkout: nothing to send the payer to. */
export function isOffline(method: PaymentMethod): boolean {
  return method !== "chip";
}

/**
 * Methods created over the API for a payment that has ALREADY been made.
 * These are not chased with payment reminders, and are never auto-expired:
 * the money is in the bank and only a person can match it to a statement.
 */
export function isApiRecorded(method: PaymentMethod): boolean {
  return method === "qr" || method === "bank_transfer";
}

/** Short label for lists, exports and receipts. */
export function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case "chip":
      return "Online (CHIP)";
    case "manual":
      return "Pindahan Manual";
    case "qr":
      return "DuitNow QR";
    case "bank_transfer":
      return "Pindahan Bank";
  }
}

/** How the receipt PDF describes the channel. */
export function receiptChannelLabel(method: PaymentMethod): string {
  switch (method) {
    case "chip":
      return "CHIP (FPX / kad)";
    case "qr":
      return "DuitNow QR";
    case "manual":
    case "bank_transfer":
      return "Pindahan bank";
  }
}

/**
 * "Perlu Semak": waiting for staff to check against a bank statement.
 *
 * A donation the payer made through the site's own bank-transfer option
 * qualifies once they have uploaded proof. An API-recorded one qualifies
 * straight away, with or without proof, because the payer has already paid.
 * Stored status stays `pending` for all of them — this is derived.
 */
export function needsReview(
  d: Pick<Donation, "status" | "payment_method" | "proof_of_payment_path">
): boolean {
  if (d.status !== "pending") return false;
  if (isApiRecorded(d.payment_method)) return true;
  return d.payment_method === "manual" && Boolean(d.proof_of_payment_path);
}

/** The status string the REST API and webhooks report. */
export type ApiStatus = Donation["status"] | "review";

/**
 * Status as the API reports it. Only API-recorded payments surface `review`;
 * every other row keeps its stored status, so existing consumers of
 * `pending | paid | failed` see no change for the payments they already know.
 */
export function apiStatus(
  d: Pick<Donation, "status" | "payment_method">
): ApiStatus {
  return d.status === "pending" && isApiRecorded(d.payment_method)
    ? "review"
    : d.status;
}

/** utm_source the chatbot sends by default. */
export const CHATBOT_SOURCE = "chatbot-wa";

/** Human label for where a payment came from, for the admin list. */
export function sourceLabel(utmSource: string | null): string | null {
  if (!utmSource) return null;
  return utmSource === CHATBOT_SOURCE ? "WhatsApp" : null;
}
