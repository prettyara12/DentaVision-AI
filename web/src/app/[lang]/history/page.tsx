import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getUserChats, getUserScans } from "@/features/history/data";
import { HistoryView } from "@/features/history/history-view";
import { isLocale, t, type Locale } from "@/lib/i18n";
import { createClient, currentUser } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: `${t(lang, "history.title")} · DentaVision AI` } : {};
}

export default async function HistoryPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12 sm:py-16">
      <Suspense fallback={<HistorySkeleton lang={lang} />}>
        <HistoryContent lang={lang} />
      </Suspense>
    </main>
  );
}

async function HistoryContent({ lang }: { lang: Locale }) {
  const user = await currentUser();
  if (!user) {
    redirect(`/${lang}/login?next=/${lang}/history`);
  }

  const supabase = await createClient();
  const [scans, chats] = await Promise.all([
    getUserScans(supabase, user.id),
    getUserChats(supabase, user.id),
  ]);

  return <HistoryView lang={lang} initialScans={scans} initialChats={chats} />;
}

function HistorySkeleton({ lang }: { lang: Locale }) {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {t(lang, "history.title")}
        </h1>
      </div>
      <div className="flex gap-2 border-b border-rule">
        <div className="-mb-px min-h-11 border-b-2 border-accent px-4 text-sm font-medium text-ink">
          {t(lang, "history.tab_scans")}
        </div>
        <div className="-mb-px min-h-11 px-4 text-sm font-medium text-ink-2">
          {t(lang, "history.tab_chats")}
        </div>
      </div>
      <div className="h-24 w-full rounded-sm bg-surface" />
    </div>
  );
}
