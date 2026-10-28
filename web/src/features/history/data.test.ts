import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import type { AnalyzeResult } from "@/features/scan/result";
import type { Database } from "@/lib/supabase/database.types";
import {
  deleteAccount,
  deleteChat,
  deleteScan,
  getScanDetail,
  getUserChats,
  getUserScans,
  saveScanUpload,
} from "./data";

describe("History Data Operations", () => {
  const userId = "user-123";
  const scanId = "scan-456";

  const sampleResult: AnalyzeResult = {
    model_version: "yolov8m-dentavision-v1.0",
    image: { width: 1024, height: 512 },
    low_quality: false,
    detections: [
      { class_id: 0, confidence: 0.95, box: [10, 20, 100, 200] }, // Caries -> attention
      { class_id: 1, confidence: 0.88, box: [30, 40, 120, 220] }, // Crown -> treatment
      { class_id: 15, confidence: 0.99, box: [50, 60, 150, 250] }, // Permanent Teeth -> anatomy
    ],
    heatmaps: {
      "0": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    },
    timing_ms: { preprocess: 10, inference: 50, postprocess: 5 },
  };

  describe("saveScanUpload", () => {
    it("uploads original image, heatmaps, and inserts scan into DB", async () => {
      const uploadMock = vi.fn().mockResolvedValue({ data: { path: "ok" }, error: null });
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });

      const supabaseMock = {
        storage: {
          from: vi.fn(() => ({
            upload: uploadMock,
          })),
        },
        from: vi.fn(() => ({
          insert: insertMock,
        })),
      } as unknown as SupabaseClient<Database>;

      const imageBytes = new Uint8Array([1, 2, 3]);

      await saveScanUpload(supabaseMock, userId, scanId, imageBytes, sampleResult);

      expect(supabaseMock.storage.from).toHaveBeenCalledWith("scans");

      // Verify original image upload
      expect(uploadMock).toHaveBeenCalledWith(
        `${userId}/${scanId}/original.jpg`,
        imageBytes,
        expect.objectContaining({ contentType: "image/jpeg", upsert: true }),
      );

      // Verify heatmap upload
      expect(uploadMock).toHaveBeenCalledWith(
        `${userId}/${scanId}/heatmap-0.png`,
        expect.any(Buffer),
        expect.objectContaining({ contentType: "image/png", upsert: true }),
      );

      // Verify database insert
      expect(supabaseMock.from).toHaveBeenCalledWith("scans");
      expect(insertMock).toHaveBeenCalledWith({
        id: scanId,
        user_id: userId,
        image_path: `${userId}/${scanId}/original.jpg`,
        image_width: 1024,
        image_height: 512,
        model_version: "yolov8m-dentavision-v1.0",
        detections: sampleResult.detections,
        heatmap_class_ids: [0],
        source: "upload",
      });
    });

    it("throws error if storage upload fails and does not insert into DB", async () => {
      const uploadMock = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Storage upload quota exceeded"),
      });
      const insertMock = vi.fn();

      const supabaseMock = {
        storage: {
          from: vi.fn(() => ({ upload: uploadMock })),
        },
        from: vi.fn(() => ({ insert: insertMock })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        saveScanUpload(supabaseMock, userId, scanId, new Uint8Array([1]), sampleResult),
      ).rejects.toThrow(/Failed to upload original scan image/);

      expect(insertMock).not.toHaveBeenCalled();
    });

    it("throws error if database insert fails", async () => {
      const uploadMock = vi.fn().mockResolvedValue({ data: { path: "ok" }, error: null });
      const insertMock = vi.fn().mockResolvedValue({
        error: new Error("Database connection failed"),
      });

      const supabaseMock = {
        storage: {
          from: vi.fn(() => ({ upload: uploadMock })),
        },
        from: vi.fn(() => ({ insert: insertMock })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        saveScanUpload(supabaseMock, userId, scanId, new Uint8Array([1]), sampleResult),
      ).rejects.toThrow(/Failed to insert scan record/);
    });
  });

  describe("deleteScan", () => {
    it("deletes storage files first, then deletes the database row", async () => {
      const listMock = vi.fn().mockResolvedValue({
        data: [{ name: "original.jpg" }, { name: "heatmap-0.png" }],
        error: null,
      });
      const removeMock = vi.fn().mockResolvedValue({
        data: [{ name: "original.jpg" }],
        error: null,
      });
      const eqUserMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const eqIdMock = vi.fn(() => ({ eq: eqUserMock }));
      const deleteDbMock = vi.fn(() => ({ eq: eqIdMock }));

      const supabaseMock = {
        storage: {
          from: vi.fn(() => ({
            list: listMock,
            remove: removeMock,
          })),
        },
        from: vi.fn(() => ({
          delete: deleteDbMock,
        })),
      } as unknown as SupabaseClient<Database>;

      const res = await deleteScan(supabaseMock, userId, scanId);

      expect(res).toEqual({ ok: true });
      expect(listMock).toHaveBeenCalledWith(`${userId}/${scanId}`);
      expect(removeMock).toHaveBeenCalledWith([
        `${userId}/${scanId}/original.jpg`,
        `${userId}/${scanId}/heatmap-0.png`,
      ]);
      expect(supabaseMock.from).toHaveBeenCalledWith("scans");
      expect(deleteDbMock).toHaveBeenCalled();
      expect(eqIdMock).toHaveBeenCalledWith("id", scanId);
      expect(eqUserMock).toHaveBeenCalledWith("user_id", userId);
    });

    it("does NOT call database delete if storage remove fails", async () => {
      const listMock = vi.fn().mockResolvedValue({
        data: [{ name: "original.jpg" }],
        error: null,
      });
      const removeMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Failed to remove files from storage" },
      });
      const deleteDbMock = vi.fn();

      const supabaseMock = {
        storage: {
          from: vi.fn(() => ({
            list: listMock,
            remove: removeMock,
          })),
        },
        from: vi.fn(() => ({
          delete: deleteDbMock,
        })),
      } as unknown as SupabaseClient<Database>;

      const res = await deleteScan(supabaseMock, userId, scanId);

      expect(res.ok).toBe(false);
      expect(res.error).toContain("Failed to remove files from storage");
      expect(deleteDbMock).not.toHaveBeenCalled();
    });

    it("does NOT call database delete if storage list fails", async () => {
      const listMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Storage list error" },
      });
      const deleteDbMock = vi.fn();

      const supabaseMock = {
        storage: {
          from: vi.fn(() => ({
            list: listMock,
          })),
        },
        from: vi.fn(() => ({
          delete: deleteDbMock,
        })),
      } as unknown as SupabaseClient<Database>;

      const res = await deleteScan(supabaseMock, userId, scanId);

      expect(res.ok).toBe(false);
      expect(res.error).toContain("Storage list error");
      expect(deleteDbMock).not.toHaveBeenCalled();
    });
  });

  describe("deleteChat", () => {
    it("deletes chat row matching chatId and userId", async () => {
      const chatId = "chat-789";
      const eqUserMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const eqIdMock = vi.fn(() => ({ eq: eqUserMock }));
      const deleteDbMock = vi.fn(() => ({ eq: eqIdMock }));

      const supabaseMock = {
        from: vi.fn(() => ({
          delete: deleteDbMock,
        })),
      } as unknown as SupabaseClient<Database>;

      const res = await deleteChat(supabaseMock, userId, chatId);

      expect(res).toEqual({ ok: true });
      expect(supabaseMock.from).toHaveBeenCalledWith("chats");
      expect(deleteDbMock).toHaveBeenCalled();
      expect(eqIdMock).toHaveBeenCalledWith("id", chatId);
      expect(eqUserMock).toHaveBeenCalledWith("user_id", userId);
    });

    it("returns error if database delete fails", async () => {
      const chatId = "chat-789";
      const eqUserMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error deleting chat" },
      });
      const eqIdMock = vi.fn(() => ({ eq: eqUserMock }));
      const deleteDbMock = vi.fn(() => ({ eq: eqIdMock }));

      const supabaseMock = {
        from: vi.fn(() => ({
          delete: deleteDbMock,
        })),
      } as unknown as SupabaseClient<Database>;

      const res = await deleteChat(supabaseMock, userId, chatId);

      expect(res.ok).toBe(false);
      expect(res.error).toBe("Database error deleting chat");
    });
  });

  describe("deleteAccount", () => {
    it("lists all files under userId, removes from storage, then deletes user", async () => {
      const listTopMock = vi.fn().mockImplementation((prefix: string) => {
        if (prefix === userId) {
          return Promise.resolve({
            data: [{ name: "scan-1" }, { name: "scan-2" }],
            error: null,
          });
        }
        if (prefix === `${userId}/scan-1`) {
          return Promise.resolve({
            data: [{ name: "original.jpg" }, { name: "heatmap-0.png" }],
            error: null,
          });
        }
        if (prefix === `${userId}/scan-2`) {
          return Promise.resolve({
            data: [{ name: "original.jpg" }],
            error: null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      });

      const removeMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const deleteUserMock = vi.fn().mockResolvedValue({ data: null, error: null });

      const adminClientMock = {
        auth: {
          admin: {
            deleteUser: deleteUserMock,
          },
        },
      } as unknown as SupabaseClient<Database>;

      const supabaseMock = {
        storage: {
          from: vi.fn(() => ({
            list: listTopMock,
            remove: removeMock,
          })),
        },
      } as unknown as SupabaseClient<Database>;

      const res = await deleteAccount(adminClientMock, supabaseMock, userId);

      expect(res).toEqual({ ok: true });
      expect(removeMock).toHaveBeenCalledWith([
        `${userId}/scan-1/original.jpg`,
        `${userId}/scan-1/heatmap-0.png`,
        `${userId}/scan-2/original.jpg`,
      ]);
      expect(deleteUserMock).toHaveBeenCalledWith(userId);
    });

    it("does NOT delete user if storage remove fails", async () => {
      const listMock = vi.fn().mockResolvedValue({
        data: [{ name: "scan-1/original.jpg" }],
        error: null,
      });
      const removeMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Storage delete batch failed" },
      });
      const deleteUserMock = vi.fn();

      const adminClientMock = {
        auth: {
          admin: {
            deleteUser: deleteUserMock,
          },
        },
      } as unknown as SupabaseClient<Database>;

      const supabaseMock = {
        storage: {
          from: vi.fn(() => ({
            list: listMock,
            remove: removeMock,
          })),
        },
      } as unknown as SupabaseClient<Database>;

      const res = await deleteAccount(adminClientMock, supabaseMock, userId);

      expect(res.ok).toBe(false);
      expect(res.error).toBe("Storage delete batch failed");
      expect(deleteUserMock).not.toHaveBeenCalled();
    });

    it("does NOT delete user if storage list fails", async () => {
      const listMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Storage list failed" },
      });
      const deleteUserMock = vi.fn();

      const adminClientMock = {
        auth: {
          admin: {
            deleteUser: deleteUserMock,
          },
        },
      } as unknown as SupabaseClient<Database>;

      const supabaseMock = {
        storage: {
          from: vi.fn(() => ({
            list: listMock,
          })),
        },
      } as unknown as SupabaseClient<Database>;

      const res = await deleteAccount(adminClientMock, supabaseMock, userId);

      expect(res.ok).toBe(false);
      expect(res.error).toBe("Storage list failed");
      expect(deleteUserMock).not.toHaveBeenCalled();
    });
  });

  describe("getUserScans", () => {
    it("queries scans ordered by created_at desc and generates signed thumbnail URLs", async () => {
      const scansInDb = [
        {
          id: "scan-1",
          user_id: userId,
          image_path: `${userId}/scan-1/original.jpg`,
          model_version: "v1.0",
          detections: [
            { class_id: 0, confidence: 0.9, box: [1, 2, 3, 4] }, // attention
            { class_id: 4, confidence: 0.85, box: [5, 6, 7, 8] }, // attention
            { class_id: 1, confidence: 0.7, box: [9, 10, 11, 12] }, // treatment
          ],
          created_at: "2026-10-28T10:00:00Z",
        },
        {
          id: "scan-2",
          user_id: userId,
          image_path: `${userId}/scan-2/original.jpg`,
          model_version: "v1.0",
          detections: [
            { class_id: 15, confidence: 0.99, box: [13, 14, 15, 16] }, // anatomy (not attention)
          ],
          created_at: "2026-10-27T10:00:00Z",
        },
      ];

      const orderMock = vi.fn().mockResolvedValue({ data: scansInDb, error: null });
      const eqMock = vi.fn(() => ({ order: orderMock }));
      const selectMock = vi.fn(() => ({ eq: eqMock }));
      const createSignedUrlMock = vi.fn((path: string, expires: number) =>
        Promise.resolve({
          data: { signedUrl: `https://example.com/${path}?token=abc&expires=${expires}` },
          error: null,
        }),
      );

      const supabaseMock = {
        from: vi.fn(() => ({ select: selectMock })),
        storage: {
          from: vi.fn(() => ({ createSignedUrl: createSignedUrlMock })),
        },
      } as unknown as SupabaseClient<Database>;

      const summaries = await getUserScans(supabaseMock, userId);

      expect(supabaseMock.from).toHaveBeenCalledWith("scans");
      expect(selectMock).toHaveBeenCalledWith("*");
      expect(eqMock).toHaveBeenCalledWith("user_id", userId);
      expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });

      expect(summaries).toHaveLength(2);

      expect(summaries[0]).toEqual({
        id: "scan-1",
        createdAt: "2026-10-28T10:00:00Z",
        imageUrl: `https://example.com/${userId}/scan-1/original.jpg?token=abc&expires=3600`,
        attentionCount: 2,
        detectionsCount: 3,
        modelVersion: "v1.0",
      });

      expect(summaries[1]).toEqual({
        id: "scan-2",
        createdAt: "2026-10-27T10:00:00Z",
        imageUrl: `https://example.com/${userId}/scan-2/original.jpg?token=abc&expires=3600`,
        attentionCount: 0,
        detectionsCount: 1,
        modelVersion: "v1.0",
      });

      expect(createSignedUrlMock).toHaveBeenCalledWith(`${userId}/scan-1/original.jpg`, 3600);
      expect(createSignedUrlMock).toHaveBeenCalledWith(`${userId}/scan-2/original.jpg`, 3600);
    });

    it("validates detections with Zod safeParse and falls back safely on corrupted data", async () => {
      const scansInDb = [
        {
          id: "scan-corrupt",
          user_id: userId,
          image_path: `${userId}/scan-corrupt/original.jpg`,
          model_version: "v1.0",
          detections: [
            { class_id: 999, confidence: 5.0, box: "corrupted-box" }, // invalid schema
          ],
          created_at: "2026-10-28T10:00:00Z",
        },
      ];

      const orderMock = vi.fn().mockResolvedValue({ data: scansInDb, error: null });
      const eqMock = vi.fn(() => ({ order: orderMock }));
      const selectMock = vi.fn(() => ({ eq: eqMock }));
      const createSignedUrlMock = vi.fn(() =>
        Promise.resolve({
          data: { signedUrl: "https://example.com/thumb.jpg" },
          error: null,
        }),
      );

      const supabaseMock = {
        from: vi.fn(() => ({ select: selectMock })),
        storage: {
          from: vi.fn(() => ({ createSignedUrl: createSignedUrlMock })),
        },
      } as unknown as SupabaseClient<Database>;

      const summaries = await getUserScans(supabaseMock, userId);

      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toEqual({
        id: "scan-corrupt",
        createdAt: "2026-10-28T10:00:00Z",
        imageUrl: "https://example.com/thumb.jpg",
        attentionCount: 0,
        detectionsCount: 0,
        modelVersion: "v1.0",
      });
    });
  });

  describe("getUserChats", () => {
    it("queries user chats ordered by updated_at desc", async () => {
      const chatsInDb = [
        {
          id: "chat-1",
          title: "Pertanyaan Gigi Depan",
          scan_id: "scan-1",
          created_at: "2026-10-28T09:00:00Z",
          updated_at: "2026-10-28T09:30:00Z",
        },
        {
          id: "chat-2",
          title: "Tanya Dokter Gigi Umum",
          scan_id: null,
          created_at: "2026-10-27T08:00:00Z",
          updated_at: "2026-10-27T08:15:00Z",
        },
      ];

      const orderMock = vi.fn().mockResolvedValue({ data: chatsInDb, error: null });
      const eqMock = vi.fn(() => ({ order: orderMock }));
      const selectMock = vi.fn(() => ({ eq: eqMock }));

      const supabaseMock = {
        from: vi.fn(() => ({ select: selectMock })),
      } as unknown as SupabaseClient<Database>;

      const chats = await getUserChats(supabaseMock, userId);

      expect(supabaseMock.from).toHaveBeenCalledWith("chats");
      expect(selectMock).toHaveBeenCalledWith("id, title, created_at, updated_at, scan_id");
      expect(eqMock).toHaveBeenCalledWith("user_id", userId);
      expect(orderMock).toHaveBeenCalledWith("updated_at", { ascending: false });

      expect(chats).toEqual([
        {
          id: "chat-1",
          title: "Pertanyaan Gigi Depan",
          createdAt: "2026-10-28T09:00:00Z",
          updatedAt: "2026-10-28T09:30:00Z",
          scanId: "scan-1",
        },
        {
          id: "chat-2",
          title: "Tanya Dokter Gigi Umum",
          createdAt: "2026-10-27T08:00:00Z",
          updatedAt: "2026-10-27T08:15:00Z",
          scanId: null,
        },
      ]);
    });
  });

  describe("getScanDetail", () => {
    it("returns scan detail with validated detections, signed URL, heatmaps, and chat", async () => {
      const scanRow = {
        id: scanId,
        user_id: userId,
        image_path: `${userId}/${scanId}/original.jpg`,
        image_width: 1024,
        image_height: 512,
        model_version: "v1.0",
        source: "upload",
        detections: [{ class_id: 0, confidence: 0.9, box: [1, 2, 3, 4] }],
        heatmap_class_ids: [0],
        insight: { summary: "Insight mock" },
        insight_locale: "id",
        insight_prompt_version: "1.0",
        created_at: "2026-10-28T10:00:00Z",
      };

      const chatRow = {
        id: "chat-scan-1",
        scan_id: scanId,
        user_id: userId,
        title: "Diskusi Hasil Scan",
        created_at: "2026-10-28T10:05:00Z",
        updated_at: "2026-10-28T10:10:00Z",
      };

      const messagesRows = [
        { id: 1, role: "user", content: "Halo dok", created_at: "2026-10-28T10:05:00Z" },
        {
          id: 2,
          role: "assistant",
          content: "Halo! Ada yang bisa dibantu?",
          created_at: "2026-10-28T10:06:00Z",
        },
      ];

      const createSignedUrlMock = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://example.com/original.jpg?signed=true" },
        error: null,
      });

      const heatmapBlob = {
        arrayBuffer: () => Promise.resolve(Buffer.from("PNGDATA")),
      };
      const downloadMock = vi.fn().mockResolvedValue({
        data: heatmapBlob,
        error: null,
      });

      const supabaseMock = {
        from: vi.fn((table: string) => {
          if (table === "scans") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: scanRow, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "chats") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: chatRow, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "chat_messages") {
            return {
              select: () => ({
                eq: () => ({
                  order: vi.fn().mockResolvedValue({ data: messagesRows, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn(() => ({
            createSignedUrl: createSignedUrlMock,
            download: downloadMock,
          })),
        },
      } as unknown as SupabaseClient<Database>;

      const detail = await getScanDetail(supabaseMock, userId, scanId);

      expect(detail).not.toBeNull();
      expect(detail?.id).toBe(scanId);
      expect(detail?.imageUrl).toBe("https://example.com/original.jpg?signed=true");
      expect(detail?.detections).toEqual([{ class_id: 0, confidence: 0.9, box: [1, 2, 3, 4] }]);
      expect(detail?.heatmaps["0"]).toBe(Buffer.from("PNGDATA").toString("base64"));
      expect(detail?.chat?.messages).toHaveLength(2);
      expect(detail?.chat?.messages[0]?.content).toBe("Halo dok");
    });

    it("throws ZodError when detections in database fail schema validation", async () => {
      const corruptScanRow = {
        id: scanId,
        user_id: userId,
        image_path: `${userId}/${scanId}/original.jpg`,
        image_width: 1024,
        image_height: 512,
        model_version: "v1.0",
        source: "upload",
        detections: [
          { class_id: 999, confidence: 2.5, box: "invalid" }, // invalid class_id (>30) and confidence (>1)
        ],
        heatmap_class_ids: [],
        insight: null,
        created_at: "2026-10-28T10:00:00Z",
      };

      const supabaseMock = {
        from: vi.fn(() => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: corruptScanRow, error: null }),
              }),
            }),
          }),
        })),
        storage: {
          from: vi.fn(() => ({
            createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "url" }, error: null }),
          })),
        },
      } as unknown as SupabaseClient<Database>;

      await expect(getScanDetail(supabaseMock, userId, scanId)).rejects.toThrow(ZodError);
    });

    it("returns null if scan row does not exist", async () => {
      const supabaseMock = {
        from: vi.fn(() => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        })),
      } as unknown as SupabaseClient<Database>;

      const detail = await getScanDetail(supabaseMock, userId, "non-existent-scan");
      expect(detail).toBeNull();
    });
  });
});
