import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { needsMfaChallenge } from "@/lib/supabase/mfa";

/**
 * Refreshes the Supabase auth session on every request and guards the /admin
 * area. Unauthenticated visits to /admin (except the login page) are
 * redirected to /admin/login. Signed-in visits that still owe a TOTP
 * challenge (a verified factor exists but this session is only aal1) are
 * redirected to /admin/mfa.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured yet, don't block the site.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminArea = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/admin/login";
  const isMfaPage = pathname === "/admin/mfa";

  if (isAdminArea && !isLoginPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAdminArea) {
    const needsMfa = await needsMfaChallenge(supabase);

    if (needsMfa && !isMfaPage && !isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/mfa";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    if (!needsMfa && isMfaPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = needsMfa ? "/admin/mfa" : "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
