import crypto from "crypto";
import type { Donation } from "@/lib/database.types";
import { getIntegrationSettings } from "@/lib/integrations";

/**
 * Outbound webhooks — POST events to an external automation endpoint (e.g. an
 * n8n Webhook node). Configure `N8N_WEBHOOK_URL` and, optionally,
 * `WEBHOOK_SIGNING_SECRET` to receive an `X-Signature: sha256=<hmac>` header
 * the receiver can verify against the raw request body.
 *
 * Fails soft — a webhook error never breaks the payment flow.
 */
export type WebhookEvent =
  | "donation.created"
  | "donation.paid"
  | "donation.failed";

export async function sendWebhook(
  event: WebhookEvent,
  data: unknown
): Promise<void> {
  const { n8n_webhook_url: url, webhook_signing_secret: secret } =
    await getIntegrationSettings();
  if (!url) return;

  const body = JSON.stringify({
    event,
    data,
    timestamp: new Date().toISOString(),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": event,
  };

  if (secret) {
    const signature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");
    headers["X-Signature"] = `sha256=${signature}`;
  }

  try {
    await fetch(url, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });
  } catch (err) {
    console.error(`[webhook] failed to deliver ${event}:`, err);
  }
}

/** Friendly, stable payload for a donation event (adds Ringgit `amount`). */
export function donationEventData(donation: Donation) {
  return {
    ...donation,
    amount: donation.amount_sen / 100,
    currency: "MYR",
  };
}

/** Emit a donation lifecycle event. */
export async function emitDonationEvent(
  event: WebhookEvent,
  donation: Donation
): Promise<void> {
  await sendWebhook(event, donationEventData(donation));
}
