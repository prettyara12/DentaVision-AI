import { beforeEach, describe, expect, it, vi } from "vitest";
import { INSIGHT_PROMPT_VERSION, type InsightEvent } from "@/features/insight/insight";
import { readLines } from "@/features/scan/upload";

const streamInsight = vi.hoisted(() => vi.fn());
const currentUser = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const createClient = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/gemini", () => ({ streamInsight }));
vi.mock("@/lib/supabase/server", () => ({
  currentUser,
  createClient,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}));

const { POST } = await import("./route");

const caries = { class_id: 0, confidence: 0.71, box: [0.1, 0.6, 0.2, 0.8] };
const INSIGHT = {
  summary: "The AI marked one area. Routine checkups still matter.",
  findings: [
    { class_key: "made_up", explanation: "x", what_to_do: "y" },
    {
      class_key: "caries",
      explanation: "Decay may show as a dark spot.",
      what_to_do: "Ask a dentist.",
    },
  ],
  questions_for_dentist: ["Is this decay?"],
};

function post(body: unknown, headers: Record<string, string> = {}) {
  const text = JSON.stringify(body);
  return POST(
    new Request("http://test/api/insight", {
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
  const out: InsightEvent[] = [];
  for await (const e of readLines<InsightEvent>(response.body!)) out.push(e);
  return out;
}

async function* yieldAll(...texts: string[]) {
  for (const t of texts) yield t;
}

beforeEach(() => {
  streamInsight.mockReset();
  currentUser.mockReset().mockResolvedValue(null);
  createClient.mockReset();
  createAdminClient.mockReset();
});

describe("POST /api/insight", () => {
  it("rejects bodies that are not a findings list", async () => {
    expect((await post({ locale: "id" })).status).toBe(400);
    expect((await post({ locale: "fr", detections: [] })).status).toBe(400);
    expect((await post({ locale: "id", detections: [{ ...caries, class_id: 99 }] })).status).toBe(
      400,
    );
    expect(
      (await post({ locale: "id", detections: [] }, { "content-length": "999999" })).status,
    ).toBe(413);
    expect(streamInsight).not.toHaveBeenCalled();
  });

  it("sends only the text context, then partial and final events with unknown classes dropped", async () => {
    const full = JSON.stringify(INSIGHT);
    streamInsight.mockReturnValue(yieldAll(full.slice(0, 40), full));
    const response = await post({ locale: "en", detections: [caries] });
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    const out = await events(response);

    const [context, locale] = streamInsight.mock.calls[0] as [string, string];
    expect(context).toContain("- [attention] Caries (key: caries), 1 box");
    expect(locale).toBe("en");
    expect(out[0]).toEqual({
      type: "partial",
      insight: { summary: "The AI marked one area. Rout", findings: [] },
    });
    expect(out.at(-1)).toEqual({
      type: "done",
      insight: { ...INSIGHT, findings: [INSIGHT.findings[1]] },
    });
  });

  it("reports an error when Gemini fails or returns something off-schema", async () => {
    streamInsight.mockImplementation(async function* () {
      yield "";
      throw new Error("429");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await events(await post({ locale: "id", detections: [] }))).toEqual([{ type: "error" }]);

    streamInsight.mockReturnValue(yieldAll('{"summary": 5}'));
    expect((await events(await post({ locale: "id", detections: [] }))).at(-1)).toEqual({
      type: "error",
    });
  });

  it("verifies ownership and updates scan insight via createAdminClient when scanId is provided", async () => {
    const validScanId = "550e8400-e29b-41d4-a716-446655440000";
    currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });

    const selectScanMock = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: validScanId }, error: null }),
        }),
      }),
    }));

    const updateScanMock = vi.fn(() => ({
      eq: () => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }));

    createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "scans") return { select: selectScanMock };
        return {};
      }),
    });

    createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "scans") return { update: updateScanMock };
        return {};
      }),
    });

    const full = JSON.stringify(INSIGHT);
    streamInsight.mockReturnValue(yieldAll(full));

    const response = await post({
      locale: "id",
      detections: [caries],
      scanId: validScanId,
    });

    expect(response.status).toBe(200);
    const out = await events(response);
    expect(out.at(-1)?.type).toBe("done");

    expect(updateScanMock).toHaveBeenCalledWith({
      insight: INSIGHT,
      insight_locale: "id",
      insight_prompt_version: INSIGHT_PROMPT_VERSION,
    });
  });

  it("returns 404 when scanId does not belong to logged-in user", async () => {
    const validScanId = "550e8400-e29b-41d4-a716-446655440000";
    currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });

    const selectScanMock = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }));

    createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "scans") return { select: selectScanMock };
        return {};
      }),
    });

    const response = await post({
      locale: "id",
      detections: [caries],
      scanId: validScanId,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "not_found" });
    expect(streamInsight).not.toHaveBeenCalled();
  });

  it("reports error event when updating scan insight via createAdminClient fails", async () => {
    const validScanId = "550e8400-e29b-41d4-a716-446655440000";
    currentUser.mockResolvedValue({ id: "user-123", email: "user@test.com" });

    const selectScanMock = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: validScanId }, error: null }),
        }),
      }),
    }));

    const updateScanMock = vi.fn(() => ({
      eq: () => ({
        eq: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: "DB update connection lost" } }),
      }),
    }));

    createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "scans") return { select: selectScanMock };
        return {};
      }),
    });

    createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "scans") return { update: updateScanMock };
        return {};
      }),
    });

    const full = JSON.stringify(INSIGHT);
    streamInsight.mockReturnValue(yieldAll(full));

    const response = await post({
      locale: "id",
      detections: [caries],
      scanId: validScanId,
    });

    expect(response.status).toBe(200);
    const out = await events(response);
    expect(out.at(-1)).toEqual({ type: "error" });
  });
});
