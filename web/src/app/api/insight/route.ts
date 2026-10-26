import { z } from "zod";
import {
  findingsContext,
  insightSchema,
  orderFindings,
  partialInsightSchema,
  type InsightEvent,
} from "@/features/insight/insight";
import { parsePartialJson } from "@/features/insight/partial-json";
import { analyzeResultSchema } from "@/features/scan/result";
import { streamInsight } from "@/lib/gemini";
import { locales } from "@/lib/i18n";

// A few hundred detections are ~40 KB of JSON; anything far bigger is not from our UI.
const MAX_BODY_BYTES = 64 * 1024;

const requestSchema = z.object({
  locale: z.enum(locales),
  detections: analyzeResultSchema.shape.detections.max(500),
});

const fail = (status: number, code: string) => Response.json({ code }, { status });

export async function POST(request: Request) {
  // shortcut: no auth or quota yet, both land with #15/#18 (M4); guests are unlimited until then.
  const declared = request.headers.get("content-length");
  if (!declared || !/^\d+$/.test(declared)) return fail(411, "length_required");
  if (Number(declared) > MAX_BODY_BYTES) return fail(413, "too_large");
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "invalid_request");

  const { locale, detections } = body.data;
  const context = findingsContext(detections);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: InsightEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let text = "";
      let last = "";
      try {
        for await (text of streamInsight(context.text, locale, request.signal)) {
          const partial = partialInsightSchema.safeParse(parsePartialJson(text));
          if (!partial.success) continue;
          const insight = {
            ...partial.data,
            findings: orderFindings(partial.data.findings ?? [], context.explainable),
          };
          const serialized = JSON.stringify(insight);
          if (serialized === last) continue;
          last = serialized;
          send({ type: "partial", insight });
        }
        // LLM output is untrusted: only a schema-valid document is kept, and only known classes.
        const done = insightSchema.safeParse(JSON.parse(text));
        if (!done.success) throw new Error("insight does not match the schema");
        send({
          type: "done",
          insight: {
            ...done.data,
            findings: orderFindings(done.data.findings, context.explainable),
          },
        });
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("insight failed:", error instanceof Error ? error.message : "unknown");
          send({ type: "error" });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // the client already went away
        }
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
