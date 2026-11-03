import { isLocale, type Locale } from "@/lib/i18n";

/**
 * Where to go after signing in. Only same-site page paths under a locale prefix are allowed, so a
 * crafted `?next=` can never send the user to another origin (open redirect).
 */
export function safeNext(next: unknown, lang: Locale): string {
  const fallback = `/${lang}/scan`;
  if (typeof next !== "string" || !next.startsWith("/") || /^\/[/\\]/.test(next)) return fallback;
  let url: URL;
  try {
    url = new URL(next, "http://local");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://local") return fallback;
  return isLocale(url.pathname.split("/")[1]) ? url.pathname + url.search : fallback;
}

/** The locale a callback should speak, read from its `next` path. */
export function localeOf(next: unknown): Locale | null {
  const segment = typeof next === "string" ? next.split(/[/?#]/)[1] : undefined;
  return isLocale(segment) ? segment : null;
}
