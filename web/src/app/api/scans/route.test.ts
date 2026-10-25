import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanEvent } from "@/features/scan/result";
import { readLines } from "@/features/scan/upload";

const validateXray = vi.hoisted(() => vi.fn());
const analyzeImage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/gemini", async () => ({
  validateXray,
  isRejected: (await vi.importActual<typeof import("@/lib/gemini")>("@/lib/gemini")).isRejected,
}));
vi.mock("@/lib/env", () => ({ env: () => ({}) }));
vi.mock("@/lib/inference", () => ({ analyzeImage }));

const { POST } = await import("./route");

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const RESULT = {
  model_version: "yolov8m-resnet50@60bfdce6",
  image: { width: 2048, height: 1024 },
  low_quality: false,
  detections: [],
  heatmaps: {},
  timing_ms: { prefilter: 1, detect: 1, gradcam: 0 },
};

function upload(bytes: Uint8Array<ArrayBuffer>, locale = "en") {
  const body = new FormData();
  body.append("image", new Blob([bytes], { type: "image/jpeg" }), "scan.jpg");
  body.append("locale", locale);
  return new Request("http://web.test/api/scans", { method: "POST", body });
}

async function events(response: Response): Promise<ScanEvent[]> {
  const out: ScanEvent[] = [];
  for await (const event of readLines<ScanEvent>(response.body!)) out.push(event);
  return out;
}

beforeEach(() => {
  validateXray.mockReset();
  analyzeImage.mockReset();
});

describe("POST /api/scans", () => {
  it("rejects bytes that are not JPEG or PNG before calling any provider", async () => {
    const response = await POST(upload(new TextEncoder().encode("GIF89a....")));
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ code: "unsupported_type" });
    expect(validateXray).not.toHaveBeenCalled();
  });

  it("rejects an upload over 4 MB", async () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    big.set(JPEG);
    const response = await POST(upload(big));
    expect(response.status).toBe(413);
    expect(validateXray).not.toHaveBeenCalled();
  });

  it("rejects a declared body over the limit without parsing it", async () => {
    const request = new Request("http://web.test/api/scans", {
      method: "POST",
      headers: { "content-length": String(5 * 1024 * 1024) },
      body: "x",
    });
    expect((await POST(request)).status).toBe(413);
  });

  it("returns 400 without an image field", async () => {
    const body = new FormData();
    body.append("locale", "id");
    const response = await POST(new Request("http://web.test/api/scans", { method: "POST", body }));
    expect(response.status).toBe(400);
  });

  it("streams validating → analyzing → result", async () => {
    validateXray.mockResolvedValue({ is_dental_panoramic: true, confidence: 0.95, reason: "OPG" });
    analyzeImage.mockResolvedValue({ kind: "result", result: RESULT });
    const response = await POST(upload(JPEG, "id"));
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(await events(response)).toEqual([
      { type: "stage", stage: "validating" },
      { type: "stage", stage: "analyzing" },
      { type: "result", result: RESULT },
    ]);
    expect(validateXray).toHaveBeenCalledWith(expect.any(Uint8Array), "image/jpeg", "id");
  });

  it("stops at a confident Gemini rejection and never calls the inference API", async () => {
    validateXray.mockResolvedValue({
      is_dental_panoramic: false,
      confidence: 0.9,
      reason: "Selfie",
    });
    expect(await events(await POST(upload(JPEG)))).toEqual([
      { type: "stage", stage: "validating" },
      { type: "rejected", reason: "Selfie" },
    ]);
    expect(analyzeImage).not.toHaveBeenCalled();
  });

  it("continues without Gemini and uses the API pre-filter as the fallback check", async () => {
    validateXray.mockResolvedValue(null);
    analyzeImage.mockResolvedValue({ kind: "not_xray" });
    expect((await events(await POST(upload(JPEG)))).at(-1)).toEqual({
      type: "rejected",
      reason: null,
    });
  });

  it("does not reject an unsure 'not panoramic'", async () => {
    validateXray.mockResolvedValue({ is_dental_panoramic: false, confidence: 0.4, reason: "?" });
    analyzeImage.mockResolvedValue({ kind: "result", result: RESULT });
    expect((await events(await POST(upload(JPEG)))).at(-1)?.type).toBe("result");
  });

  it("reports inference errors and unexpected failures as events", async () => {
    validateXray.mockResolvedValue(null);
    analyzeImage.mockResolvedValue({ kind: "error", code: "busy" });
    expect((await events(await POST(upload(JPEG)))).at(-1)).toEqual({
      type: "error",
      code: "busy",
    });

    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    analyzeImage.mockRejectedValue(new Error("boom"));
    expect((await events(await POST(upload(JPEG)))).at(-1)).toEqual({
      type: "error",
      code: "unavailable",
    });
    log.mockRestore();
  });

  it("falls back to Indonesian for an unknown locale", async () => {
    validateXray.mockResolvedValue(null);
    analyzeImage.mockResolvedValue({ kind: "result", result: RESULT });
    await events(await POST(upload(JPEG, "fr")));
    expect(validateXray).toHaveBeenCalledWith(expect.any(Uint8Array), "image/jpeg", "id");
  });
});
