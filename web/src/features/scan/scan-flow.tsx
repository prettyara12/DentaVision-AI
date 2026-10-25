"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t, type Locale, type MessageKey } from "@/lib/i18n";
import { Dropzone } from "./dropzone";
import { analyzeResultSchema, SCAN_STORAGE_KEY, type ScanEvent, type StoredScan } from "./result";
import type { SampleKey } from "./samples";
import { ScanProgress, type ProgressPhase } from "./scan-progress";
import { checkFile, compressImage, readLines, toDataUrl } from "./upload";

type Phase =
  | { name: "idle"; problem: MessageKey | null }
  | { name: ProgressPhase }
  | { name: "sample" }
  | { name: "rejected"; reason: string | null }
  | { name: "error"; message: MessageKey };

const WAKING_AFTER_MS = 3_000;
const HEALTH_POLL_MS = 3_000;
const WAKE_LIMIT_MS = 3 * 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function healthStatus(): Promise<string> {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    return ((await response.json()) as { status: string }).status;
  } catch {
    return "waking";
  }
}

/** Resolves once the inference API is ready; shows `waking` if that takes longer than 3 s. */
async function waitUntilReady(onWaking: () => void): Promise<boolean> {
  const wakingTimer = setTimeout(onWaking, WAKING_AFTER_MS);
  try {
    for (const started = Date.now(); Date.now() - started < WAKE_LIMIT_MS;) {
      const status = await healthStatus();
      if (status === "ready") return true;
      if (status === "error") return false;
      await sleep(HEALTH_POLL_MS);
    }
    return false;
  } finally {
    clearTimeout(wakingTimer);
  }
}

export function ScanFlow({ lang }: { lang: Locale }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle", problem: null });
  const [preview, setPreview] = useState<string | null>(null);
  const retry = useRef<() => void>(() => {});
  const openedResult = useRef(false);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  // cacheComponents keeps this route mounted but hidden (<Activity>) after we navigate to the result,
  // so "Upload X-ray" would come back to the finished progress screen. Reset once the result has opened.
  useLayoutEffect(
    () => () => {
      if (!openedResult.current) return;
      openedResult.current = false;
      setPreview(null);
      setPhase({ name: "idle", problem: null });
    },
    [],
  );

  async function run(file: File) {
    const problem = checkFile(file);
    if (problem) return setPhase({ name: "idle", problem: `drop.${problem}` });
    retry.current = () => run(file);
    setPhase({ name: "preparing" });

    let image: Blob;
    try {
      image = await compressImage(file);
    } catch {
      return setPhase({ name: "idle", problem: "drop.unreadable" });
    }
    setPreview(URL.createObjectURL(image));

    if (!(await waitUntilReady(() => setPhase({ name: "waking" })))) {
      return setPhase({ name: "error", message: "error.unavailable" });
    }

    setPhase({ name: "validating" });
    const body = new FormData();
    body.append("image", image, "scan.jpg");
    body.append("locale", lang);
    let response: Response;
    try {
      response = await fetch("/api/scans", { method: "POST", body });
    } catch {
      return setPhase({ name: "error", message: "error.unavailable" });
    }
    if (!response.ok || !response.body) {
      const code = await response
        .json()
        .then((b: { code?: string }) => b.code)
        .catch(() => undefined);
      const message = code === "too_large" || code === "unsupported_type" ? code : "unavailable";
      return setPhase({ name: "error", message: `error.${message}` });
    }

    try {
      for await (const event of readLines<ScanEvent>(response.body)) {
        if (event.type === "stage") setPhase({ name: event.stage });
        else if (event.type === "rejected")
          return setPhase({ name: "rejected", reason: event.reason });
        else if (event.type === "error")
          return setPhase({ name: "error", message: `error.${event.code}` });
        else return open({ image: await toDataUrl(image), result: event.result });
      }
    } catch {
      // Stream cut off (network drop or function timeout) before a final event.
    }
    setPhase({ name: "error", message: "error.unavailable" });
  }

  function open(scan: StoredScan) {
    try {
      sessionStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify(scan));
    } catch {
      return setPhase({ name: "error", message: "error.storage" });
    }
    openedResult.current = true;
    router.push(`/${lang}/scan/result`);
  }

  // Samples skip validation and inference: the result was computed once and ships with the app (US-01).
  async function trySample(key: SampleKey) {
    retry.current = () => trySample(key);
    setPhase({ name: "sample" });
    try {
      const [image, result] = await Promise.all([
        fetch(`/samples/${key}.jpg`).then((r) => (r.ok ? r.blob() : Promise.reject(r.status))),
        fetch(`/api/samples/${key}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      ]);
      open({
        image: await toDataUrl(image),
        result: analyzeResultSchema.parse(result),
        sample: key,
      });
    } catch {
      setPhase({ name: "error", message: "error.unavailable" });
    }
  }

  function reset() {
    setPreview(null);
    setPhase({ name: "idle", problem: null });
  }

  if (phase.name === "idle") {
    return <Dropzone lang={lang} problem={phase.problem} onFile={run} onSample={trySample} />;
  }
  if (phase.name === "rejected" || phase.name === "error") {
    return (
      <div role="alert" className="flex flex-col gap-4 border-t border-rule pt-6">
        <p className="text-lg font-medium">
          {t(lang, phase.name === "rejected" ? "rejected.title" : phase.message)}
        </p>
        {/* Gemini's reason is untrusted text; React renders it as plain text. */}
        {phase.name === "rejected" && phase.reason && <p className="text-sm">{phase.reason}</p>}
        {phase.name === "rejected" && (
          <p className="text-sm text-ink-2">{t(lang, "rejected.hint")}</p>
        )}
        <div className="flex flex-wrap gap-3">
          {phase.name === "error" && (
            <button
              type="button"
              onClick={() => retry.current()}
              className="min-h-11 rounded-sm bg-accent px-5 text-sm font-medium text-accent-ink"
            >
              {t(lang, "action.retry")}
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-sm border border-rule px-5 text-sm font-medium"
          >
            {t(lang, "action.another")}
          </button>
        </div>
      </div>
    );
  }
  if (phase.name === "sample") {
    return (
      <p role="status" className="text-sm text-ink-2">
        {t(lang, "sample.loading")}
      </p>
    );
  }
  return preview ? (
    <ScanProgress lang={lang} phase={phase.name} preview={preview} />
  ) : (
    <p role="status" className="text-sm text-ink-2">
      {t(lang, "progress.preparing")}
    </p>
  );
}
