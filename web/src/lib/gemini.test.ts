import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.hoisted(() => vi.fn());
const generateContentStream = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => {
  class ApiError extends Error {
    constructor(public status: number) {
      super(`status ${status}`);
    }
  }
  class GoogleGenAI {
    models = { generateContent, generateContentStream };
  }
  return { ApiError, GoogleGenAI };
});

vi.mock("@/lib/env", () => ({
  env: () => ({ GEMINI_API_KEY: "k", GEMINI_MODEL: "primary", GEMINI_FALLBACK_MODEL: "backup" }),
}));

const { ApiError } = await import("@google/genai");
const apiError = (status: number) => new (ApiError as unknown as new (s: number) => Error)(status);
const { InsightUnavailableError, isRejected, streamInsight, validateXray } =
  await import("./gemini");

const image = new Uint8Array([0xff, 0xd8, 0xff]);
const reply = (verdict: object) => ({ text: JSON.stringify(verdict) });

beforeEach(() => {
  generateContent.mockReset();
  generateContentStream.mockReset();
});

describe("validateXray", () => {
  it("sends the image with the versioned prompt in the user's language", async () => {
    generateContent.mockResolvedValue(
      reply({ is_dental_panoramic: true, confidence: 0.9, reason: "OPG." }),
    );
    expect(await validateXray(image, "image/jpeg", "id")).toEqual({
      is_dental_panoramic: true,
      confidence: 0.9,
      reason: "OPG.",
    });
    const request = generateContent.mock.calls[0]?.[0];
    expect(request.model).toBe("primary");
    expect(request.contents[0].parts[0].inlineData).toEqual({
      mimeType: "image/jpeg",
      data: "/9j/",
    });
    expect(request.config.systemInstruction).toContain("one short sentence in Indonesian");
    expect(request.config.responseMimeType).toBe("application/json");
  });

  it("tries the fallback model once on 429", async () => {
    generateContent
      .mockRejectedValueOnce(new (ApiError as unknown as new (s: number) => Error)(429))
      .mockResolvedValueOnce(reply({ is_dental_panoramic: false, confidence: 0.8, reason: "x" }));
    expect(await validateXray(image, "image/png", "en")).not.toBeNull();
    expect(generateContent.mock.calls.map((c) => c[0].model)).toEqual(["primary", "backup"]);
  });

  it("returns null when every model is rate limited", async () => {
    generateContent.mockRejectedValue(new (ApiError as unknown as new (s: number) => Error)(429));
    expect(await validateXray(image, "image/png", "en")).toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a timeout", () => generateContent.mockRejectedValue(new DOMException("t", "TimeoutError"))],
    ["invalid JSON", () => generateContent.mockResolvedValue({ text: "not json" })],
    [
      "a wrong shape",
      () => generateContent.mockResolvedValue(reply({ is_dental_panoramic: "yes" })),
    ],
  ])("returns null on %s without trying the fallback", async (_, arrange) => {
    arrange();
    expect(await validateXray(image, "image/png", "en")).toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

describe("isRejected", () => {
  it("rejects only a confident 'not panoramic'", () => {
    expect(isRejected({ is_dental_panoramic: false, confidence: 0.6, reason: "" })).toBe(true);
    expect(isRejected({ is_dental_panoramic: false, confidence: 0.59, reason: "" })).toBe(false);
    expect(isRejected({ is_dental_panoramic: true, confidence: 1, reason: "" })).toBe(false);
  });
});

describe("streamInsight", () => {
  async function* chunks(...texts: string[]) {
    for (const text of texts) yield { text };
  }
  const collect = async (signal = new AbortController().signal) => {
    const seen: string[] = [];
    for await (const text of streamInsight("Findings: ...", "en", signal)) seen.push(text);
    return seen;
  };

  it("sends the findings as the user turn and yields the accumulated text", async () => {
    generateContentStream.mockResolvedValue(chunks('{"summary"', ': "Hi."}'));
    expect(await collect()).toEqual(['{"summary"', '{"summary": "Hi."}']);
    const [params] = generateContentStream.mock.calls[0] as [
      { model: string; contents: unknown; config: { systemInstruction: string } },
    ];
    expect(params.model).toBe("primary");
    expect(params.contents).toEqual([{ role: "user", parts: [{ text: "Findings: ..." }] }]);
    expect(params.config.systemInstruction).toContain("to a layperson in English");
  });

  it("falls back to the backup model only on a 429 before any text", async () => {
    generateContentStream.mockRejectedValueOnce(apiError(429)).mockResolvedValueOnce(chunks("{}"));
    expect(await collect()).toEqual(["{}"]);
    expect(generateContentStream.mock.calls.map(([p]) => (p as { model: string }).model)).toEqual([
      "primary",
      "backup",
    ]);
  });

  it("fails without retrying on other errors or a cut-off stream", async () => {
    generateContentStream.mockRejectedValueOnce(apiError(500));
    await expect(collect()).rejects.toBeInstanceOf(InsightUnavailableError);
    async function* broken() {
      yield { text: '{"summary": "x' };
      throw apiError(429);
    }
    generateContentStream.mockResolvedValueOnce(broken());
    await expect(collect()).rejects.toBeInstanceOf(InsightUnavailableError);
    expect(generateContentStream).toHaveBeenCalledTimes(2);
  });
});
