import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Donation } from "@/lib/database.types";
import { formatMYR, formatDate } from "@/lib/utils";
import { getCategory } from "@/lib/fidyah";

/**
 * Official receipt PDF for a settled fidyah payment, generated on demand from
 * the donation record (there is nothing stored per-receipt — the donation row
 * is the source of truth, so a re-download always reflects it).
 *
 * Uses pdf-lib with the built-in Helvetica family: no font files to ship and
 * no native dependencies, which keeps this runnable inside a serverless
 * function. Malay text is Latin-only so the standard WinAnsi encoding covers
 * it — but that encoding throws on characters outside it, so any text coming
 * from the database is sanitised before being drawn.
 */

const BRAND = rgb(0.145, 0.388, 0.921); // matches the site's primary blue
const INK = rgb(0.102, 0.137, 0.2);
const MUTED = rgb(0.353, 0.392, 0.471);
const HAIRLINE = rgb(0.886, 0.902, 0.937);

const PAGE_W = 595.28; // A4 portrait, in points
const PAGE_H = 841.89;
const MARGIN = 56;

/**
 * Drops characters the standard WinAnsi encoding can't represent (emoji,
 * Arabic, CJK) so a payer's name never crashes receipt generation.
 */
function sanitize(text: string): string {
  return (
    text
      .normalize("NFKD")
      // Keep printable Latin-1; strip anything else.
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
      .trim() || "-"
  );
}

interface RowOptions {
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
}

export async function buildReceiptPdf(donation: Donation): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  pdf.setTitle(`Resit Fidyah ${donation.reference}`);
  pdf.setSubject("Resit pembayaran fidyah");
  pdf.setProducer("Bayar Fidyah Online");

  // ---- Header band -------------------------------------------------------
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 132,
    width: PAGE_W,
    height: 132,
    color: BRAND,
  });
  page.drawText("Bayar Fidyah Online", {
    x: MARGIN,
    y: PAGE_H - 62,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Resit Pembayaran Fidyah", {
    x: MARGIN,
    y: PAGE_H - 86,
    size: 12,
    font,
    color: rgb(1, 1, 1),
  });

  const paidLabel = "LUNAS";
  const paidWidth = bold.widthOfTextAtSize(paidLabel, 11);
  page.drawRectangle({
    x: PAGE_W - MARGIN - paidWidth - 20,
    y: PAGE_H - 74,
    width: paidWidth + 20,
    height: 24,
    color: rgb(1, 1, 1),
    opacity: 0.18,
  });
  page.drawText(paidLabel, {
    x: PAGE_W - MARGIN - paidWidth - 10,
    y: PAGE_H - 67,
    size: 11,
    font: bold,
    color: rgb(1, 1, 1),
  });

  // ---- Meta --------------------------------------------------------------
  let y = PAGE_H - 172;

  const paidAt = donation.paid_at ?? donation.created_at;
  y = drawMetaPair(
    page,
    { font, bold },
    y,
    "No. Rujukan",
    sanitize(donation.reference),
    "Tarikh Bayaran",
    sanitize(formatDate(paidAt))
  );
  y = drawMetaPair(
    page,
    { font, bold },
    y,
    "Nama Pembayar",
    sanitize(donation.payer_name),
    "Negeri",
    sanitize(donation.negeri ?? "-")
  );
  y = drawMetaPair(
    page,
    { font, bold },
    y,
    "Emel",
    sanitize(donation.payer_email),
    "Kaedah Bayaran",
    donation.payment_method === "manual" ? "Pindahan Bank" : "CHIP (FPX/Kad)"
  );

  // ---- Breakdown ---------------------------------------------------------
  y -= 16;
  page.drawText("Butiran", {
    x: MARGIN,
    y,
    size: 12,
    font: bold,
    color: INK,
  });
  y -= 14;
  line(page, y);
  y -= 22;

  const upsellSen = donation.upsell_accepted ? donation.upsell_amount_sen : 0;
  const fidyahSen = donation.amount_sen - upsellSen;

  y = drawRow(
    page,
    { font, bold },
    y,
    "Kategori",
    sanitize(getCategory(donation.category)?.title ?? donation.category)
  );
  y = drawRow(
    page,
    { font, bold },
    y,
    "Bilangan hari",
    `${donation.days} hari`
  );
  if (donation.multiplier > 1) {
    y = drawRow(page, { font, bold }, y, "Gandaan", `x ${donation.multiplier}`);
  }
  y = drawRow(
    page,
    { font, bold },
    y,
    "Kadar sehari",
    formatMYR(donation.rate_sen)
  );
  y = drawRow(page, { font, bold }, y, "Jumlah fidyah", formatMYR(fidyahSen));

  if (upsellSen > 0) {
    y = drawRow(
      page,
      { font, bold },
      y,
      sanitize(donation.upsell_title || "Kempen Tambahan"),
      formatMYR(upsellSen)
    );
  }

  y -= 6;
  line(page, y);
  y -= 26;
  page.drawText("JUMLAH DIBAYAR", {
    x: MARGIN,
    y,
    size: 12,
    font: bold,
    color: INK,
  });
  const total = formatMYR(donation.amount_sen);
  page.drawText(total, {
    x: PAGE_W - MARGIN - bold.widthOfTextAtSize(total, 16),
    y: y - 3,
    size: 16,
    font: bold,
    color: BRAND,
  });

  // ---- Footer ------------------------------------------------------------
  const notes = [
    "Resit ini dijana secara automatik dan sah tanpa tandatangan.",
    "Semoga Allah SWT menerima amalan anda dan memberi ganjaran berlipat ganda. Aamiin.",
  ];
  let ny = 110;
  for (const note of notes) {
    page.drawText(note, { x: MARGIN, y: ny, size: 9, font, color: MUTED });
    ny -= 14;
  }
  line(page, 84);
  page.drawText("bayarfidyahonline.com", {
    x: MARGIN,
    y: 64,
    size: 9,
    font: bold,
    color: MUTED,
  });

  return pdf.save();
}

function line(page: PDFPage, y: number) {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1,
    color: HAIRLINE,
  });
}

/** Two label/value columns side by side. Returns the next y position. */
function drawMetaPair(
  page: PDFPage,
  fonts: { font: PDFFont; bold: PDFFont },
  y: number,
  leftLabel: string,
  leftValue: string,
  rightLabel: string,
  rightValue: string
): number {
  const colX = PAGE_W / 2 + 10;
  page.drawText(leftLabel, { x: MARGIN, y, size: 9, font: fonts.font, color: MUTED });
  page.drawText(rightLabel, { x: colX, y, size: 9, font: fonts.font, color: MUTED });
  page.drawText(leftValue, {
    x: MARGIN,
    y: y - 15,
    size: 11,
    font: fonts.bold,
    color: INK,
  });
  page.drawText(rightValue, {
    x: colX,
    y: y - 15,
    size: 11,
    font: fonts.bold,
    color: INK,
  });
  return y - 42;
}

/** A label-left / value-right breakdown row. Returns the next y position. */
function drawRow(
  page: PDFPage,
  fonts: { font: PDFFont; bold: PDFFont },
  y: number,
  label: string,
  value: string,
  options: RowOptions = {}
): number {
  const valueFont = options.bold ? fonts.bold : fonts.font;
  page.drawText(label, {
    x: MARGIN,
    y,
    size: 11,
    font: fonts.font,
    color: MUTED,
  });
  page.drawText(value, {
    x: PAGE_W - MARGIN - valueFont.widthOfTextAtSize(value, 11),
    y,
    size: 11,
    font: valueFont,
    color: options.color ?? INK,
  });
  return y - 24;
}
