"use client";

import { useEffect, useState } from "react";
import { SCAN_STORAGE_KEY, storedScanSchema, type StoredScan } from "@/features/scan/result";
import { readLines } from "@/features/scan/upload";
import type { Locale } from "@/lib/i18n";
import {
  INSIGHT_PROMPT_VERSION,
  type Insight,
  type InsightEvent,
  type PartialInsight,
} from "./insight";

export type InsightState =
  | { status: "streaming"; insight: PartialInsight }
  | { status: "done"; insight: Insight; locale: Locale }
  | { status: "error" };

// Guests keep the finished insight next to their scan in this tab only (docs/security-privacy.md §1).
function remember(insight: Insight, locale: Locale) {
  try {
    const raw = sessionStorage.getItem(SCAN_STORAGE_KEY);
    const scan = storedScanSchema.safeParse(raw ? JSON.parse(raw) : null);
    if (!scan.success) return;
    const next: StoredScan = {
      ...scan.data,
      insight: { locale, version: INSIGHT_PROMPT_VERSION, data: insight },
    };
    sessionStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the insight still shows, it just is not kept for a reload.
  }
}

/** Streams the insight once per scan (US-05); `generate(locale)` asks again, e.g. after a language switch. */
export function useInsight(scan: StoredScan, lang: Locale) {
  const stored = scan.insight?.version === INSIGHT_PROMPT_VERSION ? scan.insight : undefined;
  const [state, setState] = useState<InsightState>(
    stored
      ? { status: "done", insight: stored.data, locale: stored.locale }
      : { status: "streaming", insight: {} },
  );
  // Locale to generate in, or null when there is nothing to fetch.
  const [pending, setPending] = useState<Locale | null>(stored ? null : lang);

  useEffect(() => {
    if (!pending) return;
    // Aborted when the result route is hidden or left; the effect runs again if it comes back.
    const controller = new AbortController();
    (async () => {
      try {
        const body = JSON.stringify({ locale: pending, detections: scan.result.detections });
        const response = await fetch("/api/insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
        for await (const event of readLines<InsightEvent>(response.body)) {
          if (event.type === "partial") setState({ status: "streaming", insight: event.insight });
          else if (event.type === "done") {
            remember(event.insight, pending);
            setState({ status: "done", insight: event.insight, locale: pending });
            setPending(null);
            return;
          } else break;
        }
        throw new Error("stream ended without a result");
      } catch {
        if (controller.signal.aborted) return;
        setState({ status: "error" });
        setPending(null);
      }
    })();
    return () => controller.abort();
  }, [pending, scan]);

  return {
    state,
    generate: (locale: Locale) => {
      setState({ status: "streaming", insight: {} });
      setPending(locale);
    },
  };
}
