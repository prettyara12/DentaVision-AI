import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
const currentUser = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const GeneralChat = vi.hoisted(() =>
  vi.fn(
    ({
      lang,
      initialChatId,
      initialMessages,
      scan,
    }: {
      lang: string;
      initialChatId?: string;
      initialMessages?: Array<{ role: string; text: string }>;
      scan?: { result: { detections: unknown[] } } | null;
    }) => (
      <div
        data-testid="general-chat"
        data-lang={lang}
        data-chat-id={initialChatId}
        data-messages-count={initialMessages?.length}
        data-has-scan={Boolean(scan)}
      >
        {initialMessages?.map((m, i) => (
          <p key={i} data-role={m.role}>
            {m.text}
          </p>
        ))}
      </div>
    ),
  ),
);

vi.mock("next/navigation", () => ({
  notFound,
  redirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  currentUser,
  createClient,
}));

vi.mock("@/features/chat/general-chat", () => ({
  GeneralChat,
}));

const { default: SavedChatPage, ChatContent, generateMetadata } = await import("./page");

beforeEach(() => {
  notFound.mockClear();
  redirect.mockClear();
  currentUser.mockReset();
  createClient.mockReset();
  GeneralChat.mockClear();
});

describe("/chats/[id] page", () => {
  describe("generateMetadata", () => {
    it("returns chat title for valid locale", async () => {
      const meta = await generateMetadata({
        params: Promise.resolve({ lang: "id", id: "chat-123" }),
      });
      expect(meta.title).toBe("Tanya soal kesehatan gigi · DentaVision AI");
    });

    it("returns empty object for unsupported locale", async () => {
      const meta = await generateMetadata({
        params: Promise.resolve({ lang: "es", id: "chat-123" }),
      });
      expect(meta).toEqual({});
    });
  });

  describe("SavedChatPage component", () => {
    it("renders page structure without lightbox room", async () => {
      const jsx = SavedChatPage({
        params: Promise.resolve({ lang: "id", id: "chat-123" }),
      });
      const html = renderToString(jsx);

      expect(html).not.toContain('data-room="lightbox"');
    });
  });

  describe("ChatContent component", () => {
    it("calls notFound when locale is unsupported", async () => {
      await expect(
        ChatContent({ params: Promise.resolve({ lang: "it", id: "chat-1" }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(notFound).toHaveBeenCalled();
    });

    it("redirects unauthenticated users to login with next path", async () => {
      currentUser.mockResolvedValue(null);

      await expect(
        ChatContent({ params: Promise.resolve({ lang: "id", id: "chat-123" }) }),
      ).rejects.toThrow("NEXT_REDIRECT:/id/login?next=/id/chats/chat-123");
      expect(redirect).toHaveBeenCalledWith("/id/login?next=/id/chats/chat-123");
    });

    it("calls notFound when chat does not exist", async () => {
      currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
      createClient.mockResolvedValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          })),
        })),
      });

      await expect(
        ChatContent({ params: Promise.resolve({ lang: "id", id: "chat-missing" }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(notFound).toHaveBeenCalled();
    });

    it("renders general chat without scan context when scan_id is null", async () => {
      currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
      createClient.mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === "chats") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "chat-123",
                        user_id: "user-1",
                        title: "Tanya Cara Flossing",
                        scan_id: null,
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            };
          }
          if (table === "chat_messages") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      { id: 1, role: "user", content: "Bagaimana cara flossing?" },
                      { id: 2, role: "model", content: "Gunakan benang gigi dengan lembut." },
                    ],
                    error: null,
                  }),
                })),
              })),
            };
          }
          return {};
        }),
      });

      const jsx = await ChatContent({
        params: Promise.resolve({ lang: "id", id: "chat-123" }),
      });
      const html = renderToString(jsx);

      // Must NOT use lightbox
      expect(html).not.toContain('data-room="lightbox"');
      expect(html).toContain("Tanya Cara Flossing");
      expect(html).toContain('data-testid="general-chat"');
      expect(html).toContain('data-messages-count="2"');
      expect(html).toContain('data-has-scan="false"');

      expect(GeneralChat.mock.calls[0]![0]).toEqual(
        expect.objectContaining({
          lang: "id",
          initialChatId: "chat-123",
          initialMessages: [
            { role: "user", text: "Bagaimana cara flossing?" },
            { role: "model", text: "Gunakan benang gigi dengan lembut." },
          ],
          scan: null,
        }),
      );
    });

    it("queries scan and provides scan context when scan_id is present", async () => {
      currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
      createClient.mockResolvedValue({
        from: vi.fn((table: string) => {
          if (table === "chats") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "chat-scan-1",
                        user_id: "user-1",
                        title: "Konsultasi Karies",
                        scan_id: "scan-999",
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            };
          }
          if (table === "chat_messages") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({
                    data: [{ id: 1, role: "user", content: "Apakah karies ini parah?" }],
                    error: null,
                  }),
                })),
              })),
            };
          }
          if (table === "scans") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "scan-999",
                        user_id: "user-1",
                        image_width: 1920,
                        image_height: 1080,
                        model_version: "best_resnet50.pt",
                        detections: [{ class_id: 0, confidence: 0.9, box: [10, 20, 30, 40] }],
                        insight: {
                          summary: "Terdapat indikasi karies pada gigi.",
                          findings: [],
                          questions_for_dentist: [],
                        },
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      });

      const jsx = await ChatContent({
        params: Promise.resolve({ lang: "en", id: "chat-scan-1" }),
      });
      const html = renderToString(jsx);

      expect(html).not.toContain('data-room="lightbox"');
      expect(html).toContain("Konsultasi Karies");
      expect(html).toContain('data-has-scan="true"');

      expect(GeneralChat.mock.calls[0]![0]).toEqual(
        expect.objectContaining({
          lang: "en",
          initialChatId: "chat-scan-1",
          initialMessages: [{ role: "user", text: "Apakah karies ini parah?" }],
          scan: expect.objectContaining({
            result: expect.objectContaining({
              model_version: "best_resnet50.pt",
              detections: [{ class_id: 0, confidence: 0.9, box: [10, 20, 30, 40] }],
            }),
            insight: expect.objectContaining({
              locale: "en",
              data: expect.objectContaining({
                summary: "Terdapat indikasi karies pada gigi.",
              }),
            }),
          }),
        }),
      );
    });
  });
});
