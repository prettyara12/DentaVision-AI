import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const deleteScan = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  currentUser,
  createClient,
}));

vi.mock("@/features/history/data", () => ({
  deleteScan,
}));

const { DELETE } = await import("./route");

beforeEach(() => {
  currentUser.mockReset();
  createClient.mockReset();
  deleteScan.mockReset();
});

describe("DELETE /api/scans/[id]", () => {
  it("returns 401 when user is not authenticated", async () => {
    currentUser.mockResolvedValue(null);
    const request = new Request("http://test/api/scans/scan-123", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "scan-123" }) });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "unauthorized" });
    expect(deleteScan).not.toHaveBeenCalled();
  });

  it("returns 404 when scan is not found", async () => {
    currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
    createClient.mockResolvedValue({});
    deleteScan.mockResolvedValue({ ok: false, notFound: true });

    const request = new Request("http://test/api/scans/scan-123", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "scan-123" }) });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "not_found" });
    expect(deleteScan).toHaveBeenCalledWith({}, "user-1", "scan-123");
  });

  it("returns 500 storage_error when deletion fails", async () => {
    currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
    createClient.mockResolvedValue({});
    deleteScan.mockResolvedValue({ ok: false, error: "Failed to remove files from storage" });

    const request = new Request("http://test/api/scans/scan-123", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "scan-123" }) });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "storage_error" });
  });

  it("returns 204 when scan is deleted successfully", async () => {
    currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
    createClient.mockResolvedValue({});
    deleteScan.mockResolvedValue({ ok: true });

    const request = new Request("http://test/api/scans/scan-123", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "scan-123" }) });

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(deleteScan).toHaveBeenCalledWith({}, "user-1", "scan-123");
  });
});
