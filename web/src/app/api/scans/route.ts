import type { ScanEvent } from "@/features/scan/result";
import { isRejected, validateXray } from "@/lib/gemini";
import { isLocale } from "@/lib/i18n";
import { analyzeImage } from "@/lib/inference";

// Compressed upload limit (docs/architecture.md §4.2); the browser keeps the original ≤ 10 MB.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

const signatures: [string, number[]][] = [
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
];

function sniff(bytes: Uint8Array): string | null {
  const match = signatures.find(([, magic]) => magic.every((b, i) => bytes[i] === b));
  return match?.[0] ?? null;
}

const fail = (status: number, code: string) => Response.json({ code }, { status });

export async function POST(request: Request) {
  // shortcut: no auth or quota yet, both land with #15/#18 (M4); guests are unlimited until then.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return fail(413, "too_large");
  }
  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  const localeField = form?.get("locale");
  const locale = isLocale(localeField) ? localeField : "id";
  if (!(image instanceof Blob)) return fail(400, "invalid_request");
  if (image.size > MAX_UPLOAD_BYTES) return fail(413, "too_large");

  // Trust the bytes, not the client's Content-Type.
  const bytes = new Uint8Array(await image.arrayBuffer());
  const mimeType = sniff(bytes);
  if (!mimeType) return fail(415, "unsupported_type");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ScanEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        send({ type: "stage", stage: "validating" });
        const verdict = await validateXray(bytes, mimeType, locale);
        if (verdict && isRejected(verdict)) {
          send({ type: "rejected", reason: verdict.reason });
          return;
        }

        send({ type: "stage", stage: "analyzing" });
        const outcome = await analyzeImage(new Blob([bytes], { type: mimeType }));
        if (outcome.kind === "result") send({ type: "result", result: outcome.result });
        // The API's colour pre-filter is the fallback check when Gemini is unavailable.
        else if (outcome.kind === "not_xray") send({ type: "rejected", reason: null });
        else send({ type: "error", code: outcome.code });
      } catch (error) {
        console.error("POST /api/scans failed", error);
        send({ type: "error", code: "unavailable" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
