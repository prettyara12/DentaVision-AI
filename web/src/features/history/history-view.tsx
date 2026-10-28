"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { t, type Locale } from "@/lib/i18n";
import { DeleteModal } from "./delete-modal";
import type { UserChatSummary, UserScanSummary } from "./types";

export const TABS = ["scans", "chats"] as const;
export type Tab = (typeof TABS)[number];

export function onTabKey(
  event: Pick<KeyboardEvent, "key">,
  current: Tab,
  select: (tab: Tab) => void,
) {
  const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (!step) return;
  const next = TABS[(TABS.indexOf(current) + step + TABS.length) % TABS.length]!;
  select(next);
  if (typeof document !== "undefined") {
    document.getElementById(`tab-${next}`)?.focus();
  }
}

export function formatDate(iso: string, lang: Locale): string {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return iso;
  }
}

export type HistoryViewProps = {
  lang: Locale;
  initialScans: UserScanSummary[];
  initialChats: UserChatSummary[];
  defaultTab?: Tab;
};

export function HistoryView({
  lang,
  initialScans,
  initialChats,
  defaultTab = "scans",
}: HistoryViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [scans, setScans] = useState<UserScanSummary[]>(initialScans);
  const [chats, setChats] = useState<UserChatSummary[]>(initialChats);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "scan" | "chat"; id: string } | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const endpoint =
        deleteTarget.type === "scan"
          ? `/api/scans/${deleteTarget.id}`
          : `/api/chats/${deleteTarget.id}`;

      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Gagal menghapus");
      }

      if (deleteTarget.type === "scan") {
        setScans((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      } else {
        setChats((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      }

      setDeleteTarget(null);
    } catch {
      setDeleteError(t(lang, "history.delete_error"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {t(lang, "history.title")}
        </h1>
      </div>

      {deleteError && (
        <div
          role="alert"
          className="rounded-sm border border-finding-attention/40 bg-finding-attention/10 p-3 text-sm text-finding-attention"
        >
          {deleteError}
        </div>
      )}

      <div
        role="tablist"
        aria-label={t(lang, "history.title")}
        onKeyDown={(e) => onTabKey(e, activeTab, setActiveTab)}
        className="flex gap-2 border-b border-rule"
      >
        <button
          id="tab-scans"
          type="button"
          role="tab"
          aria-selected={activeTab === "scans"}
          aria-controls="panel-scans"
          tabIndex={activeTab === "scans" ? 0 : -1}
          onClick={() => setActiveTab("scans")}
          className="-mb-px min-h-11 border-b-2 border-transparent px-4 text-sm font-medium text-ink-2 aria-selected:border-accent aria-selected:text-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          {t(lang, "history.tab_scans")}
        </button>
        <button
          id="tab-chats"
          type="button"
          role="tab"
          aria-selected={activeTab === "chats"}
          aria-controls="panel-chats"
          tabIndex={activeTab === "chats" ? 0 : -1}
          onClick={() => setActiveTab("chats")}
          className="-mb-px min-h-11 border-b-2 border-transparent px-4 text-sm font-medium text-ink-2 aria-selected:border-accent aria-selected:text-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          {t(lang, "history.tab_chats")}
        </button>
      </div>

      <div
        id="panel-scans"
        role="tabpanel"
        aria-labelledby="tab-scans"
        hidden={activeTab !== "scans"}
      >
        {scans.length === 0 ? (
          <div className="flex flex-col items-start gap-4 py-8">
            <p className="text-sm text-ink-2">{t(lang, "history.empty_scans")}</p>
            <Link
              href={`/${lang}/scan`}
              className="inline-flex min-h-11 items-center justify-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-ink hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent"
            >
              {t(lang, "history.new_scan")}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-rule" role="list">
            {scans.map((scan) => (
              <li
                key={scan.id}
                className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-4">
                  {scan.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- signed URL thumbnail from Supabase Storage */
                    <img
                      src={scan.imageUrl}
                      alt=""
                      className="h-16 w-24 shrink-0 rounded-sm border border-rule bg-surface object-cover sm:h-20 sm:w-28"
                    />
                  ) : (
                    <div className="h-16 w-24 shrink-0 rounded-sm border border-rule bg-surface sm:h-20 sm:w-28" />
                  )}
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-medium text-ink">
                      {formatDate(scan.createdAt, lang)}
                    </span>
                    {scan.attentionCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-finding-attention">
                        <span
                          className="h-2 w-2 rounded-full bg-finding-attention"
                          aria-hidden="true"
                        />
                        {t(lang, "history.attention_findings").replace(
                          "{count}",
                          String(scan.attentionCount),
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-2">
                        {scan.detectionsCount} {lang === "id" ? "temuan" : "findings"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/${lang}/scans/${scan.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-sm border border-rule bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {t(lang, "history.open_scan")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget({ type: "scan", id: scan.id });
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-sm border border-rule px-4 text-sm font-medium text-finding-attention hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-finding-attention"
                  >
                    {t(lang, "history.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        id="panel-chats"
        role="tabpanel"
        aria-labelledby="tab-chats"
        hidden={activeTab !== "chats"}
      >
        {chats.length === 0 ? (
          <div className="flex flex-col items-start gap-4 py-8">
            <p className="text-sm text-ink-2">{t(lang, "history.empty_chats")}</p>
            <Link
              href={`/${lang}/chat`}
              className="inline-flex min-h-11 items-center justify-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-ink hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent"
            >
              {t(lang, "history.new_chat")}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-rule" role="list">
            {chats.map((chat) => (
              <li
                key={chat.id}
                className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-medium text-ink">
                      {chat.title || t(lang, "chat.title")}
                    </span>
                    <span className="shrink-0 rounded-sm border border-rule bg-surface px-2 py-0.5 text-xs font-mono uppercase text-ink-2">
                      {chat.scanId
                        ? t(lang, "history.chat_type_scan")
                        : t(lang, "history.chat_type_general")}
                    </span>
                  </div>
                  <span className="text-xs text-ink-2">{formatDate(chat.updatedAt, lang)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/${lang}/chats/${chat.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-sm border border-rule bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {t(lang, "history.open_chat")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget({ type: "chat", id: chat.id });
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-sm border border-rule px-4 text-sm font-medium text-finding-attention hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-finding-attention"
                  >
                    {t(lang, "history.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DeleteModal
        open={deleteTarget !== null}
        title={t(lang, "history.delete")}
        message={
          deleteTarget?.type === "scan"
            ? t(lang, "history.delete_scan_confirm")
            : t(lang, "history.delete_chat_confirm")
        }
        confirmLabel={t(lang, "common.delete")}
        cancelLabel={t(lang, "common.cancel")}
        loadingLabel={t(lang, "common.deleting")}
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />
    </div>
  );
}
