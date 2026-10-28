import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/features/auth/actions";
import { t, type Locale } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export function SiteHeader({ lang }: { lang: Locale }) {
  return (
    <header className="border-b border-rule bg-bg text-ink">
      <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center justify-between gap-4 px-4">
        <Link href={`/${lang}`} className="font-semibold tracking-[-0.01em]">
          DentaVision AI
        </Link>
        {/* The session lives in cookies, known only at request time. */}
        <Suspense>
          <Account lang={lang} />
        </Suspense>
      </div>
    </header>
  );
}

async function Account({ lang }: { lang: Locale }) {
  const user = await currentUser();
  if (!user) {
    return (
      <Link
        href={`/${lang}/login`}
        className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline"
      >
        {t(lang, "nav.login")}
      </Link>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-4">
      <nav aria-label="Main" className="flex items-center gap-3 text-sm font-medium">
        <Link
          href={`/${lang}/history`}
          className="inline-flex min-h-11 items-center text-ink hover:text-accent"
        >
          {t(lang, "nav.history")}
        </Link>
        <Link
          href={`/${lang}/settings`}
          className="inline-flex min-h-11 items-center text-ink hover:text-accent"
        >
          {t(lang, "nav.settings")}
        </Link>
      </nav>
      <form action={signOut} className="flex min-w-0 items-center gap-3">
        <input type="hidden" name="lang" value={lang} />
        <span className="hidden truncate text-sm text-ink-2 sm:inline">{user.email}</span>
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-sm border border-rule px-4 text-sm font-medium hover:bg-surface"
        >
          {t(lang, "nav.logout")}
        </button>
      </form>
    </div>
  );
}
