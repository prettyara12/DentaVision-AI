import { z } from "zod";

// Contract of api/ POST /v1/analyze (docs/architecture.md §3.1). Checked at the web server boundary.
export const analyzeResultSchema = z.object({
  model_version: z.string(),
  image: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  low_quality: z.boolean(),
  detections: z.array(
    z.object({
      class_id: z.number().int().min(0).max(30),
      confidence: z.number().min(0).max(1),
      box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    }),
  ),
  heatmaps: z.record(z.string(), z.string()),
  timing_ms: z.record(z.string(), z.number()),
});

export type AnalyzeResult = z.infer<typeof analyzeResultSchema>;

export type ScanErrorCode = "busy" | "loading" | "unavailable" | "too_large" | "unsupported_type";

// One JSON object per line from POST /api/scans, in the order the server reaches each stage.
export type ScanEvent =
  | { type: "stage"; stage: "validating" | "analyzing" }
  | { type: "rejected"; reason: string | null }
  | { type: "result"; result: AnalyzeResult }
  | { type: "error"; code: ScanErrorCode };

// Guest results live only in this tab (docs/user-flows.md §2).
export const SCAN_STORAGE_KEY = "dentavision:scan";

export const storedScanSchema = z.object({ image: z.string(), result: analyzeResultSchema });

export type StoredScan = z.infer<typeof storedScanSchema>;

// UI default threshold (docs/PRD.md §7.3).
export const DEFAULT_MIN_CONFIDENCE = 0.25;
