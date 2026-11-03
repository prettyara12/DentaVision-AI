import "server-only";
import {
  analyzeResultSchema,
  type AnalyzeResult,
  type ScanErrorCode,
} from "@/features/scan/result";
import { env } from "@/lib/env";

export type AnalyzeOutcome =
  | { kind: "result"; result: AnalyzeResult }
  | { kind: "not_xray" }
  | { kind: "error"; code: ScanErrorCode };

export type InferenceStatus = "ready" | "loading" | "error" | "waking";

// Covers the API's 60 s queue wait plus inference and Grad-CAM on a free CPU.
const ANALYZE_TIMEOUT_MS = 120_000;
const HEALTH_TIMEOUT_MS = 3_000;

export async function analyzeImage(image: Blob): Promise<AnalyzeOutcome> {
  const { INFERENCE_API_URL, INFERENCE_API_SECRET } = env();
  const body = new FormData();
  body.append("image", image, "scan.jpg");

  let response: Response;
  try {
    // A FormData of Blobs is sent with Content-Length, which the API requires (411 otherwise).
    response = await fetch(new URL("/v1/analyze", INFERENCE_API_URL), {
      method: "POST",
      headers: { "X-API-Secret": INFERENCE_API_SECRET },
      body,
      signal: AbortSignal.timeout(ANALYZE_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { kind: "error", code: "unavailable" };
  }

  if (response.ok) {
    const parsed = analyzeResultSchema.safeParse(await response.json().catch(() => null));
    return parsed.success
      ? { kind: "result", result: parsed.data }
      : { kind: "error", code: "unavailable" };
  }

  const code = await response
    .json()
    .then((b: { code?: unknown }) => b.code)
    .catch(() => undefined);
  if (response.status === 422 && code === "not_xray") return { kind: "not_xray" };
  if (response.status === 413) return { kind: "error", code: "too_large" };
  if (response.status === 415) return { kind: "error", code: "unsupported_type" };
  if (response.status === 503 && (code === "busy" || code === "loading")) {
    return { kind: "error", code };
  }
  if (response.status === 401) console.error("Inference API rejected INFERENCE_API_SECRET");
  return { kind: "error", code: "unavailable" };
}

export async function inferenceStatus(): Promise<InferenceStatus> {
  try {
    const response = await fetch(new URL("/health", env().INFERENCE_API_URL), {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      cache: "no-store",
    });
    // A sleeping HF Space answers with its own 503 page while the container boots.
    if (!response.ok) return "waking";
    const { status } = (await response.json()) as { status?: unknown };
    return status === "ready" || status === "loading" || status === "error" ? status : "waking";
  } catch {
    return "waking";
  }
}
