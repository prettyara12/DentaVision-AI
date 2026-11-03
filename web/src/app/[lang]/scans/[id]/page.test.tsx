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
const getScanDetail = vi.hoisted(() => vi.fn());
const ResultWorkspace = vi.hoisted(() =>
  vi.fn(
    ({
      lang,
      initialScan,
    }: {
      lang: string;
      initialScan?: { image: string; result: { detections: unknown[] } };
    }) => (
      <div data-testid="result-workspace" data-lang={lang} data-image={initialScan?.image}>
        {`${initialScan?.result?.detections?.length} detections`}
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

vi.mock("@/features/history/data", () => ({
  getScanDetail,
}));

vi.mock("@/features/scan/result-workspace", () => ({
  ResultWorkspace,
}));

const { default: SavedScanPage, ScanContent, generateMetadata } = await import("./page");

beforeEach(() => {
  notFound.mockClear();
  redirect.mockClear();
  currentUser.mockReset();
  createClient.mockReset();
  getScanDetail.mockReset();
  ResultWorkspace.mockClear();
});

describe("/scans/[id] page", () => {
  describe("generateMetadata", () => {
    it("returns localized title for valid locale", async () => {
      const metaId = await generateMetadata({
        params: Promise.resolve({ lang: "id", id: "scan-1" }),
      });
      expect(metaId.title).toBe("Hasil scan · DentaVision AI");

      const metaEn = await generateMetadata({
        params: Promise.resolve({ lang: "en", id: "scan-1" }),
      });
      expect(metaEn.title).toBe("Scan result · DentaVision AI");
    });

    it("returns empty object for invalid locale", async () => {
      const meta = await generateMetadata({
        params: Promise.resolve({ lang: "fr", id: "scan-1" }),
      });
      expect(meta).toEqual({});
    });
  });

  describe("SavedScanPage component", () => {
    it("renders lightbox room structure with Suspense", async () => {
      const jsx = SavedScanPage({
        params: Promise.resolve({ lang: "id", id: "scan-123" }),
      });
      const html = renderToString(jsx);

      expect(html).toContain('data-room="lightbox"');
    });
  });

  describe("ScanContent component", () => {
    it("calls notFound when locale is unsupported", async () => {
      await expect(
        ScanContent({ params: Promise.resolve({ lang: "de", id: "scan-1" }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(notFound).toHaveBeenCalled();
    });

    it("redirects unauthenticated users to login with next path", async () => {
      currentUser.mockResolvedValue(null);

      await expect(
        ScanContent({ params: Promise.resolve({ lang: "id", id: "scan-123" }) }),
      ).rejects.toThrow("NEXT_REDIRECT:/id/login?next=/id/scans/scan-123");
      expect(redirect).toHaveBeenCalledWith("/id/login?next=/id/scans/scan-123");
    });

    it("calls notFound when scan is not found or does not belong to user", async () => {
      currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
      createClient.mockResolvedValue({});
      getScanDetail.mockResolvedValue(null);

      await expect(
        ScanContent({ params: Promise.resolve({ lang: "id", id: "scan-missing" }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(getScanDetail).toHaveBeenCalledWith({}, "user-1", "scan-missing");
      expect(notFound).toHaveBeenCalled();
    });

    it("passes initialScan to ResultWorkspace with detections, insight, and chat", async () => {
      currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
      createClient.mockResolvedValue({});
      getScanDetail.mockResolvedValue({
        id: "scan-123",
        userId: "user-1",
        createdAt: "2026-10-28T10:00:00Z",
        source: "upload",
        imageUrl: "https://storage.example.com/scans/original.jpg?token=abc",
        imageWidth: 2000,
        imageHeight: 1000,
        modelVersion: "best_resnet50.pt",
        detections: [
          { class_id: 0, confidence: 0.95, box: [100, 200, 300, 400] },
          { class_id: 4, confidence: 0.88, box: [500, 600, 700, 800] },
        ],
        heatmaps: { "0": "base64data" },
        insight: {
          locale: "id",
          version: "insight@2",
          data: {
            summary: "Ringkasan kondisi gigi",
            findings: [],
            questions_for_dentist: [],
          },
        },
        chat: {
          id: "chat-123",
          title: "Diskusi Scan",
          createdAt: "2026-10-28T10:05:00Z",
          updatedAt: "2026-10-28T10:10:00Z",
          messages: [
            { id: 1, role: "user", content: "Halo dokter", createdAt: "2026-10-28T10:05:00Z" },
            {
              id: 2,
              role: "model",
              content: "Halo! Ada yang bisa dibantu?",
              createdAt: "2026-10-28T10:06:00Z",
            },
          ],
        },
      });

      const jsx = await ScanContent({
        params: Promise.resolve({ lang: "id", id: "scan-123" }),
      });
      const html = renderToString(jsx);

      expect(html).toContain("Hasil scan");
      expect(html).toContain("bukan diagnosis medis");
      expect(html).toContain('data-testid="result-workspace"');
      expect(html).toContain("2 detections");

      expect(ResultWorkspace.mock.calls[0]![0]).toEqual(
        expect.objectContaining({
          lang: "id",
          initialScan: expect.objectContaining({
            image: "https://storage.example.com/scans/original.jpg?token=abc",
            result: expect.objectContaining({
              model_version: "best_resnet50.pt",
              image: { width: 2000, height: 1000 },
              detections: expect.arrayContaining([
                expect.objectContaining({ class_id: 0, confidence: 0.95 }),
              ]),
            }),
            insight: expect.objectContaining({
              locale: "id",
              data: expect.objectContaining({ summary: "Ringkasan kondisi gigi" }),
            }),
            chat: [
              { role: "user", text: "Halo dokter" },
              { role: "model", text: "Halo! Ada yang bisa dibantu?" },
            ],
          }),
        }),
      );
    });
  });
});
