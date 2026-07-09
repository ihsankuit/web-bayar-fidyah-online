import { createClient } from "@/lib/supabase/server";

/**
 * Record an admin action to `admin_activity_log` for the audit trail.
 * Fails soft — logging must never block the action it's recording.
 */
export async function logActivity(
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
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
