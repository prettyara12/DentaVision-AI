import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GeneralChat } from "@/features/chat/general-chat";
import { isLocale, t } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/chat">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: `${t(lang, "chat.title")} · DentaVision AI` } : {};
}

export default async function ChatPage({ params }: PageProps<"/[lang]/chat">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] sm:text-[44px]">
          {t(lang, "chat.title")}
        </h1>
        <p className="text-ink-2">{t(lang, "chat.lede")}</p>
      </header>
      <GeneralChat lang={lang} />
    </main>
  );
}
