import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const deleteChat = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  currentUser,
  createClient,
}));

vi.mock("@/features/history/data", () => ({
  deleteChat,
}));

const { DELETE } = await import("./route");

beforeEach(() => {
  currentUser.mockReset();
  createClient.mockReset();
  deleteChat.mockReset();
});

describe("DELETE /api/chats/[id]", () => {
  it("returns 401 when user is not authenticated", async () => {
    currentUser.mockResolvedValue(null);
    const request = new Request("http://test/api/chats/chat-123", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "chat-123" }) });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "unauthorized" });
    expect(deleteChat).not.toHaveBeenCalled();
  });

  it("returns 404 when chat is not found", async () => {
    currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
    createClient.mockResolvedValue({});
    deleteChat.mockResolvedValue({ ok: false, notFound: true });

    const request = new Request("http://test/api/chats/chat-123", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "chat-123" }) });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "not_found" });
    expect(deleteChat).toHaveBeenCalledWith({}, "user-1", "chat-123");
  });

  it("returns 500 database_error when deletion fails", async () => {
    currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
    createClient.mockResolvedValue({});
    deleteChat.mockResolvedValue({ ok: false, error: "Database error" });

    const request = new Request("http://test/api/chats/chat-123", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "chat-123" }) });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "database_error" });
  });

  it("returns 204 when chat is deleted successfully", async () => {
    currentUser.mockResolvedValue({ id: "user-1", email: "user@test.com" });
    createClient.mockResolvedValue({});
    deleteChat.mockResolvedValue({ ok: true });

    const request = new Request("http://test/api/chats/chat-123", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "chat-123" }) });

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(deleteChat).toHaveBeenCalledWith({}, "user-1", "chat-123");
  });
});
