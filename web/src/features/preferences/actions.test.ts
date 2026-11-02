import { beforeEach, describe, expect, it, vi } from "vitest";

const setCookie = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ cookies: async () => ({ set: setCookie }) }));

const currentUser = vi.hoisted(() => vi.fn());
const eq = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn(() => ({ eq })));
vi.mock("@/lib/supabase/server", () => ({
  currentUser,
  createClient: async () => ({ from: () => ({ update }) }),
}));

const { switchLocale } = await import("./actions");

beforeEach(() => {
  setCookie.mockClear();
  update.mockClear();
  eq.mockReset().mockResolvedValue({ error: null });
  currentUser.mockReset().mockResolvedValue(null);
});

describe("switchLocale", () => {
  it("returns the same page in the other language and remembers it in the cookie", async () => {
    expect(await switchLocale("en", "/id/reset-password?mode=update")).toBe(
      "/en/reset-password?mode=update",
    );
    expect(setCookie).toHaveBeenCalledWith("locale", "en", expect.objectContaining({ path: "/" }));
    expect(update).not.toHaveBeenCalled();
  });

  it("also saves the choice in the profile when signed in", async () => {
    currentUser.mockResolvedValue({ id: "u1", email: null });
    expect(await switchLocale("id", "/en/history")).toBe("/id/history");
    expect(update).toHaveBeenCalledWith({ locale: "id" });
    expect(eq).toHaveBeenCalledWith("id", "u1");
  });

  it("still switches when the profile write fails", async () => {
    currentUser.mockResolvedValue({ id: "u1", email: null });
    eq.mockResolvedValue({ error: { message: "down" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await switchLocale("en", "/id")).toBe("/en");
    log.mockRestore();
  });

  it.each(["https://evil.test/id", "//evil.test/id", "/api/scans"])(
    "never leads off-site (%s)",
    async (next) => {
      expect(await switchLocale("en", next)).toBe("/en/scan");
    },
  );

  it("falls back to Indonesian for an unknown language", async () => {
    expect(await switchLocale("fr", "/en/chat")).toBe("/id/chat");
  });
});
