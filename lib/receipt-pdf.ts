import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Donation } from "@/lib/database.types";
import { receiptChannelLabel } from "@/lib/payment-methods";
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

const BRAND = rgb(0.145, 0.388, 0.921); // the site's primary blue
const BRAND_SOFT = rgb(0.937, 0.961, 1);
const PAID = rgb(0.086, 0.639, 0.29);
const INK = rgb(0.102, 0.137, 0.2);
const MUTED = rgb(0.4, 0.44, 0.52);
const HAIRLINE = rgb(0.87, 0.89, 0.93);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 595.28; // A4 portrait, in points
const PAGE_H = 841.89;
const MARGIN = 40;
const RIGHT = PAGE_W - MARGIN;
const CONTENT_W = RIGHT - MARGIN;
const ROW_H = 26;
const FOOTER_TOP = 96; // nothing in the table may be drawn below this

// Issuer details as they should appear on a receipt.
const ISSUER_SITE = "www.ihsanku.org";
const ISSUER_EMAIL = "salam@ihsanku.org";
const ISSUER_PHONE = "+601113190312";

// Table column right edges (numbers are right-aligned to these).
const COL_RATE = RIGHT - 160;
const COL_QTY = RIGHT - 84;
const COL_TOTAL = RIGHT - 12;

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
  return (sen / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

  const newPage = (): PDFPage => {
    const pg = pdf.addPage([PAGE_W, PAGE_H]);
    pg.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W, height: 8, color: BRAND });
    return pg;
  };
  let page = newPage();
  const paidAt = donation.paid_at ?? donation.created_at;

  // ---- Header ------------------------------------------------------------
  const logoW = 108;
  const logoH = logoW / RECEIPT_LOGO_ASPECT;
  page.drawImage(logo, { x: MARGIN, y: PAGE_H - 36 - logoH, width: logoW, height: logoH });

  rightText(page, "RESIT PEMBAYARAN FIDYAH", RIGHT, PAGE_H - 44, {
    size: 8.5,
    font: bold,
    color: BRAND,
  });
  rightText(page, sanitize(donation.reference), RIGHT, PAGE_H - 64, {
    size: 17,
    font: bold,
    color: INK,
  });

  // ---- Summary card: amount, status, when and how ------------------------
  let y = PAGE_H - 112;
  const cardH = 84;
  roundedRect(page, MARGIN, y, CONTENT_W, cardH, 10, { fill: BRAND_SOFT });
  page.drawText("Jumlah dibayar", {
    x: MARGIN + 22,
    y: y - 28,
    size: 9.5,
    font,
    color: MUTED,
  });
  page.drawText(`RM ${money(donation.amount_sen)}`, {
    x: MARGIN + 22,
    y: y - 62,
    size: 27,
    font: bold,
    color: BRAND,
  });

  const pill = "LUNAS";
  const pillW = bold.widthOfTextAtSize(pill, 10) + 26;
  roundedRect(page, RIGHT - 22 - pillW, y - 16, pillW, 22, 11, { fill: PAID });
  page.drawText(pill, {
    x: RIGHT - 22 - pillW + 13,
    y: y - 31,
    size: 10,
    font: bold,
    color: WHITE,
  });
  const via = receiptChannelLabel(donation.payment_method);
  rightText(page, `${receiptDate(paidAt)}, ${receiptTime(paidAt)}`, RIGHT - 22, y - 52, {
    size: 9.5,
    font: bold,
    color: INK,
  });
  rightText(page, via, RIGHT - 22, y - 67, { size: 9, font, color: MUTED });

  // ---- Payer and issuer cards --------------------------------------------
  y -= cardH + 18;
  const gap = 14;
  const colW = (CONTENT_W - gap) / 2;
  const infoH = 104;
  roundedRect(page, MARGIN, y, colW, infoH, 8, { stroke: HAIRLINE });
  roundedRect(page, MARGIN + colW + gap, y, colW, infoH, 8, { stroke: HAIRLINE });

  const payerLines = [
    sanitize(donation.payer_email),
    donation.payer_phone ? sanitize(donation.payer_phone) : "",
    donation.negeri ? sanitize(donation.negeri) : "",
  ].filter(Boolean);
  infoCard(page, fonts, MARGIN + 16, y, "DIBAYAR OLEH", sanitize(donation.payer_name), payerLines);
  infoCard(
    page,
    fonts,
    MARGIN + colW + gap + 16,
    y,
    "DIKELUARKAN OLEH",
    sanitize(ORG.name.replace("Ihsanku", "IhsanKu")),
    [ISSUER_SITE, ISSUER_EMAIL, ISSUER_PHONE, `ROS ${ORG.rosNumber}`]
  );

  // ---- Items table -------------------------------------------------------
  y -= infoH + 28;
  page.drawText("Butiran pembayaran", { x: MARGIN, y, size: 11, font: bold, color: INK });
  y -= 12;

  const drawHeader = (pg: PDFPage, top: number): number => {
    roundedRect(pg, MARGIN, top, CONTENT_W, 26, 6, { fill: BRAND_SOFT });
    const h = { size: 8.5, font: bold, color: BRAND };
    pg.drawText("PERKARA", { x: MARGIN + 12, y: top - 17, ...h });
    rightText(pg, "KADAR (RM)", COL_RATE, top - 17, h);
    rightText(pg, "KUANTITI", COL_QTY, top - 17, h);
    rightText(pg, "JUMLAH (RM)", COL_TOTAL, top - 17, h);
    return top - 26;
  };

  y = drawHeader(page, y);
  const rows = rowsFor(donation);
  for (const row of rows) {
    if (y - ROW_H < FOOTER_TOP) {
      // Continue the table on a fresh page (a long lewat qada' list).
      page = newPage();
      y = drawHeader(page, PAGE_H - 44);
    }
    y = drawRow(page, fonts, y, row);
  }

  // The payer's own note. The working that older lewat qada' payments carry
  // at the top of their message is left out: the table already shows it.
  const noteText = (donation.message ?? "")
    .split("\n")
    .filter((l) => !l.startsWith("Lewat qada'"))
    .join("\n")
    .trim();
  const noteLines = noteText
    ? wrapText(sanitize(noteText), font, 10, CONTENT_W - 32).slice(0, 10)
    : [];
  const noteH = noteLines.length ? 38 + noteLines.length * 13 : 0;

  // Room for the total bar, note and prayer; otherwise they start a new page.
  if (y - 120 - noteH < FOOTER_TOP) {
    page = newPage();
    y = PAGE_H - 44;
  }

  // ---- Total bar ---------------------------------------------------------
  y -= 18;
  const barW = 250;
  roundedRect(page, RIGHT - barW, y, barW, 34, 8, { fill: BRAND });
  page.drawText("JUMLAH DIBAYAR", {
    x: RIGHT - barW + 16,
    y: y - 21,
    size: 9,
    font: bold,
    color: WHITE,
  });
  rightText(page, `RM ${money(donation.amount_sen)}`, RIGHT - 16, y - 22, {
    size: 14,
    font: bold,
    color: WHITE,
  });
  y -= 34;

  if (donation.qada_breakdown && donation.qada_breakdown.length > 0) {
    const waived = donation.qada_breakdown.some((r) => r.waived_multiplier);
    page.drawText(
      waived
        ? "Dikira bayaran asas sahaja, tanpa gandaan, atas permohonan pembayar."
        : "Kuantiti = bilangan hari x gandaan, iaitu bilangan Ramadan yang telah bermula sejak tahun puasa ditinggalkan.",
      { x: MARGIN, y: y - 22, size: 8, font, color: MUTED }
    );
    y -= 14;
  }
  if (noteLines.length > 0) {
    y -= 22;
    roundedRect(page, MARGIN, y, CONTENT_W, noteH - 6, 8, { stroke: HAIRLINE });
    page.drawText("CATATAN", { x: MARGIN + 16, y: y - 20, size: 7.5, font: bold, color: BRAND });
    let ny = y - 36;
    for (const line of noteLines) {
      page.drawText(line, { x: MARGIN + 16, y: ny, size: 10, font, color: INK });
      ny -= 13;
    }
    y -= noteH - 6;
  }
  page.drawText(
    "Semoga Allah SWT menerima amalan anda dan memberi ganjaran berlipat ganda. Aamiin.",
    { x: MARGIN, y: y - 28, size: 9, font: bold, color: INK }
  );

  // ---- Footer (last page) ------------------------------------------------
  page.drawLine({
    start: { x: MARGIN, y: 70 },
    end: { x: RIGHT, y: 70 },
    thickness: 0.8,
    color: HAIRLINE,
  });
  page.drawText("Resit ini dijana dengan komputer dan tidak memerlukan tandatangan.", {
    x: MARGIN,
    y: 55,
    size: 8,
    font,
    color: MUTED,
  });
  page.drawText(
    `Pertanyaan: ${ISSUER_EMAIL} atau ${ISSUER_PHONE}`,
    { x: MARGIN, y: 43, size: 8, font, color: MUTED }
  );
  rightText(page, "bayarfidyahonline.com", RIGHT, 55, { size: 8.5, font: bold, color: BRAND });
  rightText(page, `\u00A9 ${new Date().getFullYear()}`, RIGHT, 43, {
    size: 8,
    font,
    color: MUTED,
  });

  return pdf.save();
}

/** Breaks text into lines no wider than maxW, keeping the payer's own line breaks. */
function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let w = word;
      // A single word longer than the line (a long URL) is cut to fit.
      while (font.widthOfTextAtSize(w, size) > maxW) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxW) cut--;
        if (current) {
          lines.push(current);
          current = "";
        }
        lines.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const next = current ? `${current} ${w}` : w;
      if (current && font.widthOfTextAtSize(next, size) > maxW) {
        lines.push(current);
        current = w;
      } else {
        current = next;
      }
    }
    lines.push(current);
  }
  return lines;
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

/** A rounded rectangle whose top-left corner is (x, top). */
function roundedRect(
  page: PDFPage,
  x: number,
  top: number,
  w: number,
  h: number,
  r: number,
  style: { fill?: ReturnType<typeof rgb>; stroke?: ReturnType<typeof rgb> }
) {
  const path =
    `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} ` +
    `A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} ` +
    `V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(path, {
    x,
    y: top,
    color: style.fill,
    borderColor: style.stroke,
    borderWidth: style.stroke ? 1 : 0,
  });
}

function infoCard(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  top: number,
  label: string,
  title: string,
  lines: string[]
) {
  page.drawText(label, { x, y: top - 20, size: 7.5, font: fonts.bold, color: BRAND });
  page.drawText(title.length > 34 ? `${title.slice(0, 33)}...` : title, {
    x,
    y: top - 38,
    size: 11,
    font: fonts.bold,
    color: INK,
  });
  let ly = top - 54;
  for (const line of lines) {
    page.drawText(line.length > 44 ? `${line.slice(0, 43)}...` : line, {
      x,
      y: ly,
      size: 8.5,
      font: fonts.font,
      color: MUTED,
    });
    ly -= 12;
  }
}

/** One product row, separated by a hairline; the label is truncated to fit. */
function drawRow(page: PDFPage, fonts: Fonts, y: number, row: TableRow): number {
  let label = row.label;
  const maxW = COL_RATE - 70 - (MARGIN + 12);
  while (label.length > 4 && fonts.font.widthOfTextAtSize(label, 9.5) > maxW) {
    label = label.slice(0, -1);
  }
  if (label !== row.label) label = `${label.trimEnd()}...`;

  const style = { size: 9.5, font: fonts.font, color: INK };
  const base = y - 17;
  page.drawText(label, { x: MARGIN + 12, y: base, ...style });
  rightText(page, money(row.priceSen), COL_RATE, base, { ...style, color: MUTED });
  rightText(page, String(row.qty), COL_QTY, base, { ...style, color: MUTED });
  rightText(page, money(row.subtotalSen), COL_TOTAL, base, { ...style, font: fonts.bold });
  page.drawLine({
    start: { x: MARGIN, y: y - ROW_H },
    end: { x: RIGHT, y: y - ROW_H },
    thickness: 0.6,
    color: HAIRLINE,
  });
  return y - ROW_H;
}
