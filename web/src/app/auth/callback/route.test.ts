import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

const { GET } = await import("./route");

const get = (query: string, headers: Record<string, string> = {}) =>
  GET(new NextRequest(`https://dentavision.test/auth/callback${query}`, { headers }));

beforeEach(() => {
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
});

describe("GET /auth/callback", () => {
  it("swaps the code for a session and goes to the safe next path", async () => {
    const response = await get(`?code=abc&next=${encodeURIComponent("/en/scan/result")}`);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe("https://dentavision.test/en/scan/result");
  });

  it("never redirects off-site", async () => {
    const response = await get(`?code=abc&next=${encodeURIComponent("//evil.test/id")}`);
    expect(response.headers.get("location")).toBe("https://dentavision.test/id/scan");
  });

  it("sends a failed or missing code to the login page with a notice", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });
    const failed = await get(`?code=old&next=${encodeURIComponent("/en/scan")}`);
    expect(failed.headers.get("location")).toBe("https://dentavision.test/en/login?error=link");

    const denied = await get("?error=access_denied", { "accept-language": "en" });
    expect(denied.headers.get("location")).toBe("https://dentavision.test/en/login?error=link");
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });
});
