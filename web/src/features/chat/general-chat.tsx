"use client";

import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import type { StoredScan } from "@/features/scan/result";
import type { Locale } from "@/lib/i18n";
import { suggestions } from "./chat";
import { ChatPanel } from "./chat-panel";
import { chatMessageSchema, type ChatMessage } from "./message";
import { GENERAL_CHAT_STORAGE_KEY, useChat } from "./use-chat";

const noSubscribe = () => () => {};

function readStoredChat(): string | null {
  try {
    return sessionStorage.getItem(GENERAL_CHAT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** General dental chat for /chat (US-07) and saved chats for /chats/[id]. */
export function GeneralChat({
  lang,
  initialMessages,
  initialChatId,
  scan,
}: {
  lang: Locale;
  initialMessages?: ChatMessage[];
  initialChatId?: string;
  scan?: StoredScan | null;
}) {
  const raw = useSyncExternalStore(noSubscribe, readStoredChat, () => undefined);
  const initial = useMemo(() => {
    if (initialMessages) return initialMessages;
    try {
      const parsed = z.array(chatMessageSchema).safeParse(JSON.parse(raw ?? "[]"));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }, [initialMessages, raw]);

  // Wait for the browser snapshot so a reload starts from the stored conversation.
  if (!initialMessages && raw === undefined) return null;
  return (
    <Conversation lang={lang} initial={initial} initialChatId={initialChatId} scan={scan ?? null} />
  );
}

function Conversation({
  lang,
  initial,
  initialChatId,
  scan,
}: {
  lang: Locale;
  initial: ChatMessage[];
  initialChatId?: string;
  scan: StoredScan | null;
}) {
  const chat = useChat(lang, scan, initial, initialChatId ? { chatId: initialChatId } : undefined);
  return (
    <ChatPanel
      lang={lang}
      chat={chat}
      suggestions={suggestions(lang, scan?.result.detections ?? null)}
    />
  );
}
