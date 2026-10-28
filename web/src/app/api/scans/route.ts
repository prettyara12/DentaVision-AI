import { saveScanUpload } from "@/features/history/data";
import type { ScanEvent } from "@/features/scan/result";
import { readBody } from "@/lib/body";
import { isRejected, validateXray } from "@/lib/gemini";
import { isLocale } from "@/lib/i18n";
import { analyzeImage } from "@/lib/inference";
import {
  checkQuota,
  consumeQuota,
  getQuotaLimit,
  getQuotaSubject,
  quotaHeaders,
} from "@/lib/quota";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, currentUser } from "@/lib/supabase/server";

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
  // Browsers always send Content-Length for FormData; the cap holds even if it lies (same rule as the API, 411).
  const read = await readBody(request, MAX_BODY_BYTES);
  if ("error" in read) return read.error;
  const form = await read.body.formData().catch(() => null);
  const image = form?.get("image");
  const localeField = form?.get("locale");
  const locale = isLocale(localeField) ? localeField : "id";
  if (!(image instanceof Blob)) return fail(400, "invalid_request");
  if (image.size > MAX_UPLOAD_BYTES) return fail(413, "too_large");

  // Trust the bytes, not the client's Content-Type.
  const bytes = new Uint8Array(await image.arrayBuffer());
  const mimeType = sniff(bytes);
  if (!mimeType) return fail(415, "unsupported_type");

  const saveField = form?.get("save");
  const shouldSave = saveField !== "false";
  const user = await currentUser();
  const supabase = user && shouldSave ? await createClient() : null;

  const subjectInfo = getQuotaSubject(user, request);
  const limit = getQuotaLimit(subjectInfo.role, "scan");
  const adminClient = createAdminClient();
  const quotaCheck = await checkQuota(adminClient, subjectInfo.subject, "scan", limit);
  if (!quotaCheck.ok) {
    return Response.json(
      {
        code: "quota_exceeded",
        resetInSeconds: quotaCheck.resetInSeconds,
        role: subjectInfo.role,
      },
      { status: 429, headers: quotaHeaders(quotaCheck) },
    );
  }

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

        // Daily quota is consumed only if validation succeeds (docs/PRD.md §7).
        const consumed = await consumeQuota(adminClient, subjectInfo.subject, "scan", limit);
        if (!consumed.ok) {
          send({
            type: "error",
            code: "quota_exceeded",
            resetInSeconds: consumed.resetInSeconds,
            role: subjectInfo.role,
          });
          return;
        }

        send({ type: "stage", stage: "analyzing" });
        const outcome = await analyzeImage(new Blob([bytes], { type: mimeType }));
        if (outcome.kind === "result") {
          if (user && shouldSave && supabase) {
            const scanId = crypto.randomUUID();
            await saveScanUpload(supabase, user.id, scanId, bytes, outcome.result);
            send({ type: "result", result: outcome.result, scanId });
          } else {
            send({ type: "result", result: outcome.result });
          }
        }
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
