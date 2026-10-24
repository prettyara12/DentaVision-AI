import { NextRequest } from "next/server";
// Docs name it unstable_doesProxyMatch; next 16.4.3 still exports the middleware name.
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

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

describe("proxy redirect", () => {
  it("leaves locale-prefixed paths alone", () => {
    expect(run("/id")).toBeUndefined();
    expect(run("/en/scan")).toBeUndefined();
  });

  it("redirects the root to the Accept-Language locale", () => {
    expect(getRedirectUrl(run("/", { "accept-language": "en-US,en;q=0.9" })!)).toBe(`${base}/en`);
  });

  it("keeps nested paths and the query string", () => {
    expect(getRedirectUrl(run("/scan/result?sample=1&x=2")!)).toBe(
      `${base}/id/scan/result?sample=1&x=2`,
    );
  });

  it("prefers a valid cookie and ignores an invalid one", () => {
    expect(getRedirectUrl(run("/scan", { cookie: "locale=en", "accept-language": "id" })!)).toBe(
      `${base}/en/scan`,
    );
    expect(getRedirectUrl(run("/scan", { cookie: "locale=fr", "accept-language": "en" })!)).toBe(
      `${base}/en/scan`,
    );
  });

  it("does not treat a lookalike prefix as a locale", () => {
    expect(getRedirectUrl(run("/identity")!)).toBe(`${base}/id/identity`);
  });
});
