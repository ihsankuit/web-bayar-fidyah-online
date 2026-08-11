import { Resend } from "resend";
import type { Donation } from "@/lib/database.types";
import { formatMYR, formatDate } from "@/lib/utils";
import { getCategory } from "@/lib/fidyah";
import { buildReceiptPdf } from "@/lib/receipt-pdf";
import {
  applySuccessVariables,
  getPaymentSuccessSettings,
} from "@/lib/notifications";
import { SITE_URL } from "@/lib/site-url";

const FROM =
  process.env.RESEND_FROM_EMAIL ?? "Fidyah Online <onboarding@resend.dev>";

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/**
 * Send a payment receipt to the payer. Fails soft: if Resend isn't configured
 * or the send errors, we log and continue (the payment is already recorded).
 */
export async function sendReceiptEmail(donation: Donation): Promise<void> {
  const resend = getClient();
  if (!resend) {
    console.warn("[resend] RESEND_API_KEY not set — skipping receipt email.");
    return;
  }

  const settings = await getPaymentSuccessSettings();
  const categoryTitle =
    getCategory(donation.category)?.title ?? donation.category;
  const intro = applySuccessVariables(settings.email_intro, donation);
  const subject = applySuccessVariables(settings.email_subject, donation);

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a2333;">
    <div style="background: #2563eb; color: #fff; padding: 24px; border-radius: 12px 12px 0 0;">
      <h1 style="margin: 0; font-size: 20px;">Resit Pembayaran Fidyah</h1>
      <p style="margin: 4px 0 0; opacity: .9;">Terima kasih atas pembayaran anda.</p>
    </div>
    <div style="border: 1px solid #e2e6ef; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
      <div style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(intro)}</div>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        ${row("No. Rujukan", donation.reference)}
        ${row("Kategori", categoryTitle)}
        ${row("Bilangan hari", String(donation.days))}
        ${row("Gandaan", `× ${donation.multiplier}`)}
        ${row("Kadar sehari", formatMYR(donation.rate_sen))}
        ${
          donation.upsell_accepted && donation.upsell_title
            ? row(
                escapeHtml(donation.upsell_title),
                formatMYR(donation.upsell_amount_sen)
              )
            : ""
        }
        ${row("Jumlah dibayar", `<strong>${formatMYR(donation.amount_sen)}</strong>`)}
        ${row("Tarikh", donation.paid_at ? formatDate(donation.paid_at) : formatDate(donation.created_at))}
      </table>
      <p style="margin: 20px 0;">
        <a href="${SITE_URL}/resit/${encodeURIComponent(donation.reference)}"
           style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
          Muat Turun Resit (PDF)
        </a>
      </p>
      <p style="color: #5a6478; font-size: 13px;">
        Semoga Allah SWT menerima amalan anda dan memberi ganjaran yang berlipat ganda. Aamiin.
      </p>
    </div>
  </div>`;

  // Attach the PDF so the payer keeps a copy even without following the link.
  // Generating it must never cost them the email itself, so a failure here
  // just drops the attachment.
  let attachments: { filename: string; content: Buffer }[] | undefined;
  if (settings.email_attach_pdf) {
    try {
      const pdf = await buildReceiptPdf(donation);
      attachments = [
        {
          filename: `resit-${donation.reference}.pdf`,
          content: Buffer.from(pdf),
        },
      ];
    } catch (err) {
      console.error("[resend] receipt PDF failed, sending without it:", err);
    }
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: donation.payer_email,
      subject,
      html,
      ...(attachments ? { attachments } : {}),
    });
  } catch (err) {
    console.error("[resend] Failed to send receipt email:", err);
  }
}

/**
 * Send a manually-composed follow-up email to a payer whose payment is still
 * pending or has failed. `body` is plain text (as typed by the admin) —
 * escaped and rendered with line breaks preserved. Returns false on failure
 * so the caller can report which channels actually went out.
 */
export async function sendFollowUpEmail(
  to: string,
  subject: string,
  body: string,
  actionUrl: string
): Promise<boolean> {
  const resend = getClient();
  if (!resend) {
    console.warn("[resend] RESEND_API_KEY not set — skipping follow-up email.");
    return false;
  }

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a2333;">
    <div style="background: #2563eb; color: #fff; padding: 24px; border-radius: 12px 12px 0 0;">
      <h1 style="margin: 0; font-size: 20px;">Bayar Fidyah Online</h1>
    </div>
    <div style="border: 1px solid #e2e6ef; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
      <div style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(body)}</div>
      <p style="margin: 24px 0 0;">
        <a href="${escapeHtml(actionUrl)}"
           style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
          Sambung Pembayaran
        </a>
      </p>
    </div>
  </div>`;

  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    return true;
  } catch (err) {
    console.error("[resend] Failed to send follow-up email:", err);
    return false;
  }
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding: 8px 0; color: #5a6478; border-bottom: 1px solid #eef1f6;">${label}</td>
    <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #eef1f6;">${value}</td>
  </tr>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
