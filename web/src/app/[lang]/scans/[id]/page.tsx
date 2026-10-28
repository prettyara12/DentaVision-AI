import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { chatMessageSchema } from "@/features/chat/message";
import { getScanDetail } from "@/features/history/data";
import { insightSchema } from "@/features/insight/insight";
import { ResultWorkspace } from "@/features/scan/result-workspace";
import type { StoredScan } from "@/features/scan/result";
import { isLocale, t, type Locale } from "@/lib/i18n";
import { createClient, currentUser } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: `${t(lang, "result.title")} · DentaVision AI` } : {};
}

export default function SavedScanPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  return (
    <div data-room="lightbox" className="flex flex-1 flex-col bg-bg text-ink">
      <Suspense fallback={<ScanSkeleton />}>
        <ScanContent params={params} />
      </Suspense>
    </div>
  );
}

export async function ScanContent({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const user = await currentUser();
  if (!user) {
    redirect(`/${lang}/login?next=/${lang}/scans/${id}`);
  }

  const supabase = await createClient();
  const scanDetail = await getScanDetail(supabase, user.id, id);
  if (!scanDetail) {
    notFound();
  }

  let insight: StoredScan["insight"] = undefined;
  if (scanDetail.insight) {
    const parsedData = insightSchema.safeParse(scanDetail.insight.data);
    if (parsedData.success) {
      insight = {
        locale: isLocale(scanDetail.insight.locale) ? scanDetail.insight.locale : (lang as Locale),
        version: scanDetail.insight.version,
        data: parsedData.data,
      };
    }
  }

  let chat: StoredScan["chat"] = undefined;
  if (scanDetail.chat) {
    chat = scanDetail.chat.messages
      .map((m) => {
        const parsed = chatMessageSchema.safeParse({
          role: m.role === "user" ? "user" : "model",
          text: m.content,
        });
        return parsed.success ? parsed.data : null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }

  const initialScan: StoredScan = {
    image: scanDetail.imageUrl,
    result: {
      model_version: scanDetail.modelVersion,
      image: { width: scanDetail.imageWidth, height: scanDetail.imageHeight },
      low_quality: false,
      detections: scanDetail.detections,
      heatmaps: scanDetail.heatmaps,
      timing_ms: {},
    },
    insight,
    chat,
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] sm:text-[44px]">
        {t(lang as Locale, "result.title")}
      </h1>
      <ResultWorkspace lang={lang as Locale} initialScan={initialScan} />
      <p className="border-t border-rule pt-4 text-sm text-ink-2">
        {t(lang as Locale, "disclaimer.short")}
      </p>
    </main>
  );
}

function ScanSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex animate-pulse flex-col gap-6" aria-busy="true">
        <div className="h-10 w-48 rounded bg-surface" />
        <div className="h-96 w-full rounded-sm bg-surface" />
      </div>
    </main>
  );
}
