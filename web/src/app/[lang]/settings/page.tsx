import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsView } from "@/features/settings/settings-view";
import { isLocale, t, type Locale } from "@/lib/i18n";
import { createClient, currentUser } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: `${t(lang, "settings.title")} · DentaVision AI` } : {};
}

export default async function SettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12 sm:py-16">
      <Suspense fallback={<SettingsSkeleton lang={lang} />}>
        <SettingsContent lang={lang} />
      </Suspense>
    </main>
  );
}

export async function SettingsContent({ lang }: { lang: Locale }) {
  const user = await currentUser();
  if (!user) {
    redirect(`/${lang}/login?next=/${lang}/settings`);
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  return (
    <SettingsView
      lang={lang}
      email={user.email ?? authUser?.email ?? ""}
      createdAt={authUser?.created_at ?? null}
    />
  );
}

function SettingsSkeleton({ lang }: { lang: Locale }) {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-busy="true">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {t(lang, "settings.title")}
        </h1>
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-6 w-24 rounded-sm bg-surface" />
        <div className="h-28 w-full rounded-md bg-surface" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-6 w-36 rounded-sm bg-surface" />
        <div className="h-36 w-full rounded-md bg-surface" />
      </div>
    </div>
  );
}
