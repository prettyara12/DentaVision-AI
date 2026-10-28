import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyzeResult } from "@/features/scan/result";

const currentUser = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const saveScanImport = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  currentUser,
  createClient,
}));
vi.mock("@/features/history/data", () => ({
  saveScanImport,
}));

const { POST } = await import("./route");

const JPEG_HEADER = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="; // minimal JPEG magic bytes in base64

const sampleResult: AnalyzeResult = {
  model_version: "yolov8m-dentavision-v1.0",
  image: { width: 1024, height: 512 },
  low_quality: false,
  detections: [{ class_id: 0, confidence: 0.95, box: [10, 20, 100, 200] }],
  heatmaps: {
    "0": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  },
  timing_ms: { prefilter: 5, detect: 50, gradcam: 30 },
};

function post(body: unknown, headers: Record<string, string> = {}) {
  const text = JSON.stringify(body);
  return POST(
    new Request("http://test/api/scans/import", {
      method: "POST",
      body: text,
      headers: {
        "content-type": "application/json",
        "content-length": String(text.length),
        ...headers,
      },
    }),
  );
}

beforeEach(() => {
  currentUser.mockReset().mockResolvedValue(null);
  createClient.mockReset();
  saveScanImport.mockReset();
});

describe("POST /api/scans/import", () => {
  it("returns 401 when user is not authenticated", async () => {
    const response = await post({
      image: JPEG_HEADER,
      result: sampleResult,
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "unauthorized" });
  });

  it("returns 400 when body does not match schema", async () => {
    currentUser.mockResolvedValue({ id: "user-123" });
    const response = await post({ image: "" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "invalid_request" });
  });

  it("returns 415 when image magic bytes are not JPEG or PNG", async () => {
    currentUser.mockResolvedValue({ id: "user-123" });
    const gifBase64 =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const response = await post({
      image: gifBase64,
      result: sampleResult,
    });
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ code: "unsupported_type" });
  });

  it("successfully imports scan and returns scanId", async () => {
    currentUser.mockResolvedValue({ id: "user-123" });
    createClient.mockResolvedValue({ client: "supabase" });
    saveScanImport.mockResolvedValue(undefined);

    const response = await post({
      image: JPEG_HEADER,
      result: sampleResult,
      chat: [{ role: "user", text: "Halo" }],
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("scanId");
    expect(typeof data.scanId).toBe("string");
    expect(saveScanImport).toHaveBeenCalledWith(
      { client: "supabase" },
      "user-123",
      data.scanId,
      expect.objectContaining({
        result: sampleResult,
        chat: [{ role: "user", text: "Halo" }],
      }),
    );
  });

  it("returns 500 when saveScanImport throws error", async () => {
    currentUser.mockResolvedValue({ id: "user-123" });
    createClient.mockResolvedValue({ client: "supabase" });
    saveScanImport.mockRejectedValue(new Error("Storage disk error"));

    const response = await post({
      image: JPEG_HEADER,
      result: sampleResult,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "database_error" });
  });
});
