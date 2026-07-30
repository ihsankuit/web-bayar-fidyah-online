import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Record an admin action to `admin_activity_log` for the audit trail.
 * Fails soft — logging must never block the action it's recording.
 *
 * Pass `actor` explicitly for calls with no Supabase cookie session (e.g.
 * the API-key-authenticated REST endpoints) — those use the service role to
 * write, since there's no `authenticated` session for RLS to allow through.
 */
export async function logActivity(
  action: string,
  details: Record<string, unknown> = {},
  actor?: string
): Promise<void> {
  try {
    if (actor) {
      const admin = createAdminClient();
      await admin.from("admin_activity_log").insert({ actor, action, details });
      return;
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("admin_activity_log").insert({
      actor: user?.email ?? "unknown",
      action,
      details,
    });
  } catch (err) {
    console.error("[activity-log] failed to record:", err);
  }
}
