"use server";

import { cookies } from "next/headers";
import { safeNext } from "@/features/auth/next-path";
import { isLocale, withLocale } from "@/lib/i18n";
import { createClient, currentUser } from "@/lib/supabase/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Language toggle (PRD US-13): remembers the choice in the `locale` cookie that src/proxy.ts
 * reads, and in the profile when signed in, then returns the same page under the other prefix.
 * The caller navigates with a full page load: /[lang] is the root layout, and a client-side
 * switch between locales leaves <html> without its lang, font, and theme attributes.
 */
export async function switchLocale(lang: unknown, next: unknown): Promise<string> {
  const to = isLocale(lang) ? lang : "id";

  (await cookies()).set("locale", to, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: true,
  });

  const user = await currentUser();
  if (user) {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ locale: to }).eq("id", user.id);
    // The cookie already carries the choice; a failed profile write must not block the switch.
    if (error) console.error("switchLocale: profile update failed", error.message);
  }

  // safeNext keeps only same-site, locale-prefixed paths, so `next` cannot lead off-site.
  return withLocale(safeNext(next, to), to);
}
