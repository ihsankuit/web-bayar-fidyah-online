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

// Timestamps are stored in UTC (Postgres timestamptz). These format for a
// Malaysian audience, so pin the zone to Asia/Kuala_Lumpur (UTC+8) — otherwise
// the value renders in the runtime's zone, which is UTC on the server (Vercel),
// showing every time 8 hours early.
const MY_TZ = "Asia/Kuala_Lumpur";

export function formatDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("ms-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: MY_TZ,
  }).format(date);
}

export function formatDateOnly(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("ms-MY", {
    dateStyle: "long",
    timeZone: MY_TZ,
  }).format(date);
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
