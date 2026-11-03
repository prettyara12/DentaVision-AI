import { NextResponse, type NextRequest } from "next/server";
import { localeOf, safeNext } from "@/features/auth/next-path";
import { resolveLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point of Google sign-in, the email-verification link, and the password-reset link
 * (PKCE: Supabase sends `?code=`, which is swapped for a session cookie here).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next");
  const lang =
    localeOf(next) ??
    resolveLocale(request.cookies.get("locale")?.value, request.headers.get("accept-language"));
  const code = searchParams.get("code");

  if (code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext(next, lang), origin));
  }
  // Expired or reused link, cancelled Google consent, or a link opened in another browser.
  return NextResponse.redirect(new URL(`/${lang}/login?error=link`, origin));
}
