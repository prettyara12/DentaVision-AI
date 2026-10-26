import { z } from "zod";
import { CONTEXT_MIN_CONFIDENCE, insightSchema } from "@/features/insight/insight";
import { groupFindings, type Detection } from "@/features/scan/findings";
import { analyzeResultSchema } from "@/features/scan/result";
import { locales, t, type Locale } from "@/lib/i18n";
import { chatMessageSchema, type ChatMessage } from "./message";

// docs/ai-design.md §4.
export const MAX_HISTORY = 20;

export const chatRequestSchema = z.object({
  locale: z.enum(locales),
  messages: z.array(chatMessageSchema).min(1).max(100),
  /** Present for chat about a scan: the findings (text only) and the insight summary, if any. */
  scan: z
    .object({
      detections: analyzeResultSchema.shape.detections.max(500),
      insightSummary: insightSchema.shape.summary.optional(),
    })
    .optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type ChatEvent = { type: "delta"; text: string } | { type: "done" } | { type: "error" };

/** The last 20 messages, starting at a user turn (Gemini expects the user to speak first). */
export function lastTurns(messages: ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-MAX_HISTORY);
  const firstUser = recent.findIndex((m) => m.role === "user");
  return firstUser === -1 ? [] : recent.slice(firstUser);
}

/** Three starter questions from templates per group (no LLM call, so instant and free). */
export function suggestions(lang: Locale, detections: Detection[] | null): string[] {
  const groups = detections ? groupFindings(detections, CONTEXT_MIN_CONFIDENCE) : [];
  const top = (group: "attention" | "treatment") =>
    groups.find((g) => g.group === group)?.classes[0]?.info.name[lang];
  const attention = top("attention");
  const treatment = top("treatment");
  return [
    attention && t(lang, "chat.suggest.attention").replace("{name}", attention),
    treatment && t(lang, "chat.suggest.treatment").replace("{name}", treatment),
    detections ? t(lang, "chat.suggest.xray") : t(lang, "chat.suggest.brushing"),
    t(lang, "chat.suggest.checkup"),
    detections ? t(lang, "chat.suggest.brushing") : t(lang, "chat.suggest.xray"),
  ]
    .filter((q): q is string => Boolean(q))
    .filter((q, i, all) => all.indexOf(q) === i)
    .slice(0, 3);
}
