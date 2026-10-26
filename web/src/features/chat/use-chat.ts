"use client";

import { useEffect, useRef, useState } from "react";
import { SCAN_STORAGE_KEY, storedScanSchema, type StoredScan } from "@/features/scan/result";
import { readLines } from "@/features/scan/upload";
import type { Locale } from "@/lib/i18n";
import { MAX_HISTORY, type ChatEvent } from "./chat";
import { MAX_KEPT_MESSAGES, MAX_MODEL_CHARS, type ChatMessage } from "./message";

export const GENERAL_CHAT_STORAGE_KEY = "dentavision:chat";

export type ChatStatus = "idle" | "streaming" | "error";

// Guests keep the conversation in this tab only (docs/user-flows.md §5).
function remember(messages: ChatMessage[], scan: StoredScan | null) {
  try {
    if (!scan) {
      sessionStorage.setItem(GENERAL_CHAT_STORAGE_KEY, JSON.stringify(messages));
      return;
    }
    const raw = sessionStorage.getItem(SCAN_STORAGE_KEY);
    const stored = storedScanSchema.safeParse(raw ? JSON.parse(raw) : null);
    // Only the scan this chat is about; a newer scan in storage keeps its own chat.
    if (!stored.success || stored.data.image !== scan.image) return;
    sessionStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify({ ...stored.data, chat: messages }));
  } catch {
    // Storage full or blocked: the chat still works, it just is not kept for a reload.
  }
}

/** Chat about `scan` (US-06), or general dental chat when `scan` is null (US-07). */
export function useChat(lang: Locale, scan: StoredScan | null, initial: ChatMessage[]) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const controller = useRef<AbortController | null>(null);

  // Hiding or leaving the page stops the answer; the question stays and can be asked again.
  useEffect(() => () => controller.current?.abort(), []);

  const ask = (asked: ChatMessage[]) => {
    // Oldest messages drop off so the tab's storage stays bounded.
    const history = asked.slice(-MAX_KEPT_MESSAGES);
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setMessages(history);
    remember(history, scan);
    setDraft("");
    setStatus("streaming");

    (async () => {
      let answer = "";
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale: lang,
            messages: history.slice(-MAX_HISTORY),
            // Left out (not null) for general chat.
            scan: scan
              ? { detections: scan.result.detections, insightSummary: scan.insight?.data.summary }
              : undefined,
          }),
          signal: current.signal,
        });
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
        for await (const event of readLines<ChatEvent>(response.body)) {
          if (event.type === "delta") {
            answer += event.text;
            setDraft(answer);
          } else if (event.type === "done") {
            const next: ChatMessage[] = [
              ...history.slice(1 - MAX_KEPT_MESSAGES),
              { role: "model", text: answer.slice(0, MAX_MODEL_CHARS) },
            ];
            setMessages(next);
            remember(next, scan);
            setDraft("");
            setStatus("idle");
            return;
          } else break;
        }
        throw new Error("stream ended without an answer");
      } catch {
        if (controller.current !== current) return;
        setDraft("");
        setStatus(current.signal.aborted ? "idle" : "error");
      }
    })();
  };

  return {
    messages,
    draft,
    status,
    send: (text: string) => ask([...messages, { role: "user", text: text.trim() }]),
    /** Asks the last unanswered question again (after an error or an interrupted answer). */
    retry: () => ask(messages),
  };
}
