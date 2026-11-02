import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanEvent } from "@/features/scan/result";
import { readLines } from "@/features/scan/upload";

const validateXray = vi.hoisted(() => vi.fn());
const analyzeImage = vi.hoisted(() => vi.fn());
const currentUser = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const saveScanUpload = vi.hoisted(() => vi.fn());
const deleteScan = vi.hoisted(() => vi.fn());
const checkQuota = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ok: true, limit: 5, remaining: 5, resetInSeconds: 3600 }),
);
const consumeQuota = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ok: true, limit: 5, resetInSeconds: 3600 }),
);
const getQuotaSubject = vi.hoisted(() =>
  vi.fn().mockReturnValue({ subject: "ip:test", role: "guest" }),
);
const getQuotaLimit = vi.hoisted(() => vi.fn().mockReturnValue(5));
const quotaHeaders = vi.hoisted(() => vi.fn().mockReturnValue({ "RateLimit-Limit": "5" }));
const createAdminClient = vi.hoisted(() => vi.fn().mockReturnValue({}));

vi.mock("@/lib/gemini", async () => ({
  validateXray,
  isRejected: (await vi.importActual<typeof import("@/lib/gemini")>("@/lib/gemini")).isRejected,
}));
vi.mock("@/lib/env", () => ({ env: () => ({}) }));
vi.mock("@/lib/inference", () => ({ analyzeImage }));
vi.mock("@/lib/supabase/server", () => ({
  currentUser,
  createClient,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}));
vi.mock("@/lib/quota", () => ({
  checkQuota,
  consumeQuota,
  getQuotaSubject,
  getQuotaLimit,
  quotaHeaders,
}));
vi.mock("@/features/history/data", () => ({
  saveScanUpload,
  deleteScan,
}));

const { POST } = await import("./route");

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const RESULT = {
  model_version: "yolov8m-resnet50@60bfdce6",
  image: { width: 2048, height: 1024 },
  low_quality: false,
  detections: [],
  heatmaps: {},
  timing_ms: { prefilter: 1, detect: 1, gradcam: 0 },
};

// Like a browser: a FormData upload carries Content-Length (a bare `new Request` does not set it).
async function multipart(body: FormData, headers: Record<string, string> = {}) {
  const encoded = new Response(body);
  const bytes = await encoded.arrayBuffer();
  return new Request("http://web.test/api/scans", {
    method: "POST",
    body: bytes,
    headers: {
      "content-type": encoded.headers.get("content-type")!,
      "content-length": String(bytes.byteLength),
      ...headers,
    },
  });
}

function upload(bytes: Uint8Array<ArrayBuffer>, locale = "en", headers?: Record<string, string>) {
  const body = new FormData();
  body.append("image", new Blob([bytes], { type: "image/jpeg" }), "scan.jpg");
  body.append("locale", locale);
  return multipart(body, headers);
}

async function events(response: Response): Promise<ScanEvent[]> {
  const out: ScanEvent[] = [];
  for await (const event of readLines<ScanEvent>(response.body!)) out.push(event);
  return out;
}

beforeEach(() => {
  validateXray.mockReset();
  analyzeImage.mockReset();
  currentUser.mockReset().mockResolvedValue(null);
  createClient.mockReset();
  saveScanUpload.mockReset();
  deleteScan.mockReset().mockResolvedValue({ ok: true });
  checkQuota
    .mockReset()
    .mockResolvedValue({ ok: true, limit: 5, remaining: 5, resetInSeconds: 3600 });
  consumeQuota.mockReset().mockResolvedValue({ ok: true, limit: 5, resetInSeconds: 3600 });
});

describe("POST /api/scans", () => {
  it("rejects bytes that are not JPEG or PNG before calling any provider", async () => {
    const response = await POST(await upload(new TextEncoder().encode("GIF89a....")));
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ code: "unsupported_type" });
    expect(validateXray).not.toHaveBeenCalled();
  });

  it("rejects an upload over 4 MB", async () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    big.set(JPEG);
    const response = await POST(await upload(big));
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
    const response = await POST(await multipart(body));
    expect(response.status).toBe(400);
  });

  it.each([
    ["missing", undefined],
    ["not a number", "abc"],
    ["negative", "-1"],
  ])("requires a Content-Length before parsing the body (%s)", async (_, value) => {
    const body = new ReadableStream<Uint8Array>({
      pull: () => expect.unreachable("body was read"),
    });
    const request = new Request("http://web.test/api/scans", {
      method: "POST",
      body,
      headers: {
        "content-type": "multipart/form-data; boundary=x",
        ...(value ? { "content-length": value } : {}),
      },
      duplex: "half",
    } as RequestInit);
    const response = await POST(request);
    expect(response.status).toBe(411);
    expect(await response.json()).toEqual({ code: "length_required" });
    expect(validateXray).not.toHaveBeenCalled();
  });

  it("streams validating → analyzing → result", async () => {
    validateXray.mockResolvedValue({ is_dental_panoramic: true, confidence: 0.95, reason: "OPG" });
    analyzeImage.mockResolvedValue({ kind: "result", result: RESULT });
    const response = await POST(await upload(JPEG, "id"));
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
    expect(await events(await POST(await upload(JPEG)))).toEqual([
      { type: "stage", stage: "validating" },
      { type: "rejected", reason: "Selfie" },
    ]);
    expect(analyzeImage).not.toHaveBeenCalled();
  });

  it("continues without Gemini and uses the API pre-filter as the fallback check", async () => {
    validateXray.mockResolvedValue(null);
    analyzeImage.mockResolvedValue({ kind: "not_xray" });
    expect((await events(await POST(await upload(JPEG)))).at(-1)).toEqual({
      type: "rejected",
      reason: null,
    });
  });

  it("does not reject an unsure 'not panoramic'", async () => {
    validateXray.mockResolvedValue({ is_dental_panoramic: false, confidence: 0.4, reason: "?" });
    analyzeImage.mockResolvedValue({ kind: "result", result: RESULT });
    expect((await events(await POST(await upload(JPEG)))).at(-1)?.type).toBe("result");
  });

  it("reports inference errors and unexpected failures as events", async () => {
    validateXray.mockResolvedValue(null);
    analyzeImage.mockResolvedValue({ kind: "error", code: "busy" });
    expect((await events(await POST(await upload(JPEG)))).at(-1)).toEqual({
      type: "error",
      code: "busy",
    });

    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    analyzeImage.mockRejectedValue(new Error("boom"));
    expect((await events(await POST(await upload(JPEG)))).at(-1)).toEqual({
      type: "error",
      code: "unavailable",
    });
    log.mockRestore();
  });

  it("falls back to Indonesian for an unknown locale", async () => {
    validateXray.mockResolvedValue(null);
    analyzeImage.mockResolvedValue({ kind: "result", result: RESULT });
    await events(await POST(await upload(JPEG, "fr")));
    expect(validateXray).toHaveBeenCalledWith(expect.any(Uint8Array), "image/jpeg", "id");
  });

  it("saves scan and emits scanId when user is logged in and save is not 'false'", async () => {
    currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });
    createClient.mockResolvedValue({ client: "supabase" });
    saveScanUpload.mockResolvedValue(undefined);
    validateXray.mockResolvedValue(null);
    analyzeImage.mockResolvedValue({ kind: "result", result: RESULT });

    const body = new FormData();
    body.append("image", new Blob([JPEG], { type: "image/jpeg" }), "scan.jpg");
    body.append("locale", "id");
    const response = await POST(await multipart(body));
    const resultEvents = await events(response);

    expect(saveScanUpload).toHaveBeenCalledWith(
      { client: "supabase" },
      "user-123",
      expect.any(String),
      expect.any(Uint8Array),
      "image/jpeg",
      RESULT,
    );
    const lastEvent = resultEvents.at(-1);
    expect(lastEvent).toEqual({
      type: "result",
      result: RESULT,
      scanId: expect.any(String),
    });
  });

  it("saves a PNG upload with its sniffed type, not JPEG", async () => {
    currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });
    createClient.mockResolvedValue({ client: "supabase" });
    saveScanUpload.mockResolvedValue(undefined);
    validateXray.mockResolvedValue(null);
    analyzeImage.mockResolvedValue({ kind: "result", result: RESULT });

    await events(await POST(await upload(PNG)));
    expect(saveScanUpload.mock.calls[0]?.[4]).toBe("image/png");
  });

  it("does not save scan and emits no scanId when user is logged in but save is 'false'", async () => {
    currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });
    createClient.mockResolvedValue({ client: "supabase" });
    validateXray.mockResolvedValue(null);
    analyzeImage.mockResolvedValue({ kind: "result", result: RESULT });

    const body = new FormData();
    body.append("image", new Blob([JPEG], { type: "image/jpeg" }), "scan.jpg");
    body.append("save", "false");
    const response = await POST(await multipart(body));
    const resultEvents = await events(response);

    expect(saveScanUpload).not.toHaveBeenCalled();
    const lastEvent = resultEvents.at(-1);
    expect(lastEvent).toEqual({
      type: "result",
      result: RESULT,
    });
  });

  it("returns 429 when initial checkQuota reports quota exceeded", async () => {
    checkQuota.mockResolvedValueOnce({
      ok: false,
      count: 5,
      limit: 5,
      remaining: 0,
      resetInSeconds: 1800,
    });

    const response = await POST(await upload(JPEG));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      code: "quota_exceeded",
      resetInSeconds: 1800,
      role: "guest",
    });
    expect(validateXray).not.toHaveBeenCalled();
    expect(consumeQuota).not.toHaveBeenCalled();
  });

  it("does not consume quota when validation rejects the image", async () => {
    validateXray.mockResolvedValue({
      is_dental_panoramic: false,
      confidence: 0.9,
      reason: "Bukan X-ray gigi",
    });

    const response = await POST(await upload(JPEG));
    const resultEvents = await events(response);
    expect(resultEvents).toEqual([
      { type: "stage", stage: "validating" },
      { type: "rejected", reason: "Bukan X-ray gigi" },
    ]);
    expect(consumeQuota).not.toHaveBeenCalled();
  });

  it("withholds the result when the atomic consume finds the quota used up", async () => {
    validateXray.mockResolvedValue(null);
    analyzeImage.mockResolvedValue({ kind: "result", result: RESULT });
    consumeQuota.mockResolvedValueOnce({ ok: false, limit: 5, resetInSeconds: 1800 });

    const response = await POST(await upload(JPEG));
    const resultEvents = await events(response);
    expect(resultEvents).toEqual([
      { type: "stage", stage: "validating" },
      { type: "stage", stage: "analyzing" },
      {
        type: "error",
        code: "quota_exceeded",
        resetInSeconds: 1800,
        role: "guest",
      },
    ]);
  });

  it.each([
    [{ kind: "not_xray" }, { type: "rejected", reason: null }],
    [
      { kind: "error", code: "busy" },
      { type: "error", code: "busy" },
    ],
  ])("does not consume quota when inference gives no scan (%o)", async (outcome, last) => {
    validateXray.mockResolvedValue(null);
    analyzeImage.mockResolvedValueOnce(outcome);

    const resultEvents = await events(await POST(await upload(JPEG)));
    expect(resultEvents.at(-1)).toEqual(last);
    expect(consumeQuota).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the quota counter cannot be read", async () => {
    checkQuota.mockRejectedValueOnce(new Error("db down"));

    const response = await POST(await upload(JPEG));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "unavailable" });
    expect(validateXray).not.toHaveBeenCalled();
  });

  it("reports unavailable, not quota_exceeded, when consuming quota errors", async () => {
    validateXray.mockResolvedValue(null);
    analyzeImage.mockResolvedValue({ kind: "result", result: RESULT });
    consumeQuota.mockRejectedValueOnce(new Error("rpc down"));

    const resultEvents = await events(await POST(await upload(JPEG)));
    expect(consumeQuota).toHaveBeenCalledTimes(1);
    expect(resultEvents.at(-1)).toEqual({ type: "error", code: "unavailable" });
  });
  describe("logged-in save and quota order", () => {
    async function loggedInScan() {
      currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });
      createClient.mockResolvedValue({ client: "supabase" });
      validateXray.mockResolvedValue(null);
      analyzeImage.mockResolvedValue({ kind: "result", result: RESULT });
      return events(await POST(await upload(JPEG)));
    }
    const savedId = () => saveScanUpload.mock.calls[0]?.[2];

    it("saves before consuming, so a failed save costs no quota", async () => {
      saveScanUpload.mockRejectedValueOnce(new Error("storage down"));
      const resultEvents = await loggedInScan();
      expect(resultEvents.at(-1)).toEqual({ type: "error", code: "unavailable" });
      expect(consumeQuota).not.toHaveBeenCalled();
    });

    it("discards the just-saved scan when the quota is used up", async () => {
      saveScanUpload.mockResolvedValueOnce(undefined);
      consumeQuota.mockResolvedValueOnce({ ok: false, limit: 20, resetInSeconds: 600 });
      const resultEvents = await loggedInScan();
      expect(deleteScan).toHaveBeenCalledWith({ client: "supabase" }, "user-123", savedId());
      expect(resultEvents.at(-1)).toMatchObject({ type: "error", code: "quota_exceeded" });
    });

    it("discards the just-saved scan when the quota RPC errors", async () => {
      saveScanUpload.mockResolvedValueOnce(undefined);
      consumeQuota.mockRejectedValueOnce(new Error("rpc down"));
      const resultEvents = await loggedInScan();
      expect(deleteScan).toHaveBeenCalledWith({ client: "supabase" }, "user-123", savedId());
      expect(resultEvents.at(-1)).toEqual({ type: "error", code: "unavailable" });
    });

    it("keeps the saved scan once the quota is consumed", async () => {
      saveScanUpload.mockResolvedValueOnce(undefined);
      const resultEvents = await loggedInScan();
      expect(deleteScan).not.toHaveBeenCalled();
      expect(resultEvents.at(-1)).toEqual({ type: "result", result: RESULT, scanId: savedId() });
    });
  });
});
