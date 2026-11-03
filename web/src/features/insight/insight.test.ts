import { describe, expect, it } from "vitest";
import { completeSentences, findingsContext, orderFindings } from "./insight";
import { parsePartialJson } from "./partial-json";

describe("parsePartialJson", () => {
  const doc = JSON.stringify({
    summary: 'The AI marked "two" areas.\nSee below.',
    findings: [{ class_key: "caries", explanation: "Decay.", what_to_do: "See a dentist." }],
    questions_for_dentist: ["Q1?", "Q2?"],
    n: 12,
    ok: true,
  });

  it("returns undefined before anything usable arrived", () => {
    expect(parsePartialJson("")).toBeUndefined();
    expect(parsePartialJson("  ")).toBeUndefined();
  });

  it("parses every prefix without throwing and ends at the full document", () => {
    for (let i = 1; i <= doc.length; i++) {
      const value = parsePartialJson(doc.slice(0, i));
      expect(value === undefined || typeof value === "object").toBe(true);
    }
    expect(parsePartialJson(doc)).toEqual(JSON.parse(doc));
  });

  it("closes an unfinished string value but not an unfinished key", () => {
    expect(parsePartialJson('{"summary": "The AI mar')).toEqual({ summary: "The AI mar" });
    expect(parsePartialJson('{"summary": "Done.", "find')).toEqual({ summary: "Done." });
    expect(parsePartialJson('{"findings": [{"class_key": "car')).toEqual({
      findings: [{ class_key: "car" }],
    });
  });

  it("drops a dangling escape instead of breaking the string", () => {
    expect(parsePartialJson('{"summary": "a \\')).toEqual({ summary: "a " });
    expect(parsePartialJson('{"summary": "a \\u00')).toEqual({ summary: "a " });
  });

  it("waits for a number or literal to finish", () => {
    expect(parsePartialJson('{"a": "x", "n": 1')).toEqual({ a: "x" });
    expect(parsePartialJson('{"a": "x", "n": 12,')).toEqual({ a: "x", n: 12 });
  });
});

describe("findingsContext", () => {
  const det = (class_id: number, confidence: number, box: number[]) => ({
    class_id,
    confidence,
    box: box as [number, number, number, number],
  });

  it("lists classes by group with areas from the patient's point of view", () => {
    const context = findingsContext([
      det(0, 0.71, [0.1, 0.6, 0.2, 0.8]), // image left, lower jaw = patient's lower-right
      det(0, 0.4, [0.7, 0.6, 0.8, 0.8]),
      det(2, 0.88, [0.1, 0.1, 0.2, 0.3]),
      det(15, 0.5, [0, 0, 1, 1]),
      det(7, 0.2, [0.5, 0.5, 0.6, 0.6]), // below 0.25: left out
    ]);
    expect(context.text).toBe(
      [
        "Findings (model: yolov8m-resnet50, recall ~0.39, may miss findings):",
        "- [attention] Caries (key: caries), 2 boxes, max confidence 0.71, areas: lower-left, lower-right",
        "- [treatment] Filling (key: filling), 1 box, max confidence 0.88, areas: upper-right",
        "- [anatomy] Permanent Teeth (hidden from user by default)",
      ].join("\n"),
    );
    expect(context.explainable).toEqual(["caries", "filling"]);
  });

  it("says so when nothing reaches the threshold", () => {
    const context = findingsContext([det(0, 0.1, [0, 0, 1, 1])]);
    expect(context.text).toContain("- none at confidence >= 0.25");
    expect(context.explainable).toEqual([]);
  });
});

describe("orderFindings", () => {
  it("keeps known classes once, in the code's order", () => {
    const cards = [
      { class_key: "filling" },
      { class_key: "cancer" },
      { class_key: "caries" },
      { class_key: "filling" },
      {},
    ];
    expect(orderFindings(cards, ["caries", "filling"])).toEqual([
      { class_key: "caries" },
      { class_key: "filling" },
    ]);
  });
});

describe("completeSentences", () => {
  it("reveals only finished sentences", () => {
    expect(completeSentences("The AI marked two areas. One may")).toBe("The AI marked two areas.");
    expect(completeSentences("Confidence 0.71 is")).toBe("");
    expect(completeSentences("Done!")).toBe("Done!");
  });
});
