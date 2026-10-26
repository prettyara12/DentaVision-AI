import { chatRequestSchema, lastTurns, type ChatEvent } from "@/features/chat/chat";
import { findingsContext } from "@/features/insight/insight";
import { streamChat } from "@/lib/gemini";

// 100 messages of history plus up to 500 detections stay well under this.
const MAX_BODY_BYTES = 256 * 1024;

const fail = (status: number, code: string) => Response.json({ code }, { status });

export async function POST(request: Request) {
  // shortcut: no auth or quota yet, both land with #15/#18 (M4); guests are unlimited until then.
  const declared = request.headers.get("content-length");
  if (!declared || !/^\d+$/.test(declared)) return fail(411, "length_required");
  if (Number(declared) > MAX_BODY_BYTES) return fail(413, "too_large");
  const body = chatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "invalid_request");

  const { locale, messages, scan } = body.data;
  const history = lastTurns(messages);
  if (history.at(-1)?.role !== "user") return fail(400, "invalid_request");
  const scanContext = scan && {
    findingsContext: findingsContext(scan.detections).text,
    insightSummary: scan.insightSummary,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let sent = 0;
      try {
        for await (const text of streamChat(locale, scanContext ?? null, history, request.signal)) {
          if (text.length > sent) send({ type: "delta", text: text.slice(sent) });
          sent = text.length;
        }
        if (!sent) throw new Error("empty answer");
        send({ type: "done" });
      } catch (error) {
        if (!request.signal.aborted) {
          // Never log message content (docs/security-privacy.md §1).
          console.error("chat failed:", error instanceof Error ? error.message : "unknown");
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
