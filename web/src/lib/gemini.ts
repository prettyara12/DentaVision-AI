import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";
import type { Locale } from "@/lib/i18n";

// Prompts and schemas: docs/ai-design.md. Bump the version when a prompt changes.
export const VALIDATE_PROMPT_VERSION = "validate@1";

const VALIDATE_TIMEOUT_MS = 8_000;
const REJECT_MIN_CONFIDENCE = 0.6;

const languageName: Record<Locale, string> = { id: "Indonesian", en: "English" };

const validatePrompt = (locale: Locale) =>
  [
    "You check whether an image is a dental panoramic radiograph (orthopantomogram, OPG).",
    "Answer only with JSON matching the schema.",
    "is_dental_panoramic = true only for a panoramic X-ray showing both jaws.",
    "false for: photos, selfies, screenshots, documents, drawings, non-dental X-rays,",
    "periapical or bitewing X-rays, CT/CBCT slices.",
    `reason: one short sentence in ${languageName[locale]}.`,
  ].join("\n");

const verdictSchema = z.object({
  is_dental_panoramic: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(500),
});

export type XrayVerdict = z.infer<typeof verdictSchema>;

const verdictJsonSchema = z.toJSONSchema(verdictSchema);

let client: GoogleGenAI | undefined;

export function isRejected(verdict: XrayVerdict): boolean {
  return !verdict.is_dental_panoramic && verdict.confidence >= REJECT_MIN_CONFIDENCE;
}

/** Gemini's verdict, or null when Gemini is unavailable (the scan then continues without it). */
export async function validateXray(
  image: Uint8Array,
  mimeType: string,
  locale: Locale,
): Promise<XrayVerdict | null> {
  const { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_FALLBACK_MODEL } = env();
  client ??= new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const signal = AbortSignal.timeout(VALIDATE_TIMEOUT_MS);
  const data = Buffer.from(image).toString("base64");

  for (const model of [GEMINI_MODEL, GEMINI_FALLBACK_MODEL].filter(Boolean) as string[]) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data } }] }],
        config: {
          systemInstruction: validatePrompt(locale),
          responseMimeType: "application/json",
          responseJsonSchema: verdictJsonSchema,
          temperature: 0,
          abortSignal: signal,
        },
      });
      const parsed = verdictSchema.safeParse(JSON.parse(response.text ?? ""));
      return parsed.success ? parsed.data : null;
    } catch (error) {
      // Only a rate limit moves on to the fallback model; anything else skips Gemini.
      if (error instanceof ApiError && error.status === 429) continue;
      return null;
    }
  }
  return null;
}
