import { describe, expect, it } from "vitest";
import { nextTheme, themeScript } from "./theme-toggle";

describe("theme toggle", () => {
  it("cycles system → light → dark → system", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });

  it("restores only a known saved theme before paint", () => {
    const root = { dataset: {} as Record<string, string> };
    const run = (saved: string | null) => {
      root.dataset = {};
      new Function("localStorage", "document", themeScript)(
        { getItem: () => saved },
        { documentElement: root },
      );
      return root.dataset.theme;
    };
    expect(run("dark")).toBe("dark");
    expect(run("light")).toBe("light");
    expect(run("<script>")).toBeUndefined();
    expect(run(null)).toBeUndefined();
  });
});
