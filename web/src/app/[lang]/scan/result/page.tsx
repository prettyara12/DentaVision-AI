import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ResultWorkspace } from "@/features/scan/result-workspace";
import { isLocale, t, type Locale } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/scan/result">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: `${t(lang, "result.title")} · DentaVision AI` } : {};
}

export default async function ScanResultPage({ params }: PageProps<"/[lang]/scan/result">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <div data-room="lightbox" className="flex flex-1 flex-col bg-bg text-ink">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-12">
        <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] sm:text-[44px]">
          {t(lang, "result.title")}
        </h1>
        <Suspense fallback={<ResultWorkspace lang={lang} userLoggedIn={false} />}>
          <ScanResultContent lang={lang} />
        </Suspense>
        <p className="border-t border-rule pt-4 text-sm text-ink-2">
          {t(lang, "disclaimer.short")}
        </p>
      </main>
    </div>
  );
}

async function ScanResultContent({ lang }: { lang: Locale }) {
  const user = await currentUser();
  return <ResultWorkspace lang={lang} userLoggedIn={Boolean(user)} />;
}
