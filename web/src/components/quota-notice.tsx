import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";

export interface QuotaNoticeProps {
  lang: Locale;
  role: "guest" | "user";
  kind: "scan" | "chat";
  resetInSeconds: number;
  className?: string;
}

export function formatResetTime(lang: Locale, seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const hours = Math.floor(safeSec / 3600);
  const minutes = Math.floor((safeSec % 3600) / 60);

  if (lang === "en") {
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  if (hours > 0) return `${hours} jam ${minutes} menit`;
  return `${minutes} menit`;
}

export function QuotaNotice({ lang, role, resetInSeconds, className = "" }: QuotaNoticeProps) {
  const timeRemaining = formatResetTime(lang, resetInSeconds);
  const descTemplate = t(lang, "quota.notice.desc");
  const desc = descTemplate.replace("{timeRemaining}", timeRemaining);

  return (
    <div
      role="alert"
      className={`flex flex-col gap-3 rounded-sm border border-rule bg-canvas p-4 text-ink ${className}`}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold tracking-tight text-ink">
          {t(lang, "quota.notice.title")}
        </h3>
        <p className="text-xs text-ink-2 leading-relaxed">{desc}</p>
      </div>

      {role === "guest" && (
        <div className="flex flex-col items-start gap-2 pt-1 border-t border-rule/60 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-2">{t(lang, "quota.notice.guest_hint")}</p>
          <Link
            href={`/${lang}/login`}
            className="inline-flex min-h-11 items-center justify-center rounded-sm bg-accent px-4 text-xs font-medium text-accent-ink hover:opacity-90 transition-opacity"
          >
            {t(lang, "quota.notice.login_cta")}
          </Link>
        </div>
      )}
    </div>
  );
}
