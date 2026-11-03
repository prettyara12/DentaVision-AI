import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ScanFlow } from "@/features/scan/scan-flow";
import { isLocale, t, type Locale } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/scan">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: `${t(lang, "scan.title")} · DentaVision AI` } : {};
}

export default async function ScanPage({ params }: PageProps<"/[lang]/scan">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] sm:text-[44px]">
          {t(lang, "scan.title")}
        </h1>
        <p className="text-ink-2">{t(lang, "scan.lede")}</p>
      </header>
      {/* The session is read at request time; until then the flow works, just without "Don't save". */}
      <Suspense fallback={<ScanFlow lang={lang} />}>
        <ScanFlowForUser lang={lang} />
      </Suspense>
      <p className="border-t border-rule pt-4 text-sm text-ink-2">{t(lang, "disclaimer.short")}</p>
    </main>
  );
}

async function ScanFlowForUser({ lang }: { lang: Locale }) {
  const user = await currentUser();
  return <ScanFlow lang={lang} userLoggedIn={Boolean(user)} />;
}
