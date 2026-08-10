import { normalizeMalaysianPhone } from "@/lib/murpati";

/**
 * Parsing for contacts pasted or uploaded (CSV) into the agihan blast, for
 * recipients who aren't in the donation records — e.g. a list handed over by
 * a partner masjid.
 */

export interface ParsedContact {
  name: string;
  phone: string;
}

export interface ParseContactsResult {
  contacts: ParsedContact[];
  /** 1-indexed input lines that had no usable Malaysian phone number. */
  skipped: number[];
  duplicates: number;
}

/** True when a row looks like a CSV header rather than real data. */
function isHeaderRow(cells: string[]): boolean {
  const joined = cells.join(",").toLowerCase();
  return /\b(nama|name|telefon|phone|no\.?\s*tel|nombor)\b/.test(joined);
}

/**
 * Accepts one contact per line, name and phone separated by a comma, tab or
 * semicolon — the shapes a spreadsheet export or a hand-typed list actually
 * arrive in. A line with only a number is accepted too. Order is detected per
 * row (some lists put the phone first), and a leading header row is skipped.
 *
 * Numbers that aren't valid Malaysian mobiles are reported back rather than
 * silently dropped, so the admin can see what didn't make it.
 */
export function parseContacts(raw: string): ParseContactsResult {
  const contacts: ParsedContact[] = [];
  const skipped: number[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  const lines = raw.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const cells = trimmed
      .split(/[,;\t]/)
      .map((c) => c.trim().replace(/^["']|["']$/g, ""));

    if (index === 0 && isHeaderRow(cells)) return;

    // Whichever cell normalizes to a valid phone is the phone; the longest
    // remaining cell is the name.
    let phone: string | null = null;
    let phoneIdx = -1;
    for (let i = 0; i < cells.length; i++) {
      const candidate = normalizeMalaysianPhone(cells[i]);
      if (candidate) {
        phone = candidate;
        phoneIdx = i;
        break;
      }
    }

    if (!phone) {
      skipped.push(index + 1);
      return;
    }

    if (seen.has(phone)) {
      duplicates++;
      return;
    }
    seen.add(phone);

    const name =
      cells
        .filter((_, i) => i !== phoneIdx)
        .map((c) => c.trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0] ?? "";

    contacts.push({ name, phone });
  });

  return { contacts, skipped, duplicates };
}
