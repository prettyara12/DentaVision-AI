import { describe, expect, it } from "vitest";
import { classCatalog, GROUPS, groupInfo } from "./class-catalog";
import { groupFindings } from "./findings";
import { colorize, inferno } from "./heatmap";
import { IDENTITY, boxToScreen, clampView, fitRect, panBy, zoomAt } from "./viewer-math";

// `model.names` of best_resnet50.pt in id order (same list as api/tests/smoke/test_checkpoint.py).
const MODEL_NAMES = [
  "Caries",
  "Crown",
  "Filling",
  "Implant",
  "Malaligned",
  "Mandibular Canal",
  "Missing teeth",
  "Periapical lesion",
  "Retained root",
  "Root Canal Treatment",
  "Root Piece",
  "impacted tooth",
  "maxillary sinus",
  "Bone Loss",
  "Fracture teeth",
  "Permanent Teeth",
  "Supra Eruption",
  "TAD",
  "abutment",
  "attrition",
  "bone defect",
  "gingival former",
  "metal band",
  "orthodontic brackets",
  "permanent retainer",
  "post - core",
  "plating",
  "wire",
  "Cyst",
  "Root resorption",
  "Primary teeth",
];

describe("classCatalog", () => {
  it("matches the model's class order exactly", () => {
    expect(classCatalog.map((c) => c.id)).toEqual([...Array(31).keys()]);
    expect(classCatalog.map((c) => c.modelName)).toEqual(MODEL_NAMES);
  });

  it("has unique keys, a known group, and ID/EN text for every class", () => {
    expect(new Set(classCatalog.map((c) => c.key)).size).toBe(31);
    for (const c of classCatalog) {
      expect(GROUPS).toContain(c.group);
      expect(c.name.id && c.name.en && c.description.id && c.description.en).toBeTruthy();
    }
  });

  it("hides only normal anatomy by default", () => {
    expect(GROUPS.filter((g) => !groupInfo[g].visibleByDefault)).toEqual(["anatomy"]);
  });
});

describe("groupFindings", () => {
  const box = [0.1, 0.1, 0.2, 0.2] as [number, number, number, number];
  const detections = [
    { class_id: 0, confidence: 0.3, box },
    { class_id: 0, confidence: 0.71, box },
    { class_id: 7, confidence: 0.9, box },
    { class_id: 2, confidence: 0.24, box },
    { class_id: 12, confidence: 0.5, box },
  ];

  it("drops boxes under the threshold and groups the rest by class", () => {
    const [attention, treatment, anatomy] = groupFindings(detections, 0.25);
    expect(attention?.classes.map((c) => [c.info.key, c.confidence, c.boxes.length])).toEqual([
      ["periapical_lesion", 0.9, 1],
      ["caries", 0.71, 2],
    ]);
    expect(treatment?.classes).toEqual([]);
    expect(anatomy?.classes.map((c) => c.info.key)).toEqual(["maxillary_sinus"]);
  });

  it("keeps the threshold inclusive", () => {
    expect(groupFindings(detections, 0.24)[1]?.classes.map((c) => c.info.key)).toEqual(["filling"]);
  });
});

describe("viewer math", () => {
  const fit = fitRect(1000, 600, 2048, 1024);

  it("fits the image inside the container, centred", () => {
    expect(fit).toEqual({ left: 0, top: 50, width: 1000, height: 500 });
  });

  it("maps a box to screen space and follows zoom and pan", () => {
    expect(boxToScreen([0.5, 0.5, 1, 1], fit, IDENTITY)).toEqual({
      left: 500,
      top: 300,
      width: 500,
      height: 250,
    });
    const zoomed = { scale: 2, x: -500, y: -250 };
    expect(boxToScreen([0.5, 0.5, 1, 1], fit, zoomed)).toEqual({
      left: 500,
      top: 300,
      width: 1000,
      height: 500,
    });
  });

  it("keeps the point under the cursor fixed while zooming", () => {
    const view = zoomAt(IDENTITY, fit, 2, 250, 175);
    const before = boxToScreen([0.25, 0.25, 0.25, 0.25], fit, IDENTITY);
    const after = boxToScreen([0.25, 0.25, 0.25, 0.25], fit, view);
    expect([after.left, after.top]).toEqual([before.left, before.top]);
  });

  it("clamps zoom to 1–8x and never lets the image leave its frame", () => {
    expect(zoomAt(IDENTITY, fit, 0.5, 0, 0)).toEqual(IDENTITY);
    expect(zoomAt(IDENTITY, fit, 100, 0, 50).scale).toBe(8);
    expect(panBy(IDENTITY, fit, 300, 300)).toEqual(IDENTITY);
    expect(clampView({ scale: 2, x: -5000, y: 10 }, fit)).toEqual({ scale: 2, x: -1000, y: 0 });
  });
});

describe("heatmap colormap", () => {
  it("runs inferno from near-black to pale yellow", () => {
    expect(inferno(0)).toEqual([0, 0, 4]);
    expect(inferno(255)).toEqual([252, 255, 164]);
    expect(inferno(-5)).toEqual(inferno(0));
  });

  it("colours grayscale pixels with alpha rising with intensity", () => {
    const px = colorize(
      new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]),
    );
    expect([px[3], px[7], px[11]]).toEqual([0, 128, 255]);
    expect([...px.slice(8, 11)]).toEqual(inferno(255));
  });
});
