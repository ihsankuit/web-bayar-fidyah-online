import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number of sen (integer) into a Malaysian Ringgit string. */
export function formatMYR(amountInSen: number): string {
  return new Intl.NumberFormat("ms-MY", {
    style: "currency",
    currency: "MYR",
  }).format(amountInSen / 100);
}

/** Format a Ringgit float value (not sen). */
export function formatRinggit(value: number): string {
  return new Intl.NumberFormat("ms-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

// Timestamps are stored in UTC (Postgres timestamptz). We render them for a
// Malaysian audience (UTC+8). Rather than pass timeZone:"Asia/Kuala_Lumpur"
// — which silently falls back to UTC on any runtime whose ICU build lacks the
// timezone database (a real Vercel/serverless gotcha, making every time show
// 8 hours early) — shift the instant by a fixed +8h and format the shifted
// value in UTC. Malaysia has no daylight saving, so +8 is always exact, and
// timeZone:"UTC" needs no ICU tz data at all.
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

function toMyt(input: string | Date): Date {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Date(date.getTime() + MY_OFFSET_MS);
}

export function formatDate(input: string | Date): string {
  return new Intl.DateTimeFormat("ms-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(toMyt(input));
}

export function formatDateOnly(input: string | Date): string {
  return new Intl.DateTimeFormat("ms-MY", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(toMyt(input));
}

/** Malay relative time, e.g. "3 minit lalu", "2 hari lalu". Floors to "Baru sahaja" under 1 minute. */
export function formatRelativeTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (diffSec < 60) return "Baru sahaja";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minit lalu`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} hari lalu`;

  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth} bulan lalu`;
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
