import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: () => ({ INFERENCE_API_URL: "https://api.test", INFERENCE_API_SECRET: "s".repeat(16) }),
}));

const { analyzeImage, inferenceStatus } = await import("./inference");

export const RESULT = {
  model_version: "yolov8m-resnet50@60bfdce6",
  image: { width: 2048, height: 1024 },
  low_quality: false,
  detections: [{ class_id: 0, confidence: 0.71, box: [0.1, 0.2, 0.3, 0.4] }],
  heatmaps: { "0": "iVBORw0KGgo=" },
  timing_ms: { prefilter: 10, detect: 900, gradcam: 2100 },
};

const stubFetch = (response: Response | Error) => {
  const fetch = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

afterEach(() => vi.unstubAllGlobals());

describe("analyzeImage", () => {
  it("posts the image with the secret and returns the validated result", async () => {
    const fetch = stubFetch(Response.json(RESULT));
    expect(await analyzeImage(new Blob(["x"]))).toEqual({ kind: "result", result: RESULT });
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://api.test/v1/analyze");
    expect(init.headers).toEqual({ "X-API-Secret": "s".repeat(16) });
    expect((init.body as FormData).get("image")).toBeInstanceOf(Blob);
  });

  it.each([
    [422, { code: "not_xray" }, { kind: "not_xray" }],
    [413, { code: "too_large" }, { kind: "error", code: "too_large" }],
    [415, { code: "unsupported_type" }, { kind: "error", code: "unsupported_type" }],
    [503, { code: "busy" }, { kind: "error", code: "busy" }],
    [503, { code: "loading" }, { kind: "error", code: "loading" }],
    [503, { code: "model_unavailable" }, { kind: "error", code: "unavailable" }],
    [500, {}, { kind: "error", code: "unavailable" }],
  ])("maps HTTP %i %o", async (status, body, expected) => {
    stubFetch(Response.json(body, { status }));
    expect(await analyzeImage(new Blob(["x"]))).toEqual(expected);
  });

  it("treats a malformed 200 or a network error as unavailable", async () => {
    stubFetch(Response.json({ detections: "nope" }));
    expect(await analyzeImage(new Blob(["x"]))).toEqual({ kind: "error", code: "unavailable" });
    stubFetch(new TypeError("fetch failed"));
    expect(await analyzeImage(new Blob(["x"]))).toEqual({ kind: "error", code: "unavailable" });
  });

  it("logs a rejected secret by name only", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(Response.json({ code: "unauthorized" }, { status: 401 }));
    expect(await analyzeImage(new Blob(["x"]))).toEqual({ kind: "error", code: "unavailable" });
    expect(log.mock.calls.flat().join(" ")).not.toContain("s".repeat(16));
    log.mockRestore();
  });
});

describe("inferenceStatus", () => {
  it.each([
    [Response.json({ status: "ready" }), "ready"],
    [Response.json({ status: "loading" }), "loading"],
    [Response.json({ status: "error" }), "error"],
    [new Response("<html>Space is starting</html>", { status: 503 }), "waking"],
    [new TypeError("fetch failed"), "waking"],
  ])("maps %o to %s", async (response, expected) => {
    stubFetch(response);
    expect(await inferenceStatus()).toBe(expected);
  });
});
