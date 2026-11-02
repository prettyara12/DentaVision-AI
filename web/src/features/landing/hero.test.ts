import { describe, expect, it } from "vitest";
import restorations from "@/features/scan/samples/restorations.json";
import { heroFindings } from "./hero";

const box = (x: number): [number, number, number, number] => [x, 0.4, x + 0.05, 0.5];

describe("heroFindings", () => {
  it("keeps the strongest box per class, drops anatomy and weak boxes, numbers left to right", () => {
    const found = heroFindings([
      { class_id: 1, confidence: 0.6, box: box(0.7) }, // crown, weaker duplicate
      { class_id: 1, confidence: 0.9, box: box(0.5) }, // crown, kept
      { class_id: 0, confidence: 0.3, box: box(0.2) }, // caries
      { class_id: 15, confidence: 0.99, box: box(0.1) }, // permanent teeth: anatomy
      { class_id: 9, confidence: 0.2, box: box(0.3) }, // under the 0.25 filter
    ]);
    expect(found.map((f) => [f.index, f.class_id, f.confidence])).toEqual([
      [1, 0, 0.3],
      [2, 1, 0.9],
    ]);
  });

  it("shows at most five findings, the most confident ones", () => {
    // Classes 0–4, 6, 7: none is anatomy (5 is).
    const many = [0, 1, 2, 3, 4, 6, 7].map((id, i) => ({
      class_id: id,
      confidence: 0.3 + i * 0.05,
      box: box(0.9 - i * 0.1),
    }));
    // Most confident five, then left to right (higher i sits further left).
    expect(heroFindings(many).map((f) => f.class_id)).toEqual([7, 6, 4, 3, 2]);
  });

  it("annotates the landing sample", () => {
    expect(heroFindings(restorations.detections as never).length).toBeGreaterThan(0);
  });
});
