import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Donation } from "@/lib/database.types";
import { getCategory } from "@/lib/fidyah";
import { ORG } from "@/lib/organization";
import {
  RECEIPT_LOGO_ASPECT,
  RECEIPT_LOGO_PNG_BASE64,
} from "@/lib/receipt-logo";

/**
 * Official receipt PDF for a settled fidyah payment, generated on demand from
 * the donation record (there is nothing stored per-receipt — the donation row
 * is the source of truth, so a re-download always reflects it).
 *
 * Plain black-and-white invoice layout: logo and RESIT heading, issuer and
 * payer blocks, a product table (one row per missed year for lewat qada'),
 * totals, and a footer note.
 *
 * Uses pdf-lib with the built-in Helvetica family: no font files to ship and
 * no native dependencies, which keeps this runnable inside a serverless
 * function. Malay text is Latin-only so the standard WinAnsi encoding covers
 * it — but that encoding throws on characters outside it, so any text coming
 * from the database is sanitised before being drawn.
 */

const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const GREY = rgb(0.35, 0.35, 0.35);
const RED = rgb(0.86, 0.1, 0.1);
const BORDER = rgb(0.2, 0.2, 0.2);

const PAGE_W = 595.28; // A4 portrait, in points
const PAGE_H = 841.89;
const MARGIN = 36;
const RIGHT = PAGE_W - MARGIN;
const TABLE_W = RIGHT - MARGIN;
const ROW_H = 26;
const FOOTER_TOP = 90; // nothing in the table may be drawn below this

// Issuer details as they should appear on a receipt.
const ISSUER_SITE = "www.ihsanku.org";
const ISSUER_EMAIL = "salam@ihsanku.org";
const ISSUER_PHONE = "+601113190312";

// Table columns: Produk | Harga | Kuantiti | Subjumlah
const COL_PRICE = MARGIN + 262;
const COL_QTY = COL_PRICE + 72;
const COL_SUB = RIGHT - 104;

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

const MYT = "Asia/Kuala_Lumpur";

/** 20-11-2026, in Malaysia time. */
function receiptDate(input: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: MYT,
  })
    .format(new Date(input))
    .replace(/\//g, "-");
}

/** 9:40:48 AM, in Malaysia time. */
function receiptTime(input: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: MYT,
  }).format(new Date(input));
}

function money(sen: number): string {
  return (sen / 100).toFixed(2);
}

interface Fonts {
  font: PDFFont;
  bold: PDFFont;
}

interface TableRow {
  label: string;
  priceSen: number;
  qty: number;
  subtotalSen: number;
}

function rowsFor(donation: Donation): TableRow[] {
  const upsellSen = donation.upsell_accepted ? donation.upsell_amount_sen : 0;
  const category = sanitize(
    getCategory(donation.category)?.title ?? donation.category
  );
  const rows: TableRow[] = [];

  if (donation.qada_breakdown && donation.qada_breakdown.length > 0) {
    // One line per missed year, so the payer can see how the total was built.
    for (const r of donation.qada_breakdown) {
      const qty = r.days * r.multiplier;
      rows.push({
        label: sanitize(
          `Fidyah lewat qada' ${r.label}, ${r.days} hari x ${r.multiplier}`
        ),
        priceSen: donation.rate_sen,
        qty,
        subtotalSen: r.subtotal_sen,
      });
    }
  } else {
    const qty = donation.days * Math.max(1, donation.multiplier);
    rows.push({
      label: sanitize(
        donation.multiplier > 1
          ? `Fidyah ${category}, ${donation.days} hari x ${donation.multiplier}`
          : `Fidyah ${category}, ${donation.days} hari`
      ),
      priceSen: donation.rate_sen,
      qty,
      subtotalSen: donation.amount_sen - upsellSen,
    });
  }

  if (upsellSen > 0) {
    rows.push({
      label: sanitize(donation.upsell_title || "Kempen Tambahan"),
      priceSen: upsellSen,
      qty: 1,
      subtotalSen: upsellSen,
    });
  }
  return rows;
}

export async function buildReceiptPdf(donation: Donation): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = { font, bold };
  const logo = await pdf.embedPng(
    Buffer.from(RECEIPT_LOGO_PNG_BASE64, "base64")
  );

  pdf.setTitle(`Resit Fidyah ${donation.reference}`);
  pdf.setSubject("Resit pembayaran fidyah");
  pdf.setProducer("Bayar Fidyah Online");

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  const paidAt = donation.paid_at ?? donation.created_at;

  // ---- Heading: logo left, RESIT + number/date right ---------------------
  const logoW = 100;
  const logoH = logoW / RECEIPT_LOGO_ASPECT;
  page.drawImage(logo, {
    x: MARGIN + 28,
    y: PAGE_H - 52 - logoH,
    width: logoW,
    height: logoH,
  });

  const title = "RESIT";
  page.drawText(title, {
    x: RIGHT - bold.widthOfTextAtSize(title, 22),
    y: PAGE_H - 62,
    size: 22,
    font: bold,
    color: BLACK,
  });
  metaLine(page, fonts, PAGE_H - 88, "No. Resit :", sanitize(donation.reference));
  metaLine(page, fonts, PAGE_H - 106, "Tarikh :", receiptDate(paidAt));

  // ---- Issuer ------------------------------------------------------------
  let y = PAGE_H - 175;
  page.drawText(sanitize(ORG.name.replace("Ihsanku", "IhsanKu")), {
    x: MARGIN + 12,
    y,
    size: 14,
    font: bold,
    color: BLACK,
  });
  for (const text of [ISSUER_SITE, ISSUER_EMAIL, ISSUER_PHONE]) {
    y -= 16;
    page.drawText(text, { x: MARGIN + 12, y, size: 10, font, color: BLACK });
  }

  // LUNAS badge, outlined in red.
  const badge = "LUNAS";
  const badgeW = 86;
  const badgeH = 46;
  const badgeX = RIGHT - badgeW;
  const badgeY = PAGE_H - 175 - badgeH + 14;
  page.drawRectangle({
    x: badgeX,
    y: badgeY,
    width: badgeW,
    height: badgeH,
    borderColor: RED,
    borderWidth: 1.5,
    color: WHITE,
  });
  page.drawText(badge, {
    x: badgeX + (badgeW - bold.widthOfTextAtSize(badge, 14)) / 2,
    y: badgeY + (badgeH - 14) / 2 + 3,
    size: 14,
    font: bold,
    color: RED,
  });

  // ---- Payer -------------------------------------------------------------
  y -= 38;
  page.drawText("KEPADA :", { x: MARGIN + 12, y, size: 10, font: bold, color: BLACK });
  const payer: [string, string][] = [
    ["Nama", sanitize(donation.payer_name)],
    ["Emel", sanitize(donation.payer_email)],
    ["No. Telefon", donation.payer_phone ? sanitize(donation.payer_phone) : "-"],
  ];
  if (donation.negeri) payer.push(["Negeri", sanitize(donation.negeri)]);
  for (const [label, value] of payer) {
    y -= 17;
    page.drawText(label, { x: MARGIN + 12, y, size: 10, font: bold, color: BLACK });
    page.drawText(":", { x: MARGIN + 92, y, size: 10, font: bold, color: BLACK });
    page.drawText(value, { x: MARGIN + 102, y, size: 10, font, color: BLACK });
  }

  // ---- Table -------------------------------------------------------------
  y -= 36;
  const rows = rowsFor(donation);

  const drawHeader = (pg: PDFPage, top: number): number => {
    pg.drawRectangle({
      x: MARGIN,
      y: top - 30,
      width: TABLE_W,
      height: 30,
      color: BLACK,
    });
    const h = { size: 10, font: bold, color: WHITE };
    pg.drawText("Produk", { x: MARGIN + 10, y: top - 19, ...h });
    centeredText(pg, "Harga (RM)", COL_PRICE, COL_QTY, top - 19, h);
    centeredText(pg, "Kuantiti", COL_QTY, COL_SUB, top - 19, h);
    rightText(pg, "Subjumlah (RM)", RIGHT - 10, top - 19, h);
    return top - 30;
  };

  y = drawHeader(page, y);

  for (const row of rows) {
    if (y - ROW_H < FOOTER_TOP) {
      // Continue the table on a fresh page (a long lewat qada' list).
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = drawHeader(page, PAGE_H - 56);
    }
    y = drawRow(page, fonts, y, row);
  }

  if (y - ROW_H * 4 < FOOTER_TOP) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - 56;
  }

  // Jumlah (units) row.
  const totalQty = rows.reduce((n, r) => n + r.qty, 0);
  y = totalRow(page, fonts, y, "Jumlah", String(totalQty), money(donation.amount_sen));

  // Spacer row, then the grand total.
  box(page, MARGIN, y - 30, TABLE_W, 30);
  y -= 30;
  box(page, MARGIN, y - ROW_H, TABLE_W, ROW_H);
  box(page, COL_SUB, y - ROW_H, RIGHT - COL_SUB, ROW_H);
  rightText(page, "JUMLAH KESELURUHAN (RM)", COL_SUB - 10, y - 17, {
    size: 10,
    font: bold,
    color: BLACK,
  });
  rightText(page, money(donation.amount_sen), RIGHT - 10, y - 17, {
    size: 10,
    font: bold,
    color: BLACK,
  });
  y -= ROW_H;

  const via =
    donation.payment_method === "manual" ? "pindahan bank" : "CHIP (FPX/kad)";
  page.drawText("*", { x: MARGIN, y: y - 14, size: 14, font: bold, color: RED });
  page.drawText(
    sanitize(
      `Dibayar melalui ${via} pada ${receiptTime(paidAt)}, ${receiptDate(paidAt)}`
    ),
    { x: MARGIN + 8, y: y - 14, size: 10, font, color: BLACK }
  );
  if (donation.qada_breakdown && donation.qada_breakdown.length > 0) {
    page.drawText(
      sanitize(
        "Kuantiti = bilangan hari x gandaan (Ramadan yang telah bermula sejak tahun puasa ditinggalkan)."
      ),
      { x: MARGIN + 8, y: y - 30, size: 8.5, font, color: GREY }
    );
  }

  // ---- Footer (last page) ------------------------------------------------
  page.drawLine({
    start: { x: MARGIN, y: 72 },
    end: { x: RIGHT, y: 72 },
    thickness: 0.8,
    color: GREY,
    dashArray: [2, 2],
  });
  page.drawText("- Resit ini dijana dengan komputer dan tidak memerlukan tandatangan.", {
    x: MARGIN,
    y: 60,
    size: 8,
    font,
    color: GREY,
  });
  page.drawText(
    `- Jika anda mempunyai sebarang pertanyaan, anda boleh menghubungi kami melalui ${ISSUER_EMAIL} atau ${ISSUER_PHONE}`,
    { x: MARGIN, y: 48, size: 8, font, color: GREY }
  );
  const gen = `Dijana oleh bayarfidyahonline.com © ${new Date().getFullYear()}`;
  page.drawText(gen, {
    x: (PAGE_W - bold.widthOfTextAtSize(gen, 8.5)) / 2,
    y: 28,
    size: 8.5,
    font: bold,
    color: BLACK,
  });

  return pdf.save();
}

function metaLine(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  label: string,
  value: string
) {
  // Labels end at a fixed column so the values line up beneath each other.
  page.drawText(label, {
    x: RIGHT - 130 - fonts.bold.widthOfTextAtSize(label, 10),
    y,
    size: 10,
    font: fonts.bold,
    color: BLACK,
  });
  page.drawText(value, {
    x: RIGHT - fonts.font.widthOfTextAtSize(value, 10),
    y,
    size: 10,
    font: fonts.font,
    color: BLACK,
  });
}

function rightText(
  page: PDFPage,
  text: string,
  right: number,
  y: number,
  style: { size: number; font: PDFFont; color: ReturnType<typeof rgb> }
) {
  page.drawText(text, {
    x: right - style.font.widthOfTextAtSize(text, style.size),
    y,
    ...style,
  });
}

function centeredText(
  page: PDFPage,
  text: string,
  left: number,
  right: number,
  y: number,
  style: { size: number; font: PDFFont; color: ReturnType<typeof rgb> }
) {
  page.drawText(text, {
    x: left + (right - left - style.font.widthOfTextAtSize(text, style.size)) / 2,
    y,
    ...style,
  });
}

function box(page: PDFPage, x: number, y: number, w: number, h: number) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: BORDER,
    borderWidth: 0.8,
  });
}

/** One product row; truncates the label to fit its column. */
function drawRow(page: PDFPage, fonts: Fonts, y: number, row: TableRow): number {
  const top = y;
  box(page, MARGIN, top - ROW_H, COL_PRICE - MARGIN, ROW_H);
  box(page, COL_PRICE, top - ROW_H, COL_QTY - COL_PRICE, ROW_H);
  box(page, COL_QTY, top - ROW_H, COL_SUB - COL_QTY, ROW_H);
  box(page, COL_SUB, top - ROW_H, RIGHT - COL_SUB, ROW_H);

  let label = row.label;
  const maxW = COL_PRICE - MARGIN - 20;
  while (label.length > 4 && fonts.font.widthOfTextAtSize(label, 10) > maxW) {
    label = label.slice(0, -1);
  }
  if (label !== row.label) label = `${label.trimEnd()}...`;

  const style = { size: 10, font: fonts.font, color: BLACK };
  page.drawText(label, { x: MARGIN + 10, y: top - 17, ...style });
  const priceText = money(row.priceSen);
  page.drawText(priceText, {
    x: COL_PRICE + (COL_QTY - COL_PRICE - fonts.font.widthOfTextAtSize(priceText, 10)) / 2,
    y: top - 17,
    ...style,
  });
  const qtyText = String(row.qty);
  page.drawText(qtyText, {
    x: COL_QTY + (COL_SUB - COL_QTY - fonts.font.widthOfTextAtSize(qtyText, 10)) / 2,
    y: top - 17,
    ...style,
  });
  rightText(page, money(row.subtotalSen), RIGHT - 10, top - 17, style);
  return top - ROW_H;
}

function totalRow(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  label: string,
  qty: string,
  subtotal: string
): number {
  box(page, MARGIN, y - ROW_H, COL_QTY - MARGIN, ROW_H);
  box(page, COL_QTY, y - ROW_H, COL_SUB - COL_QTY, ROW_H);
  box(page, COL_SUB, y - ROW_H, RIGHT - COL_SUB, ROW_H);
  const style = { size: 10, font: fonts.bold, color: BLACK };
  rightText(page, label, COL_QTY - 12, y - 17, style);
  page.drawText(qty, {
    x: COL_QTY + (COL_SUB - COL_QTY - fonts.bold.widthOfTextAtSize(qty, 10)) / 2,
    y: y - 17,
    ...style,
  });
  rightText(page, subtotal, RIGHT - 10, y - 17, style);
  return y - ROW_H;
}
