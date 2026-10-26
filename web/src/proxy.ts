import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { locales, resolveLocale } from "@/lib/i18n";
import { hasAuthCookie } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));

  // Every page lives under /[lang]; send unprefixed paths to the preferred locale.
  // /auth/* (OAuth and email-link callbacks) keeps its fixed URL, registered with Supabase.
  if (!hasLocale && !pathname.startsWith("/auth/")) {
    const locale = resolveLocale(
      request.cookies.get("locale")?.value,
      request.headers.get("accept-language"),
    );
    request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  return refreshSession(request);
}

// Supabase access tokens are short-lived; refresh them here, where cookies can still be written,
// before Server Components read the session. Guests (no auth cookie) skip this entirely.
async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasAuthCookie(request.cookies.getAll().map((c) => c.name))) return response;

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();
  const supabase = createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Skip Next internals, Route Handlers, and files with an extension.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
