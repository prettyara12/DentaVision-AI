import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent } from "@/features/chat/chat";
import { readLines } from "@/features/scan/upload";

const streamChat = vi.hoisted(() => vi.fn());
vi.mock("@/lib/gemini", () => ({ streamChat }));

const { POST } = await import("./route");

const caries = { class_id: 0, confidence: 0.71, box: [0.1, 0.6, 0.2, 0.8] };
const question = { role: "user", text: "What is caries?" };

function post(body: unknown, headers: Record<string, string> = {}) {
  const text = JSON.stringify(body);
  return POST(
    new Request("http://test/api/chat", {
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

async function events(response: Response) {
  const out: ChatEvent[] = [];
  for await (const e of readLines<ChatEvent>(response.body!)) out.push(e);
  return out;
}

async function* yieldAll(...texts: string[]) {
  for (const t of texts) yield t;
}

beforeEach(() => {
  streamChat.mockReset();
});

describe("POST /api/chat", () => {
  it("rejects invalid bodies and a history that does not end with a question", async () => {
    expect((await post({ locale: "id", messages: [] })).status).toBe(400);
    expect((await post({ locale: "id", messages: [{ role: "user", text: "  " }] })).status).toBe(
      400,
    );
    expect(
      (await post({ locale: "id", messages: [{ role: "user", text: "x".repeat(2001) }] })).status,
    ).toBe(400);
    expect(
      (await post({ locale: "id", messages: [question, { role: "model", text: "Ok." }] })).status,
    ).toBe(400);
    expect(
      (await post({ locale: "id", messages: [question] }, { "content-length": "999999" })).status,
    ).toBe(413);
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("streams deltas with the findings as text and at most 20 messages", async () => {
    streamChat.mockReturnValue(yieldAll("Caries", "Caries is decay."));
    const old = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 ? "model" : "user",
      text: `m${i}`,
    }));
    const response = await post({
      locale: "en",
      messages: [...old, question],
      scan: { detections: [caries], insightSummary: "The AI marked one area." },
    });
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(await events(response)).toEqual([
      { type: "delta", text: "Caries" },
      { type: "delta", text: " is decay." },
      { type: "done" },
    ]);

    const [locale, scan, history] = streamChat.mock.calls[0] as [
      string,
      { findingsContext: string; insightSummary?: string },
      { role: string }[],
    ];
    expect(locale).toBe("en");
    expect(scan.findingsContext).toContain("- [attention] Caries (key: caries), 1 box");
    expect(scan.insightSummary).toBe("The AI marked one area.");
    expect(history.length).toBeLessThanOrEqual(20);
    expect(history[0]?.role).toBe("user");
    expect(history.at(-1)).toEqual(question);
  });

  it("passes no scan context for general chat", async () => {
    streamChat.mockReturnValue(yieldAll("Twice a day."));
    await events(await post({ locale: "id", messages: [question] }));
    expect(streamChat.mock.calls[0]?.[1]).toBeNull();
  });

  it("reports an error when Gemini fails or says nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    streamChat.mockImplementation(async function* () {
      yield "";
      throw new Error("429");
    });
    expect(await events(await post({ locale: "id", messages: [question] }))).toEqual([
      { type: "error" },
    ]);
    streamChat.mockReturnValue(yieldAll(""));
    expect(await events(await post({ locale: "id", messages: [question] }))).toEqual([
      { type: "error" },
    ]);
  });
});
