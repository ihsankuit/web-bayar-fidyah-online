import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when the session has a verified MFA factor enrolled but the current
 * session hasn't completed the aal2 challenge yet (e.g. a fresh password
 * sign-in on a device that hasn't entered the TOTP code this session).
 */
export async function needsMfaChallenge(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!data) return false;
  return data.nextLevel === "aal2" && data.currentLevel !== data.nextLevel;
}
