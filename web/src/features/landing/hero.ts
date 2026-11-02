import { classCatalog } from "@/features/scan/class-catalog";
import type { Detection } from "@/features/scan/findings";
import { DEFAULT_MIN_CONFIDENCE } from "@/features/scan/result";

const MAX_FINDINGS = 5;

export type HeroFinding = Detection & { index: number };

/**
 * The hero's annotations: the strongest box per class outside the anatomy group, at most five,
 * numbered in sweep order (left to right) so each appears as the scan line reaches it.
 */
export function heroFindings(detections: readonly Detection[]): HeroFinding[] {
  const best = new Map<number, Detection>();
  for (const d of detections) {
    if (d.confidence < DEFAULT_MIN_CONFIDENCE) continue;
    if (classCatalog[d.class_id]?.group === "anatomy") continue;
    const kept = best.get(d.class_id);
    if (!kept || d.confidence > kept.confidence) best.set(d.class_id, d);
  }
  return [...best.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_FINDINGS)
    .sort((a, b) => a.box[0] - b.box[0])
    .map((d, i) => ({ ...d, index: i + 1 }));
}
