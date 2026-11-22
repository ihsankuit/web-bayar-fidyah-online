import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Proof-of-payment files arriving over the REST API: what they are, how big,
 * and — for `proof_url` — whether the server may fetch them at all.
 *
 * `proof_url` makes this server issue a request on a caller's behalf, which is
 * the textbook SSRF shape: point it at an internal address and the response
 * (or the mere fact of a response) leaks something the caller could not reach.
 * So the URL is checked hard before any connection is made, and the fetch
 * itself is bounded in time, size and redirects.
 */

export const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5MB
export const PROOF_FETCH_TIMEOUT_MS = 15_000;

/** The only hosts `proof_url` may point at. Exact match, never a suffix. */
export const PROOF_URL_ALLOWED_HOSTS: readonly string[] = ["api.murpati.com"];

export type ProofKind = { mime: string; ext: string };

/**
 * Identify a file from its leading bytes. The declared Content-Type and the
 * file name are both caller-controlled, so neither is trusted: a script
 * renamed `receipt.jpg` is still a script.
 */
export function sniffProofType(bytes: Uint8Array): ProofKind | null {
  const startsWith = (sig: number[], offset = 0) =>
    bytes.length >= offset + sig.length &&
    sig.every((b, i) => bytes[offset + i] === b);

  if (startsWith([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", ext: "png" };
  }
  // WEBP: "RIFF" <4-byte size> "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: "image/webp", ext: "webp" };
  }
  // PDF: "%PDF-"
  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mime: "application/pdf", ext: "pdf" };
  }
  return null;
}

export type ProofUrlCheck =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

/**
 * Whether a `proof_url` is acceptable *as written*. No network: this is the
 * cheap, deterministic half of the SSRF defence (the resolved addresses are
 * checked separately by `assertPublicHost`).
 */
export function validateProofUrl(
  raw: string,
  allowedHosts: readonly string[] = PROOF_URL_ALLOWED_HOSTS
): ProofUrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "proof_url bukan URL yang sah." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "proof_url mesti menggunakan HTTPS." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "proof_url tidak boleh mengandungi kelayakan." };
  }
  if (url.port !== "" && url.port !== "443") {
    return { ok: false, reason: "proof_url mesti menggunakan port HTTPS lalai." };
  }

  // WHATWG URL already lowercases the host and strips IPv6 brackets' meaning;
  // drop a trailing dot so "api.murpati.com." cannot dodge the allowlist.
  const host = url.hostname.toLowerCase().replace(/\.$/, "");

  // An IP literal — v4, v6, or the many odd spellings the URL parser has
  // already normalised to dotted form — is never acceptable, allowlisted or
  // not: the allowlist is of names.
  if (isIP(host) !== 0 || host.startsWith("[") || /^[0-9.]+$/.test(host)) {
    return { ok: false, reason: "proof_url tidak boleh menggunakan alamat IP." };
  }
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return { ok: false, reason: "proof_url tidak boleh menuju alamat dalaman." };
  }

  if (!allowedHosts.includes(host)) {
    return { ok: false, reason: "Hos proof_url tidak dibenarkan." };
  }
  return { ok: true, url };
}

/** Whether an IP address is somewhere a public service must never be reached. */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateV4(ip);
  if (family === 6) {
    const lower = ip.toLowerCase();
    // ::ffff:a.b.c.d — an IPv4 address wearing an IPv6 coat.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateV4(mapped[1]);
    // ::ffff:7f00:1 spelled in hex groups.
    const hexMapped = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isPrivateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") || // fc00::/7 unique local
      lower.startsWith("fd") ||
      lower.startsWith("fe8") || // fe80::/10 link-local
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    );
  }
  return true; // not an IP at all: refuse
}

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    a >= 224 // multicast / reserved
  );
}

export type LookupFn = (
  host: string
) => Promise<{ address: string; family: number }[]>;

const defaultLookup: LookupFn = (host) => dnsLookup(host, { all: true });

/**
 * Resolve a host and refuse it if ANY address it maps to is private. The
 * allowlist already limits which names are acceptable; this is the second
 * lock, for the day an allowlisted name's DNS points somewhere it should not.
 *
 * Not airtight on its own: the HTTP client resolves again when it connects.
 * That gap is narrow because the name is allowlisted, redirects are refused,
 * and the request is bounded — but it is why the allowlist is the real wall.
 */
export async function assertPublicHost(
  host: string,
  lookup: LookupFn = defaultLookup
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host);
  } catch {
    return { ok: false, reason: "Hos proof_url tidak dapat diselesaikan." };
  }
  if (addresses.length === 0) {
    return { ok: false, reason: "Hos proof_url tidak dapat diselesaikan." };
  }
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    return { ok: false, reason: "proof_url menuju alamat dalaman." };
  }
  return { ok: true };
}

export type FetchProofResult =
  | { ok: true; bytes: Uint8Array }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
    };

export interface FetchProofOptions {
  fetchImpl?: typeof fetch;
  lookup?: LookupFn;
  allowedHosts?: readonly string[];
  timeoutMs?: number;
  maxBytes?: number;
}

/**
 * Download a proof from an allowlisted HTTPS URL, within 15 seconds and 5MB,
 * without following a single redirect (a redirect is how an allowlisted host
 * would hand the request to a host that is not).
 */
export async function fetchProofFromUrl(
  rawUrl: string,
  options: FetchProofOptions = {}
): Promise<FetchProofResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxBytes = options.maxBytes ?? MAX_PROOF_BYTES;

  const checked = validateProofUrl(rawUrl, options.allowedHosts);
  if (!checked.ok) {
    return {
      ok: false,
      status: 400,
      code: "PROOF_URL_NOT_ALLOWED",
      error: checked.reason,
    };
  }

  const host = checked.url.hostname.toLowerCase().replace(/\.$/, "");
  const resolved = await assertPublicHost(host, options.lookup);
  if (!resolved.ok) {
    return {
      ok: false,
      status: 400,
      code: "PROOF_URL_NOT_ALLOWED",
      error: resolved.reason,
    };
  }

  let res: Response;
  try {
    res = await fetchImpl(checked.url.toString(), {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? PROOF_FETCH_TIMEOUT_MS),
      headers: { Accept: "image/*,application/pdf" },
    });
  } catch (err) {
    const timedOut =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      code: timedOut ? "PROOF_URL_TIMEOUT" : "PROOF_URL_FETCH_FAILED",
      error: timedOut
        ? "Muat turun bukti melebihi 15 saat."
        : "Gagal memuat turun bukti daripada proof_url.",
    };
  }

  if (res.status >= 300 && res.status < 400) {
    return {
      ok: false,
      status: 502,
      code: "PROOF_URL_FETCH_FAILED",
      error: "proof_url mengalih ke alamat lain; ini tidak dibenarkan.",
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      status: 502,
      code: "PROOF_URL_FETCH_FAILED",
      error: `proof_url memulangkan HTTP ${res.status}.`,
    };
  }

  const tooLarge: FetchProofResult = {
    ok: false,
    status: 413,
    code: "FILE_TOO_LARGE",
    error: "Saiz fail melebihi had 5MB.",
  };

  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge;

  // Read as a stream and stop the moment the cap is crossed: Content-Length
  // is the sender's claim, not a guarantee, and must not decide how much
  // memory this function is willing to use.
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    if (!res.body) return tooLarge;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return tooLarge;
      }
      chunks.push(value);
    }
  } catch (err) {
    const timedOut =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      code: timedOut ? "PROOF_URL_TIMEOUT" : "PROOF_URL_FETCH_FAILED",
      error: timedOut
        ? "Muat turun bukti melebihi 15 saat."
        : "Gagal memuat turun bukti daripada proof_url.",
    };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return { ok: true, bytes };
}
