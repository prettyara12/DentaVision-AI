import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/features/auth/actions";
import { t, type Locale } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";
import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({ lang }: { lang: Locale }) {
  return (
    <header className="border-b border-rule bg-bg text-ink">
      <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center justify-between gap-2 px-4">
        <Link href={`/${lang}`} className="shrink-0 font-semibold tracking-[-0.01em]">
          DentaVision AI
        </Link>
        <div className="flex min-w-0 items-center gap-1 sm:gap-3">
          <LanguageToggle lang={lang} />
          <ThemeToggle lang={lang} />
          {/* The session lives in cookies, known only at request time. */}
          <Suspense>
            <Account lang={lang} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

const linkClass =
  "inline-flex min-h-11 items-center text-sm font-medium text-ink hover:text-accent";

async function Account({ lang }: { lang: Locale }) {
  const user = await currentUser();
  if (!user) {
    return (
      <Link
        href={`/${lang}/login`}
        className="inline-flex min-h-11 items-center pl-1 text-sm font-medium text-accent hover:underline"
      >
        {t(lang, "nav.login")}
      </Link>
    );
  }

  const links = (
    <>
      <Link href={`/${lang}/history`} className={linkClass}>
        {t(lang, "nav.history")}
      </Link>
      <Link href={`/${lang}/settings`} className={linkClass}>
        {t(lang, "nav.settings")}
      </Link>
    </>
  );
  const logout = (
    <form action={signOut} className="flex min-w-0 items-center gap-3">
      <input type="hidden" name="lang" value={lang} />
      <span className="hidden truncate text-sm text-ink-2 lg:inline">{user.email}</span>
      <button
        type="submit"
        className="min-h-11 shrink-0 rounded-sm border border-rule px-4 text-sm font-medium hover:bg-surface"
      >
        {t(lang, "nav.logout")}
      </button>
    </form>
  );

  return (
    <>
      <div className="hidden min-w-0 items-center gap-4 sm:flex">
        <nav aria-label={t(lang, "nav.label")} className="flex items-center gap-3">
          {links}
        </nav>
        {logout}
      </div>
      {/* Under 640 px the account links fold into a menu (design-system §6). */}
      <details className="group relative sm:hidden">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-sm border border-rule px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {t(lang, "nav.menu")}
        </summary>
        <div className="absolute right-0 z-20 mt-2 flex w-56 flex-col gap-1 rounded-md border border-rule bg-surface p-3 shadow-[0_16px_32px_-20px_rgb(0_0_0/.45)]">
          <p className="truncate pb-1 text-xs text-ink-2">{user.email}</p>
          <nav aria-label={t(lang, "nav.label")} className="flex flex-col">
            {links}
          </nav>
          {logout}
        </div>
      </details>
    </>
  );
}
