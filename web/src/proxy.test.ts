import { NextRequest } from "next/server";
// Docs name it unstable_doesProxyMatch; next 16.4.3 still exports the middleware name.
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.hoisted(() => vi.fn());
const createServerClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/lib/env", () => ({
  env: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://sb.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  }),
}));

const { config, proxy } = await import("./proxy");

const base = "https://dentavision.test";

function run(path: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(`${base}${path}`, { headers }));
}

describe("proxy matcher", () => {
  it.each(["/", "/scan", "/id", "/en/scan/result", "/history"])("runs on page path %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each(["/api/scans", "/_next/static/chunk.js", "/favicon.ico", "/samples/opg.jpg"])(
    "skips %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    },
  );
});

beforeEach(() => {
  getClaims.mockReset().mockResolvedValue({ data: null, error: null });
  createServerClient.mockReset().mockReturnValue({ auth: { getClaims } });
});

describe("proxy redirect", () => {
  it("leaves locale-prefixed paths alone", async () => {
    expect(getRedirectUrl(await run("/id"))).toBeNull();
    expect(getRedirectUrl(await run("/en/scan"))).toBeNull();
  });

  it("keeps the auth callback URL registered with Supabase", async () => {
    expect(getRedirectUrl(await run("/auth/callback?code=abc"))).toBeNull();
  });

  it("redirects the root to the Accept-Language locale", async () => {
    expect(getRedirectUrl(await run("/", { "accept-language": "en-US,en;q=0.9" }))).toBe(
      `${base}/en`,
    );
  });

  it("keeps nested paths and the query string", async () => {
    expect(getRedirectUrl(await run("/scan/result?sample=1&x=2"))).toBe(
      `${base}/id/scan/result?sample=1&x=2`,
    );
  });

  it("prefers a valid cookie and ignores an invalid one", async () => {
    expect(
      getRedirectUrl(await run("/scan", { cookie: "locale=en", "accept-language": "id" })),
    ).toBe(`${base}/en/scan`);
    expect(
      getRedirectUrl(await run("/scan", { cookie: "locale=fr", "accept-language": "en" })),
    ).toBe(`${base}/en/scan`);
  });

  it("does not treat a lookalike prefix as a locale", async () => {
    expect(getRedirectUrl(await run("/identity"))).toBe(`${base}/id/identity`);
  });
});

describe("proxy session refresh", () => {
  it("skips Supabase entirely for guests", async () => {
    await run("/id/scan", { cookie: "locale=id" });
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("refreshes the session and forwards new auth cookies for signed-in users", async () => {
    createServerClient.mockImplementation((_url, _key, { cookies }) => ({
      auth: {
        getClaims: async () => {
          cookies.setAll([{ name: "sb-ref-auth-token", value: "fresh", options: { path: "/" } }], {
            "Cache-Control": "private, no-store",
          });
          return { data: null, error: null };
        },
      },
    }));
    const response = await run("/id/scan", { cookie: "sb-ref-auth-token=stale" });
    expect(createServerClient).toHaveBeenCalledWith("https://sb.test", "anon", expect.anything());
    expect(response.cookies.get("sb-ref-auth-token")?.value).toBe("fresh");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
