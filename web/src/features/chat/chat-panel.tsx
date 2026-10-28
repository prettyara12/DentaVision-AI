"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { QuotaNotice } from "@/components/quota-notice";
import { t, type Locale } from "@/lib/i18n";
import { MAX_USER_CHARS } from "./message";
import type { useChat } from "./use-chat";

type Props = {
  lang: Locale;
  chat: ReturnType<typeof useChat>;
  suggestions: string[];
  /** Scan chat only: says the answers come from the findings list, not the image. */
  source?: boolean;
};

const label = "font-mono text-xs tracking-[0.06em] text-ink-2 uppercase";

/** Conversation as plain text (never HTML), with code-made starter questions (docs/ai-design.md §4). */
export function ChatPanel({ lang, chat, suggestions, source }: Props) {
  const { messages, draft, status } = chat;
  const [text, setText] = useState("");
  const list = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const streaming = status === "streaming";
  const unanswered = !streaming && messages.at(-1)?.role === "user";

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages, draft]);

  const send = (question: string) => {
    if (streaming || !question.trim()) return;
    chat.send(question);
    setText("");
    // A clicked suggestion chip disappears; keep focus in the conversation.
    input.current?.focus();
  };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send(text);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {messages.length > 0 && (
        <ol
          ref={list}
          aria-label={t(lang, "chat.label")}
          aria-live="polite"
          aria-busy={streaming}
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain"
        >
          {messages.map((m, i) => (
            <Message key={i} lang={lang} role={m.role} text={m.text} />
          ))}
          {draft && <Message lang={lang} role="model" text={draft} />}
        </ol>
      )}
      {messages.length === 0 && (
        <ul className="flex flex-wrap gap-2">
          {suggestions.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => send(q)}
                className="min-h-11 rounded-sm border border-rule px-3 py-2 text-left text-sm hover:border-ink-2"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      )}
      {streaming && !draft && (
        <p role="status" className="text-sm text-ink-2">
          {t(lang, "chat.typing")}
        </p>
      )}
      {chat.quotaExceeded && (
        <QuotaNotice
          lang={lang}
          role={chat.quotaExceeded.role}
          kind="chat"
          resetInSeconds={chat.quotaExceeded.resetInSeconds}
        />
      )}
      {unanswered && !chat.quotaExceeded && (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            {t(lang, status === "error" ? "chat.unavailable" : "chat.interrupted")}
          </p>
          <button
            type="button"
            onClick={chat.retry}
            className="min-h-11 rounded-sm border border-rule px-4 text-sm font-medium"
          >
            {t(lang, "action.retry")}
          </button>
        </div>
      )}
      {!chat.quotaExceeded && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            id="chat-input"
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            maxLength={MAX_USER_CHARS}
            rows={2}
            aria-label={t(lang, "chat.placeholder")}
            placeholder={t(lang, "chat.placeholder")}
            className="min-h-11 flex-1 resize-none rounded-sm border border-rule bg-transparent px-3 py-2 text-base placeholder:text-ink-2 focus-visible:border-ink-2"
          />
          <button
            type="submit"
            disabled={streaming || !text.trim()}
            className="min-h-11 rounded-sm bg-accent px-4 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {t(lang, "chat.send")}
          </button>
        </form>
      )}
      <div className="flex flex-col gap-1 text-xs text-ink-2">
        {source && <p>{t(lang, "chat.source")}</p>}
        <p>{t(lang, "disclaimer.short")}</p>
      </div>
    </div>
  );
}

function Message({ lang, role, text }: { lang: Locale; role: "user" | "model"; text: string }) {
  return (
    <li className="flex flex-col gap-1">
      <p className={label}>{t(lang, role === "user" ? "chat.you" : "chat.ai")}</p>
      <p className={`leading-relaxed whitespace-pre-wrap ${role === "user" ? "text-ink-2" : ""}`}>
        {text}
      </p>
    </li>
  );
}
