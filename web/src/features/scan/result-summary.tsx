"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { t, type Locale } from "@/lib/i18n";
import { DEFAULT_MIN_CONFIDENCE, SCAN_STORAGE_KEY, storedScanSchema } from "./result";

const noSubscribe = () => () => {};

function readStoredScan(): string | null {
  try {
    return sessionStorage.getItem(SCAN_STORAGE_KEY);
  } catch {
    return null;
  }
}

// shortcut: count-only summary, replaced by XrayViewer + FindingList in #10.
export function ResultSummary({ lang }: { lang: Locale }) {
  const raw = useSyncExternalStore(noSubscribe, readStoredScan, () => null);
  const scan = useMemo(() => {
    if (!raw) return null;
    try {
      const parsed = storedScanSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [raw]);

  if (!scan) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-ink-2">{t(lang, "result.empty")}</p>
        <Link
          href={`/${lang}/scan`}
          className="inline-flex min-h-11 items-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-ink"
        >
          {t(lang, "result.new_scan")}
        </Link>
      </div>
    );
  }

  const count = scan.result.detections.filter((d) => d.confidence >= DEFAULT_MIN_CONFIDENCE).length;
  return (
    <div className="flex flex-col gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL kept in sessionStorage */}
      <img
        src={scan.image}
        alt=""
        className="max-h-[55vh] w-full rounded-md bg-black object-contain"
      />
      <p className="text-lg">
        {count > 0 ? t(lang, "result.count").replace("{n}", String(count)) : t(lang, "result.none")}
      </p>
      {scan.result.low_quality && (
        <p className="text-sm text-warn">{t(lang, "result.low_quality")}</p>
      )}
      <p className="text-sm text-ink-2">{t(lang, "result.viewer_pending")}</p>
      <Link href={`/${lang}/scan`} className="text-sm text-accent underline underline-offset-4">
        {t(lang, "result.new_scan")}
      </Link>
    </div>
  );
}
