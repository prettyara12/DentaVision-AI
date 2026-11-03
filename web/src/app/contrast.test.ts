import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// design-system §3: every text/background pair passes WCAG 2.2 AA (4.5:1).
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const block = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries(
    [...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  );
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// --finding-anatomy is only used for boxes and swatches next to a text label, never as text.
const text = ["ink", "ink-2", "accent", "finding-attention", "finding-treatment", "warn"];
const surfaces = ["bg", "surface", "surface-2"];

const palettes = [
  ["light", tokens(":root {")],
  ["system dark", tokens(':root:not([data-theme="light"])')],
  ["forced dark", tokens(':root[data-theme="dark"]')],
  ["lightbox", tokens('[data-room="lightbox"]')],
] as const;

it.each(palettes)("%s palette defines every token", (_, t) => {
  for (const name of [...text, ...surfaces, "accent-ink"])
    expect(t[name]).toMatch(/^#[0-9a-f]{6}$/i);
});

describe.each(palettes)("%s palette", (_, t) => {
  it.each(text.flatMap((fg) => surfaces.map((bg) => [fg, bg])))("%s on %s", (fg, bg) => {
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it("accent-ink on accent", () => {
    expect(contrast(t["accent-ink"]!, t.accent!)).toBeGreaterThanOrEqual(4.5);
  });
});
