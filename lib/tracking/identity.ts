/**
 * Normalising payer details into the shapes Meta's Conversions API matches
 * against.
 *
 * Meta hashes these and compares them to what it holds for its own users, so
 * the formatting is not cosmetic: a number stored as "012-345 6789" and the
 * same number stored by Meta as "60123456789" hash to different values and
 * simply never match. Every parameter that fails to match drags the Event
 * Match Quality score down, which is what Meta is reporting when it suggests
 * sending more customer information.
 *
 * These helpers return null rather than a best guess. Sending a wrong value
 * is worse than sending nothing — it counts as a failed match, where an
 * omitted field is merely absent.
 */

/**
 * A phone number as E.164 digits with no plus sign, which is what Meta and
 * Google both expect.
 *
 * Malaysian payers type their number every which way — "0123456789",
 * "012-345 6789", "+60 12 345 6789". A leading zero is the local trunk
 * prefix and is replaced by the country code, not kept.
 */
export function normalizePhoneForMatching(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  let normalized: string;
  if (digits.startsWith("60")) {
    normalized = digits;
  } else if (digits.startsWith("0")) {
    normalized = "60" + digits.slice(1);
  } else if (digits.length >= 10) {
    // Long enough to already carry some other country's code — an overseas
    // payer settling fidyah for a relative. Leave it alone.
    normalized = digits;
  } else {
    normalized = "60" + digits;
  }

  // Shorter than any real country code + subscriber number, or longer than
  // E.164 allows, means we misread it. Say nothing rather than guess.
  if (normalized.length < 10 || normalized.length > 15) return null;
  return normalized;
}

/** Lowercase letters only — how Meta wants names, cities and regions. */
function lettersOnly(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A full name split into the first and last name Meta asks for.
 *
 * Malay names carry particles — "Ahmad bin Abdullah", "Siti binti Tarudin" —
 * so the last token is the closest thing to a surname, and the first token
 * is the given name. Anything in between is dropped, which is what Meta
 * expects for a two-field match.
 */
export function splitNameForMatching(
  raw: string | null | undefined
): { first: string | null; last: string | null } {
  if (!raw) return { first: null, last: null };
  const parts = lettersOnly(raw).split(" ").filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts[parts.length - 1] };
}

/** A Malaysian state as Meta wants a region: lowercase, letters only. */
export function normalizeRegionForMatching(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  // "W.P. Kuala Lumpur" -> "wp kuala lumpur"
  const cleaned = lettersOnly(raw).replace(/\s/g, "");
  return cleaned || null;
}

/**
 * The stable per-person key for external_id.
 *
 * Mirrors how the admin payer profiles group people — by phone, falling back
 * to email — so the identifier Meta sees is the same one the business itself
 * treats as "this payer", and stays constant across their donations.
 */
export function externalIdFor(
  phone: string | null | undefined,
  email: string | null | undefined
): string | null {
  const normalizedPhone = normalizePhoneForMatching(phone);
  if (normalizedPhone) return normalizedPhone;
  const trimmed = email?.trim().toLowerCase();
  return trimmed || null;
}

/** ISO 3166-1 alpha-2, lowercase, as Meta wants it. */
export const MATCH_COUNTRY = "my";
