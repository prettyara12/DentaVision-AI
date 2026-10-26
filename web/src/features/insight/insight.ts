import { z } from "zod";
import { groupFindings, type Detection } from "@/features/scan/findings";

// docs/ai-design.md §2–3. Bump the version when the prompt or the context format changes.
export const INSIGHT_PROMPT_VERSION = "insight@1";
export const CONTEXT_MIN_CONFIDENCE = 0.25;

export const insightSchema = z.object({
  summary: z.string().max(1500),
  findings: z
    .array(
      z.object({
        class_key: z.string().max(40),
        explanation: z.string().max(800),
        what_to_do: z.string().max(400),
      }),
    )
    .max(31),
  questions_for_dentist: z.array(z.string().max(400)).max(5),
});

export type Insight = z.infer<typeof insightSchema>;
export type InsightFinding = Insight["findings"][number];

/** What the UI may show while the JSON is still streaming: every field optional. */
export const partialInsightSchema = z.object({
  summary: z.string().max(1500).optional(),
  findings: z
    .array(
      z.object({
        class_key: z.string().max(40).optional(),
        explanation: z.string().max(800).optional(),
        what_to_do: z.string().max(400).optional(),
      }),
    )
    .max(31)
    .optional(),
  questions_for_dentist: z.array(z.string().max(400)).max(5).optional(),
});

export type PartialInsight = z.infer<typeof partialInsightSchema>;

export type InsightEvent =
  | { type: "partial"; insight: PartialInsight }
  | { type: "done"; insight: Insight }
  | { type: "error" };

export type FindingsContext = {
  text: string;
  /** Classes the insight may explain (attention, then treatment), in the order the UI shows them. */
  explainable: string[];
};

// Panoramic X-rays are shown as if facing the patient: the left of the image is the patient's right.
function area([x1 = 0, y1 = 0, x2 = 0, y2 = 0]: readonly number[]): string {
  const jaw = (y1 + y2) / 2 < 0.5 ? "upper" : "lower";
  const side = (x1 + x2) / 2 < 0.5 ? "right" : "left";
  return `${jaw}-${side}`;
}

/** Text-only findings context for Gemini (docs/ai-design.md §2). No image ever goes into it. */
export function findingsContext(detections: Detection[]): FindingsContext {
  const groups = groupFindings(detections, CONTEXT_MIN_CONFIDENCE);
  const lines = groups.flatMap(({ group, classes }) =>
    classes.map(({ info, boxes, confidence }) =>
      group === "anatomy"
        ? `- [anatomy] ${info.modelName} (hidden from user by default)`
        : `- [${group}] ${info.modelName} (key: ${info.key}), ${boxes.length} ${
            boxes.length === 1 ? "box" : "boxes"
          }, max confidence ${confidence.toFixed(2)}, areas: ${[...new Set(boxes.map((b) => area(b.box)))].sort().join(", ")}`,
    ),
  );
  return {
    text: [
      "Findings (model: yolov8m-resnet50, recall ~0.39, may miss findings):",
      ...(lines.length ? lines : [`- none at confidence >= ${CONTEXT_MIN_CONFIDENCE}`]),
    ].join("\n"),
    explainable: groups
      .filter((g) => g.group !== "anatomy")
      .flatMap((g) => g.classes.map((c) => c.info.key)),
  };
}

/** Keeps only cards for classes in the context, once each, in the code's order (LLM order is ignored). */
export function orderFindings<T extends { class_key?: string }>(
  findings: T[],
  explainable: string[],
): T[] {
  const seen = new Set<string>();
  return findings
    .filter(
      (f) =>
        f.class_key &&
        explainable.includes(f.class_key) &&
        !seen.has(f.class_key) &&
        seen.add(f.class_key),
    )
    .sort((a, b) => explainable.indexOf(a.class_key!) - explainable.indexOf(b.class_key!));
}

/** Text that has reached the end of a sentence, so streaming reveals whole sentences only. */
export function completeSentences(text: string): string {
  return text.match(/^[\s\S]*[.!?](?=\s|$)/)?.[0] ?? "";
}
