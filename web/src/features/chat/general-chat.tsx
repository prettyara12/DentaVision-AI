"use client";

import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
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

/** General dental chat for /chat (US-07): no scan context, kept in this tab only. */
export function GeneralChat({ lang }: { lang: Locale }) {
  const raw = useSyncExternalStore(noSubscribe, readStoredChat, () => undefined);
  const initial = useMemo(() => {
    try {
      const parsed = z.array(chatMessageSchema).safeParse(JSON.parse(raw ?? "[]"));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }, [raw]);
  // Wait for the browser snapshot so a reload starts from the stored conversation.
  if (raw === undefined) return null;
  return <Conversation lang={lang} initial={initial} />;
}

function Conversation({ lang, initial }: { lang: Locale; initial: ChatMessage[] }) {
  const chat = useChat(lang, null, initial);
  return <ChatPanel lang={lang} chat={chat} suggestions={suggestions(lang, null)} />;
}
