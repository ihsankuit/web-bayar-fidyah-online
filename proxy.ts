import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and the Billplz API
     * callbacks (which are authenticated by X-Signature, not a session).
     */
    "/((?!_next/static|_next/image|favicon.ico|api/billplz|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
