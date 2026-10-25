import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResultWorkspace } from "@/features/scan/result-workspace";
import { isLocale, t } from "@/lib/i18n";

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
        <ResultWorkspace lang={lang} />
        <p className="border-t border-rule pt-4 text-sm text-ink-2">
          {t(lang, "disclaimer.short")}
        </p>
      </main>
    </div>
  );
}
