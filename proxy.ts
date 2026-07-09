import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Only /admin needs session awareness (auth guard + login redirect). Public
  // pages don't, so scoping the matcher here avoids a Supabase Auth network
  // round-trip on every public page view.
  matcher: ["/admin/:path*"],
};
