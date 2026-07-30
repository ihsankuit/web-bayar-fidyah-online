import { createAdminClient } from "@/lib/supabase/admin";

/**
 * WhatsApp blast config (Murpati REST API — https://murpati.com). Managed
 * from Admin > Integrasi (stored in the shared `integration_settings` row)
 * with an env-var fallback so existing env-based setups keep working.
 *
 * IMPORTANT: never read this from a browser/anon context — it contains a
 * secret API key.
 */
export interface MurpatiSettings {
  apiKey: string;
  sessionId: string;
}

const API_BASE = "https://api.murpati.com/v1";

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
    // service role not configured / table missing — use env fallback.
  }
  return fallback;
}

/**
 * Normalize a phone number to the digits-only "60xxxxxxxxx" format Murpati
 * expects. Handles local Malaysian formats (leading 0, +60, spaces/dashes).
 * Returns null if the input doesn't look like a usable phone number.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("60") && digits.length >= 10) return digits;
  if (digits.startsWith("0") && digits.length >= 9) return `60${digits.slice(1)}`;
  if (digits.length >= 9 && digits.length <= 11) return `60${digits}`;
  return null;
}

export interface MurpatiResult {
  ok: boolean;
  error?: string;
}

/** Send a single WhatsApp text message via Murpati. Never throws. */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<MurpatiResult> {
  const { apiKey, sessionId } = await getMurpatiSettings();
  if (!apiKey || !sessionId) {
    return { ok: false, error: "Murpati belum dikonfigurasi." };
  }

  try {
    const res = await fetch(`${API_BASE}/messages/send`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: sessionId, to, message }),
      cache: "no-store",
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false) {
      return { ok: false, error: body?.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ralat rangkaian",
    };
  }
}

/** Send an image/PDF/etc via Murpati, with the message as caption. Never throws. */
export async function sendWhatsAppMedia(
  to: string,
  mediaUrl: string,
  caption: string
): Promise<MurpatiResult> {
  const { apiKey, sessionId } = await getMurpatiSettings();
  if (!apiKey || !sessionId) {
    return { ok: false, error: "Murpati belum dikonfigurasi." };
  }

  try {
    const res = await fetch(`${API_BASE}/messages/send-media`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: sessionId, to, media_url: mediaUrl, caption }),
      cache: "no-store",
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false) {
      return { ok: false, error: body?.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ralat rangkaian",
    };
  }
}

export interface MurpatiSessionInfo {
  connected: boolean;
  status?: string;
  phoneNumber?: string;
  deviceName?: string;
  error?: string;
}

/** Live status of the configured device — used for the WhatsApp page's
 * "Active Session" summary and the Integrasi "test" button. */
export async function getMurpatiSessionInfo(): Promise<MurpatiSessionInfo> {
  const { apiKey, sessionId } = await getMurpatiSettings();
  if (!apiKey || !sessionId) {
    return { connected: false, error: "Murpati belum dikonfigurasi." };
  }

  try {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/status`, {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false) {
      return { connected: false, error: body?.error || `HTTP ${res.status}` };
    }
    return {
      connected: body.status === "connected",
      status: body.status,
      phoneNumber: body.phone_number,
      deviceName: body.device_name,
    };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : "Ralat rangkaian",
    };
  }
}

/** Check the configured device's connection status (Integrasi "test" button). */
export async function checkMurpatiSession(): Promise<MurpatiResult> {
  const info = await getMurpatiSessionInfo();
  if (!info.connected) {
    return {
      ok: false,
      error: info.error ?? `Peranti belum bersambung (status: ${info.status}).`,
    };
  }
  return { ok: true };
}
