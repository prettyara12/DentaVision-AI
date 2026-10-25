"use client";

import { classCatalog, groupInfo } from "@/features/scan/class-catalog";
import { t, type Locale } from "@/lib/i18n";
import { completeSentences } from "./insight";
import type { InsightState } from "./use-insight";

type Props = {
  lang: Locale;
  state: InsightState;
  /** No attention findings: the model's limits are stated by code, not left to the LLM (PRD §9). */
  noAttention: boolean;
  onGenerate: (locale: Locale) => void;
};

const byKey = new Map(classCatalog.map((c) => [c.key, c]));
const heading = "font-mono text-xs tracking-[0.06em] text-ink-2 uppercase";

/** Gemini's insight as plain text (never HTML). Urgency and colour come from the class catalog. */
export function InsightPanel({ lang, state, noAttention, onGenerate }: Props) {
  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{t(lang, "insight.unavailable")}</p>
        <button
          type="button"
          onClick={() => onGenerate(lang)}
          className="min-h-11 rounded-sm border border-rule px-4 text-sm font-medium"
        >
          {t(lang, "action.retry")}
        </button>
      </div>
    );
  }

  const done = state.status === "done";
  // While streaming, show whole sentences only (design-system §4, "Insight streaming").
  const text = (value = "") => (done ? value : completeSentences(value));
  const summary = text(state.insight.summary);
  const cards = (state.insight.findings ?? []).flatMap((f) => {
    const info = f.class_key ? byKey.get(f.class_key) : undefined;
    const explanation = text(f.explanation);
    return info && explanation ? [{ info, explanation, whatToDo: text(f.what_to_do) }] : [];
  });
  // The last question may still be arriving.
  const questions = (state.insight.questions_for_dentist ?? []).slice(0, done ? undefined : -1);

  return (
    <div aria-live="polite" aria-busy={!done} className="flex flex-col gap-6">
      {!summary && !done && (
        <p role="status" className="text-sm text-ink-2">
          {t(lang, "insight.loading")}
        </p>
      )}
      {summary && <p className="leading-relaxed">{summary}</p>}
      {done && noAttention && <p className="text-sm text-ink-2">{t(lang, "findings.limits")}</p>}
      {cards.length > 0 && (
        <ul className="flex flex-col gap-3">
          {cards.map(({ info, explanation, whatToDo }, i) => (
            <li
              key={info.key}
              className="insight-rise flex flex-col gap-2 rounded-md border border-rule bg-surface p-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: groupInfo[info.group].color }}
                />
                {info.name[lang]}
                <span className="font-mono text-xs font-normal text-ink-2">
                  {groupInfo[info.group].label[lang]}
                </span>
              </p>
              <p className="text-sm leading-relaxed">{explanation}</p>
              {whatToDo && (
                <p className="text-sm leading-relaxed text-ink-2">
                  <span className="text-ink">{t(lang, "insight.what_to_do")}:</span> {whatToDo}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {questions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className={heading}>{t(lang, "insight.questions")}</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
      )}
      {done && (
        <div className="flex flex-col items-start gap-3 border-t border-rule pt-4 text-xs text-ink-2">
          <p>{t(lang, "insight.source")}</p>
          <p>{t(lang, "disclaimer.short")}</p>
          {state.locale !== lang && (
            <button
              type="button"
              onClick={() => onGenerate(lang)}
              className="min-h-11 rounded-sm border border-rule px-4 text-sm font-medium text-ink"
            >
              {t(lang, "insight.regenerate")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
