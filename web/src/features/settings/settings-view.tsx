"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { DeleteAccountModal } from "./delete-account-modal";

export function formatJoinedDate(iso: string, lang: Locale): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return iso;
  }
}

export type SettingsViewProps = {
  lang: Locale;
  email: string;
  createdAt?: string | null;
};

export function SettingsView({ lang, email, createdAt }: SettingsViewProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const formattedDate = createdAt ? formatJoinedDate(createdAt, lang) : "";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {t(lang, "settings.title")}
        </h1>
      </div>

      {/* Account Info Section */}
      <section aria-labelledby="settings-account-heading" className="flex flex-col gap-3">
        <h2 id="settings-account-heading" className="text-lg font-semibold text-ink">
          {t(lang, "settings.account")}
        </h2>
        <div className="rounded-md border border-rule bg-surface p-5 sm:p-6">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-mono uppercase tracking-wider text-ink-2">
                {t(lang, "settings.email")}
              </dt>
              <dd className="mt-1 text-sm font-medium text-ink break-all sm:text-base">
                {email || "-"}
              </dd>
            </div>
            {formattedDate ? (
              <div>
                <dt className="text-xs font-mono uppercase tracking-wider text-ink-2">
                  {t(lang, "settings.joined")}
                </dt>
                <dd className="mt-1 text-sm text-ink-2 sm:text-base">{formattedDate}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      {/* Danger Zone Section */}
      <section aria-labelledby="settings-danger-heading" className="flex flex-col gap-3">
        <h2 id="settings-danger-heading" className="text-lg font-semibold text-finding-attention">
          {t(lang, "settings.danger_zone")}
        </h2>
        <div className="rounded-md border border-finding-attention/40 bg-surface p-5 sm:p-6">
          <p className="text-sm text-ink-2 leading-relaxed">{t(lang, "settings.danger_desc")}</p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-sm bg-finding-attention px-4 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-finding-attention"
            >
              {t(lang, "settings.delete_account")}
            </button>
          </div>
        </div>
      </section>

      <DeleteAccountModal open={modalOpen} lang={lang} onClose={() => setModalOpen(false)} />
    </div>
  );
}
