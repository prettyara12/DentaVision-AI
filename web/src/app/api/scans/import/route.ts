import { z } from "zod";
import { chatMessageSchema } from "@/features/chat/message";
import { saveScanImport } from "@/features/history/data";
import { insightSchema } from "@/features/insight/insight";
import { analyzeResultSchema } from "@/features/scan/result";
import { readBody } from "@/lib/body";
import { locales } from "@/lib/i18n";
import { createClient, currentUser } from "@/lib/supabase/server";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
// Encoded base64 is ~1.33x original size + metadata
const MAX_BODY_BYTES = 8 * 1024 * 1024;

const signatures: [string, number[]][] = [
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
];

function sniff(bytes: Uint8Array): string | null {
  const match = signatures.find(([, magic]) => magic.every((b, i) => bytes[i] === b));
  return match?.[0] ?? null;
}

const importSchema = z.object({
  image: z.string().min(1),
  result: analyzeResultSchema,
  insight: z
    .object({
      locale: z.enum(locales),
      version: z.string(),
      data: insightSchema,
    })
    .optional(),
  chat: z.array(chatMessageSchema).optional(),
});

const fail = (status: number, code: string) => Response.json({ code }, { status });

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return fail(401, "unauthorized");
  }

  const read = await readBody(request, MAX_BODY_BYTES);
  if ("error" in read) return read.error;

  const parsed = importSchema.safeParse(await read.body.json().catch(() => null));
  if (!parsed.success) {
    return fail(400, "invalid_request");
  }

  const { image, result, insight, chat } = parsed.data;

  // Extract base64 payload from data URL or raw string
  const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
  let imageBytes: Buffer;
  try {
    imageBytes = Buffer.from(base64Data, "base64");
  } catch {
    return fail(400, "invalid_request");
  }

  if (imageBytes.length === 0) {
    return fail(400, "invalid_request");
  }

  if (imageBytes.length > MAX_UPLOAD_BYTES) {
    return fail(413, "too_large");
  }

  const mimeType = sniff(imageBytes);
  if (!mimeType) {
    return fail(415, "unsupported_type");
  }

  const supabase = await createClient();
  const scanId = crypto.randomUUID();

  try {
    await saveScanImport(supabase, user.id, scanId, {
      imageBytes,
      result,
      insight,
      chat,
    });
    return Response.json({ scanId }, { status: 200 });
  } catch (error) {
    console.error("POST /api/scans/import failed:", error);
    return fail(500, "database_error");
  }
}
