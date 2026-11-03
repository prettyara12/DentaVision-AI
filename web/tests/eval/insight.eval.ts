import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { findingsContext, INSIGHT_PROMPT_VERSION, insightSchema } from "@/features/insight/insight";
import { analyzeResultSchema } from "@/features/scan/result";
import { streamInsight } from "@/lib/gemini";
import { locales } from "@/lib/i18n";
import { z } from "zod";

// Reads GEMINI_API_KEY / GEMINI_MODEL from web/.env.local; values are never printed.
try {
  process.loadEnvFile(".env.local");
} catch {
  // fall back to the shell environment
}

const fixtureSchema = z.object({
  locale: z.enum(locales),
  detections: analyzeResultSchema.shape.detections,
});
const dir = join(process.cwd(), "tests/fixtures/insight");
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({
    name: f.replace(/\.json$/, ""),
    ...fixtureSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))),
  }));

const TOOTH_NUMBER = /\b[1-4][1-8]\b/;
// "if you have had a procedure" is fine; "you have a cyst" is a diagnosis.
const DIAGNOSIS = {
  en: /\byou (have|suffer from) (an? )?(cavit|caries|decay|infection|disease|abscess|cyst|tumou?r|lesion)/i,
  id: /\bAnda (menderita|mengidap)\b/i,
};
const LIMITATION = { en: /\bmiss|routine/i, id: /melewatkan|terlewat|rutin/i };

const report: Record<string, string>[] = [];
afterAll(() => console.table(report));

describe.each(fixtures)(
  `${INSIGHT_PROMPT_VERSION} · $name ($locale)`,
  ({ name, locale, detections }) => {
    it("is schema-valid and follows the guardrails", async () => {
      const context = findingsContext(detections);
      let text = "";
      const started = Date.now();
      for await (text of streamInsight(context.text, locale, new AbortController().signal));
      const insight = insightSchema.parse(JSON.parse(text));
      const all = [
        insight.summary,
        ...insight.findings.flatMap((f) => [f.explanation, f.what_to_do]),
        ...insight.questions_for_dentist,
      ].join("\n");

      report.push({
        fixture: name,
        ms: String(Date.now() - started),
        cards: insight.findings.map((f) => f.class_key).join(",") || "-",
        questions: String(insight.questions_for_dentist.length),
        summary: insight.summary.slice(0, 140),
      });
      expect(all).not.toMatch(TOOTH_NUMBER);
      expect(all).not.toMatch(DIAGNOSIS[locale]);
      for (const f of insight.findings) expect(context.explainable).toContain(f.class_key);
      if (context.explainable.length === 0) expect(insight.summary).toMatch(LIMITATION[locale]);
    });
  },
);
