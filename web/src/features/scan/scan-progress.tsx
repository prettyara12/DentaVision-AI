"use client";

import { t, type Locale, type MessageKey } from "@/lib/i18n";

export type ProgressPhase = "preparing" | "waking" | "validating" | "analyzing";

const steps: { phase: ProgressPhase; label: MessageKey }[] = [
  { phase: "validating", label: "progress.step_validate" },
  { phase: "analyzing", label: "progress.step_analyze" },
];

type Props = { lang: Locale; phase: ProgressPhase; preview: string };

// Steps advance only on server events (docs/design-system.md §4, "Analisis nyata").
export function ScanProgress({ lang, phase, preview }: Props) {
  const current = steps.findIndex((s) => s.phase === phase);
  const status =
    phase === "preparing"
      ? t(lang, "progress.preparing")
      : phase === "waking"
        ? t(lang, "progress.waking")
        : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-md bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL of the user's compressed upload */}
        <img src={preview} alt="" className="mx-auto max-h-[55vh] w-auto opacity-80" />
        <div aria-hidden className="scan-sweep pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 right-0 w-0.5 bg-accent" />
        </div>
      </div>
      <ol
        aria-live="polite"
        className="flex flex-col gap-2 font-mono text-xs tracking-[0.06em] uppercase"
      >
        {steps.map((step, i) => (
          <li
            key={step.phase}
            data-state={current < 0 || i > current ? "pending" : i < current ? "done" : "active"}
            className="flex items-center gap-3 text-ink-2 data-[state=active]:text-ink"
          >
            <span className="tabular-nums">{`0${i + 1} / 0${steps.length}`}</span>
            <span>{t(lang, step.label)}</span>
            {i < current && <span className="text-accent">{t(lang, "progress.done")}</span>}
          </li>
        ))}
      </ol>
      {status && (
        <p role="status" className="text-sm text-ink-2">
          {status}
        </p>
      )}
    </div>
  );
}
