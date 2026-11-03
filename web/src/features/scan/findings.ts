import { classCatalog, GROUPS, type ClassInfo, type FindingGroup } from "./class-catalog";
import type { AnalyzeResult } from "./result";

export type Detection = AnalyzeResult["detections"][number];

export type ClassFinding = {
  info: ClassInfo;
  boxes: Detection[];
  /** Highest confidence among the class's boxes. */
  confidence: number;
};

export type GroupFindings = { group: FindingGroup; classes: ClassFinding[] };

/** Boxes at or above `minConfidence`, grouped by catalog group, then class (strongest first). */
export function groupFindings(detections: Detection[], minConfidence: number): GroupFindings[] {
  const byClass = new Map<number, Detection[]>();
  for (const d of detections) {
    if (d.confidence < minConfidence) continue;
    byClass.set(d.class_id, [...(byClass.get(d.class_id) ?? []), d]);
  }
  return GROUPS.map((group) => ({
    group,
    classes: [...byClass]
      .map(([id, boxes]) => ({
        info: classCatalog[id]!,
        boxes,
        confidence: Math.max(...boxes.map((b) => b.confidence)),
      }))
      .filter((c) => c.info.group === group)
      .sort((a, b) => b.confidence - a.confidence),
  }));
}
