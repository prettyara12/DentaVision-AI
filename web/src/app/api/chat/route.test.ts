import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent } from "@/features/chat/chat";
import { readLines } from "@/features/scan/upload";

const streamChat = vi.hoisted(() => vi.fn());
const currentUser = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const createClient = vi.hoisted(() => vi.fn());
const consumeQuota = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ok: true, limit: 20, resetInSeconds: 3600 }),
);
const getQuotaSubject = vi.hoisted(() =>
  vi.fn().mockReturnValue({ subject: "ip:test", role: "guest" }),
);
const getQuotaLimit = vi.hoisted(() => vi.fn().mockReturnValue(20));
const quotaHeaders = vi.hoisted(() => vi.fn().mockReturnValue({ "RateLimit-Limit": "20" }));
const createAdminClient = vi.hoisted(() => vi.fn().mockReturnValue({}));

vi.mock("@/lib/gemini", () => ({ streamChat }));
vi.mock("@/lib/supabase/server", () => ({
  currentUser,
  createClient,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}));
vi.mock("@/lib/quota", () => ({
  consumeQuota,
  getQuotaSubject,
  getQuotaLimit,
  quotaHeaders,
}));

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
  currentUser.mockReset().mockResolvedValue(null);
  createClient.mockReset();
  consumeQuota.mockReset().mockResolvedValue({ ok: true, limit: 20, resetInSeconds: 3600 });
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

  it("persists chat and messages for logged-in user in a new general chat and emits done with chatId", async () => {
    currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });
    const insertChatMock = vi.fn().mockReturnValue({
      select: () => ({
        single: vi.fn().mockResolvedValue({ data: { id: "chat-new-1" }, error: null }),
      }),
    });
    const insertMsgMock = vi.fn().mockResolvedValue({ data: null, error: null });

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "chats") {
          return { insert: insertChatMock };
        }
        if (table === "chat_messages") {
          return { insert: insertMsgMock };
        }
        return {};
      }),
    };
    createClient.mockResolvedValue(supabaseMock);
    streamChat.mockReturnValue(yieldAll("Caries", "Caries is decay."));

    const response = await post({
      locale: "en",
      messages: [question],
    });

    expect(response.status).toBe(200);
    const receivedEvents = await events(response);

    // Verify chat creation
    expect(insertChatMock).toHaveBeenCalledWith({
      user_id: "user-123",
      scan_id: null,
      title: "What is caries?",
    });

    // Verify user message and model message insertion
    expect(insertMsgMock).toHaveBeenCalledWith({
      chat_id: "chat-new-1",
      role: "user",
      content: "What is caries?",
    });
    expect(insertMsgMock).toHaveBeenCalledWith({
      chat_id: "chat-new-1",
      role: "model",
      content: "Caries is decay.",
    });

    expect(receivedEvents).toEqual([
      { type: "delta", text: "Caries" },
      { type: "delta", text: " is decay." },
      { type: "done", chatId: "chat-new-1" },
    ]);
  });

  it("persists in existing chat when valid chatId is provided by logged-in user", async () => {
    const validChatId = "550e8400-e29b-41d4-a716-446655440000";
    currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });
    const selectChatMock = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: validChatId }, error: null }),
        }),
      }),
    }));
    const insertMsgMock = vi.fn().mockResolvedValue({ data: null, error: null });

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "chats") {
          return { select: selectChatMock };
        }
        if (table === "chat_messages") {
          return { insert: insertMsgMock };
        }
        return {};
      }),
    };
    createClient.mockResolvedValue(supabaseMock);
    streamChat.mockReturnValue(yieldAll("Jawaban."));

    const response = await post({
      locale: "id",
      messages: [question],
      chatId: validChatId,
    });

    expect(response.status).toBe(200);
    const receivedEvents = await events(response);

    expect(insertMsgMock).toHaveBeenCalledWith({
      chat_id: validChatId,
      role: "user",
      content: "What is caries?",
    });
    expect(insertMsgMock).toHaveBeenCalledWith({
      chat_id: validChatId,
      role: "model",
      content: "Jawaban.",
    });

    expect(receivedEvents.at(-1)).toEqual({
      type: "done",
      chatId: validChatId,
    });
  });

  it("returns 404 when chatId does not belong to logged-in user", async () => {
    const validChatId = "550e8400-e29b-41d4-a716-446655440000";
    currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });
    const selectChatMock = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }));

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "chats") {
          return { select: selectChatMock };
        }
        return {};
      }),
    };
    createClient.mockResolvedValue(supabaseMock);

    const response = await post({
      locale: "id",
      messages: [question],
      chatId: validChatId,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "not_found" });
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("finds or creates scan chat when scanId is provided", async () => {
    const validScanId = "660e8400-e29b-41d4-a716-446655440000";
    currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });
    const selectScanMock = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: validScanId }, error: null }),
        }),
      }),
    }));
    const selectChatMock = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "chat-for-scan" }, error: null }),
        }),
      }),
    }));
    const insertMsgMock = vi.fn().mockResolvedValue({ data: null, error: null });

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "scans") {
          return { select: selectScanMock };
        }
        if (table === "chats") {
          return { select: selectChatMock };
        }
        if (table === "chat_messages") {
          return { insert: insertMsgMock };
        }
        return {};
      }),
    };
    createClient.mockResolvedValue(supabaseMock);
    streamChat.mockReturnValue(yieldAll("Scan discussion."));

    const response = await post({
      locale: "en",
      messages: [question],
      scanId: validScanId,
    });

    expect(response.status).toBe(200);
    const receivedEvents = await events(response);

    expect(receivedEvents.at(-1)).toEqual({
      type: "done",
      chatId: "chat-for-scan",
    });
  });

  it("returns 404 when scanId does not belong to logged-in user or does not exist", async () => {
    const validScanId = "660e8400-e29b-41d4-a716-446655440000";
    currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });
    const selectScanMock = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }));

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "scans") {
          return { select: selectScanMock };
        }
        return {};
      }),
    };
    createClient.mockResolvedValue(supabaseMock);

    const response = await post({
      locale: "en",
      messages: [question],
      scanId: validScanId,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "not_found" });
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("emits error event when persisting model response in chat_messages fails", async () => {
    const validChatId = "550e8400-e29b-41d4-a716-446655440000";
    currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });
    const selectChatMock = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: validChatId }, error: null }),
        }),
      }),
    }));

    let insertCount = 0;
    const insertMsgMock = vi.fn().mockImplementation(() => {
      insertCount++;
      if (insertCount === 1) {
        // user message succeeds
        return Promise.resolve({ data: null, error: null });
      }
      // model message insert fails
      return Promise.resolve({ data: null, error: { message: "DB disk full on message insert" } });
    });

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "chats") return { select: selectChatMock };
        if (table === "chat_messages") return { insert: insertMsgMock };
        return {};
      }),
    };
    createClient.mockResolvedValue(supabaseMock);
    streamChat.mockReturnValue(yieldAll("Jawaban selesai."));

    const response = await post({
      locale: "id",
      messages: [question],
      chatId: validChatId,
    });

    expect(response.status).toBe(200);
    const receivedEvents = await events(response);

    // Should have deltas, then terminate with error event instead of done
    expect(receivedEvents.some((e) => e.type === "delta")).toBe(true);
    expect(receivedEvents.at(-1)).toEqual({ type: "error" });
  });

  it("returns 429 when consumeQuota reports quota exceeded", async () => {
    consumeQuota.mockResolvedValueOnce({
      ok: false,
      limit: 20,
      resetInSeconds: 1200,
    });

    const response = await post({
      locale: "id",
      messages: [question],
    });

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      code: "quota_exceeded",
      resetInSeconds: 1200,
      role: "guest",
    });
    expect(streamChat).not.toHaveBeenCalled();
  });
});
