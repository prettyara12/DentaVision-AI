"use client";

import { useTransition } from "react";
import { switchLocale } from "@/features/preferences/actions";
import { t, type Locale } from "@/lib/i18n";

export function LanguageToggle({ lang }: { lang: Locale }) {
  const to: Locale = lang === "id" ? "en" : "id";
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      lang={to}
      aria-label={t(to, "nav.language")}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // Full page load on purpose: see switchLocale.
          location.assign(await switchLocale(to, location.pathname + location.search));
        })
      }
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm font-mono text-xs tracking-[0.06em] uppercase hover:text-accent disabled:opacity-50"
    >
      {to}
    </button>
  );
}
