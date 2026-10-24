import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import id from "../../messages/id.json";
import { resolveLocale, t } from "./i18n";

describe("resolveLocale", () => {
  it("prefers a valid cookie over Accept-Language", () => {
    expect(resolveLocale("en", "id-ID,id;q=0.9")).toBe("en");
  });

  it("ignores an unknown cookie and reads Accept-Language in order", () => {
    expect(resolveLocale("fr", "fr-FR,en-US;q=0.8,id;q=0.5")).toBe("en");
  });

  it("falls back to Indonesian", () => {
    expect(resolveLocale(undefined, null)).toBe("id");
    expect(resolveLocale(undefined, "ja,de")).toBe("id");
  });
});

describe("messages", () => {
  it("has the same keys in every locale", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(id).sort());
  });

  it("returns the text for the locale", () => {
    expect(t("en", "home.status")).toBe("In development");
  });
});
