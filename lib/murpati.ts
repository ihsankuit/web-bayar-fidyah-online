import { createAdminClient } from "@/lib/supabase/admin";

/**
 * WhatsApp notifications for fidyah distribution updates, sent via the
 * Murpati API (https://murpati.com). Credentials are managed from
 * Admin > Integrasi (stored in `integration_settings`) and fall back to
 * environment variables so an env-based setup keeps working.
 */

const MURPATI_BASE_URL = "https://api.murpati.com/v1";
const MURPATI_TIMEOUT_MS = 10_000;

export interface MurpatiSettings {
  apiKey: string;
  sessionId: string;
}

export async function getMurpatiSettings(): Promise<MurpatiSettings> {
  const fallback: MurpatiSettings = {
    apiKey: process.env.MURPATI_API_KEY ?? "",
    sessionId: process.env.MURPATI_SESSION_ID ?? "",
  };

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("integration_settings")
      .select("murpati_api_key, murpati_session_id")
      .eq("id", 1)
      .maybeSingle();

    if (data) {
      return {
        apiKey: data.murpati_api_key || fallback.apiKey,
        sessionId: data.murpati_session_id || fallback.sessionId,
      };
    }
  } catch {
    // service role/table unavailable — use env fallback.
  }
  return fallback;
}

/**
 * Normalizes a Malaysian phone number (as entered by a payer, e.g.
 * "012-345 6789" or "60123456789") to the plain-digits "60xxxxxxxxx" form
 * Murpati's `to` field expects. Returns null if it doesn't look valid.
 */
export function normalizeMalaysianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith("60")) {
    // already has the country code
  } else if (normalized.startsWith("0")) {
    normalized = "60" + normalized.slice(1);
  } else {
    normalized = "60" + normalized;
  }

  // Malaysian mobile numbers: 60 + 9-10 digits.
  if (normalized.length < 11 || normalized.length > 12) return null;
  return normalized;
}

async function murpatiFetch(
  path: string,
  apiKey: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${MURPATI_BASE_URL}${path}`, {
    ...init,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(MURPATI_TIMEOUT_MS),
  });
}

/**
 * Fast, read-only status check — deliberately does NOT call the reconnect
 * endpoint, which can block for up to 30s and isn't a fit for a
 * request/response admin action.
 */
export async function isMurpatiSessionConnected(
  settings: MurpatiSettings
): Promise<boolean> {
  try {
    const res = await murpatiFetch(
      `/sessions/${settings.sessionId}/status`,
      settings.apiKey
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "connected";
  } catch {
    return false;
  }
}

export interface MurpatiSendResult {
  ok: boolean;
  error?: string;
}

/** Sends a text-only WhatsApp message. */
export async function sendMurpatiText(
  settings: MurpatiSettings,
  to: string,
  message: string
): Promise<MurpatiSendResult> {
  try {
    const res = await murpatiFetch("/messages/send", settings.apiKey, {
      method: "POST",
      body: JSON.stringify({ session_id: settings.sessionId, to, message }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ralat tidak diketahui",
    };
  }
}

/** Sends an image with a caption. */
export async function sendMurpatiMedia(
  settings: MurpatiSettings,
  to: string,
  mediaUrl: string,
  caption: string
): Promise<MurpatiSendResult> {
  try {
    const res = await murpatiFetch("/messages/send-media", settings.apiKey, {
      method: "POST",
      body: JSON.stringify({
        session_id: settings.sessionId,
        to,
        media_url: mediaUrl,
        caption,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ralat tidak diketahui",
    };
  }
}
