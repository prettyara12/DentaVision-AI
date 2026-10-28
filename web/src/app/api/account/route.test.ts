import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());
const deleteAccount = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  currentUser,
  createClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}));

vi.mock("@/features/history/data", () => ({
  deleteAccount,
}));

const { DELETE } = await import("./route");

beforeEach(() => {
  currentUser.mockReset();
  createClient.mockReset();
  createAdminClient.mockReset();
  deleteAccount.mockReset();
});

describe("DELETE /api/account", () => {
  it("returns 401 when user is not authenticated", async () => {
    currentUser.mockResolvedValue(null);
    const response = await DELETE();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "unauthorized" });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("returns 500 storage_error when storage cleanup or account deletion fails", async () => {
    currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
    createClient.mockResolvedValue({ client: "user" });
    createAdminClient.mockReturnValue({ client: "admin" });
    deleteAccount.mockResolvedValue({ ok: false, error: "Storage delete batch failed" });

    const response = await DELETE();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "storage_error" });
    expect(deleteAccount).toHaveBeenCalledWith({ client: "admin" }, { client: "user" }, "user-1");
  });

  it("returns 204 when account and storage are deleted successfully", async () => {
    currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
    createClient.mockResolvedValue({ client: "user" });
    createAdminClient.mockReturnValue({ client: "admin" });
    deleteAccount.mockResolvedValue({ ok: true });

    const response = await DELETE();

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(deleteAccount).toHaveBeenCalledWith({ client: "admin" }, { client: "user" }, "user-1");
  });
});
