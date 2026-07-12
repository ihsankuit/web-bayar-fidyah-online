import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook + REST API config. Managed from the admin panel (stored in the
 * admin-only `integration_settings` table) and read server-side via the
 * service role. Falls back to environment variables when the row/table is
 * absent, so existing env-based setups keep working.
 *
 * IMPORTANT: never read this from a browser/anon context — it contains secrets.
 */
export interface IntegrationSettings {
  n8n_webhook_url: string;
  webhook_signing_secret: string;
  api_key: string;
}

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  const fallback: IntegrationSettings = {
    n8n_webhook_url: process.env.N8N_WEBHOOK_URL ?? "",
    webhook_signing_secret: process.env.WEBHOOK_SIGNING_SECRET ?? "",
    api_key: process.env.API_KEY ?? "",
  };

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("integration_settings")
      .select("n8n_webhook_url, webhook_signing_secret, api_key")
      .eq("id", 1)
      .maybeSingle();

    if (data) {
      return {
        n8n_webhook_url: data.n8n_webhook_url || fallback.n8n_webhook_url,
        webhook_signing_secret:
          data.webhook_signing_secret || fallback.webhook_signing_secret,
        api_key: data.api_key || fallback.api_key,
      };
    }
  } catch {
    // service role not configured / table missing — use env fallback.
  }
  return fallback;
}
