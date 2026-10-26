import { describe, expect, it } from "vitest";
import { localeOf, safeNext } from "./next-path";

describe("safeNext", () => {
  it("keeps same-site page paths under a locale, with their query", () => {
    expect(safeNext("/en/scan/result", "id")).toBe("/en/scan/result");
    expect(safeNext("/id/reset-password?mode=update", "id")).toBe("/id/reset-password?mode=update");
  });

  it.each([
    "https://evil.test/id",
    "//evil.test/id",
    "/\\evil.test/id",
    "/%2F%2Fevil.test",
    "javascript:alert(1)",
    "/api/chat",
    "/fr/scan",
    "",
    null,
  ])("falls back to the scan page for %s", (next) => {
    expect(safeNext(next, "en")).toBe("/en/scan");
  });
});

describe("localeOf", () => {
  it("reads the locale prefix of a next path", () => {
    expect(localeOf("/en/scan")).toBe("en");
    expect(localeOf("/id?x=1")).toBe("id");
    expect(localeOf("/fr/scan")).toBeNull();
    expect(localeOf(null)).toBeNull();
  });
});
