import { NextResponse, type NextRequest } from "next/server";
import { locales, resolveLocale } from "@/lib/i18n";

// Every page lives under /[lang]; send unprefixed paths to the preferred locale.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) return;

  const locale = resolveLocale(
    request.cookies.get("locale")?.value,
    request.headers.get("accept-language"),
  );
  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip Next internals, Route Handlers, and files with an extension.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
