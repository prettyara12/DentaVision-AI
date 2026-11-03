import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";

// Pages carry their own disclaimer next to the results (PRD §7.5); the footer only links the
// transparency pages (US-15) so they are one tap away from every screen.
export function SiteFooter({ lang }: { lang: Locale }) {
  return (
    <footer className="border-t border-rule bg-bg text-ink-2">
      <nav
        aria-label={t(lang, "footer.label")}
        className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-4 text-sm"
      >
        <Link
          href={`/${lang}/privacy`}
          className="inline-flex min-h-11 items-center hover:text-accent"
        >
          {t(lang, "footer.privacy")}
        </Link>
        <Link
          href={`/${lang}/about-model`}
          className="inline-flex min-h-11 items-center hover:text-accent"
        >
          {t(lang, "footer.about")}
        </Link>
      </nav>
    </footer>
  );
}
