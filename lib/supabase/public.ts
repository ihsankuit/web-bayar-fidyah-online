import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Anonymous Supabase client for public, unauthenticated reads (landing
 * settings, gallery, published blog posts). Unlike `lib/supabase/server.ts`,
 * this never touches cookies — reading cookies is a Next.js "dynamic API"
 * that forces the whole route to render on every request, bypassing
 * `export const revalidate`. Public pages don't need per-visitor session
 * awareness, so this client lets them stay statically cached/ISR'd instead.
 *
 * RLS still applies (anon role) — this only skips the cookie-bound session,
 * not security.
 */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
