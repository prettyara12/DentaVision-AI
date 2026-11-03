import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { GeneralChat } from "@/features/chat/general-chat";
import { chatMessageSchema, type ChatMessage } from "@/features/chat/message";
import { insightSchema } from "@/features/insight/insight";
import { analyzeResultSchema, type StoredScan } from "@/features/scan/result";
import { isLocale, t, type Locale } from "@/lib/i18n";
import { createClient, currentUser } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: `${t(lang, "chat.title")} · DentaVision AI` } : {};
}

export default function SavedChatPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <Suspense fallback={<ChatSkeleton />}>
        <ChatContent params={params} />
      </Suspense>
    </main>
  );
}

export async function ChatContent({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const user = await currentUser();
  if (!user) {
    redirect(`/${lang}/login?next=/${lang}/chats/${id}`);
  }

  const supabase = await createClient();
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (chatError || !chat) {
    notFound();
  }

  const { data: rawMessages, error: msgError } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("chat_id", id)
    .order("id", { ascending: true });

  if (msgError) {
    notFound();
  }

  const initialMessages: ChatMessage[] = (rawMessages ?? [])
    .map((m) => {
      const parsed = chatMessageSchema.safeParse({
        role: m.role === "user" ? "user" : "model",
        text: m.content,
      });
      return parsed.success ? parsed.data : null;
    })
    .filter((m): m is ChatMessage => m !== null);

  let scanForChat: StoredScan | null = null;
  if (chat.scan_id) {
    const { data: scanRow } = await supabase
      .from("scans")
      .select("detections, image_width, image_height, model_version, insight")
      .eq("id", chat.scan_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (scanRow) {
      const parsedDetections = analyzeResultSchema.shape.detections.safeParse(scanRow.detections);
      const detections = parsedDetections.success ? parsedDetections.data : [];

      let parsedInsight: StoredScan["insight"] = undefined;
      if (scanRow.insight && typeof scanRow.insight === "object") {
        const parsedData = insightSchema.safeParse(scanRow.insight);
        if (parsedData.success) {
          parsedInsight = {
            locale: lang as Locale,
            version: "insight@2",
            data: parsedData.data,
          };
        }
      }

      scanForChat = {
        image: "",
        result: {
          model_version: scanRow.model_version,
          image: { width: scanRow.image_width, height: scanRow.image_height },
          low_quality: false,
          detections,
          heatmaps: {},
          timing_ms: {},
        },
        insight: parsedInsight,
      };
    }
  }

  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] sm:text-[44px]">
          {chat.title || t(lang as Locale, "chat.title")}
        </h1>
        <p className="text-ink-2">{t(lang as Locale, "chat.lede")}</p>
      </header>
      <GeneralChat
        lang={lang as Locale}
        initialMessages={initialMessages}
        initialChatId={id}
        scan={scanForChat}
      />
    </>
  );
}

function ChatSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true">
      <header className="flex flex-col gap-3">
        <div className="h-10 w-48 rounded bg-surface" />
        <div className="h-4 w-72 rounded bg-surface" />
      </header>
      <div className="h-64 w-full rounded bg-surface" />
    </div>
  );
}
