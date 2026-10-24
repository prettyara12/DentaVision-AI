import { notFound } from "next/navigation";
import { isLocale, t } from "@/lib/i18n";

// Placeholder until the landing page (#19).
export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-4 py-24">
      <p className="font-mono text-xs tracking-[0.06em] text-ink-2 uppercase">
        {t(lang, "home.status")}
      </p>
      <h1 className="text-[clamp(40px,6vw,88px)] leading-none font-semibold tracking-[-0.02em]">
        {t(lang, "home.title")}
      </h1>
      <p className="border-t border-rule pt-4 text-sm text-ink-2">{t(lang, "disclaimer.short")}</p>
    </main>
  );
}
