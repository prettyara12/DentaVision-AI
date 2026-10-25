// matplotlib "inferno" sampled at 9 even stops (docs/design-system.md §3.1); linear blend in between.
const INFERNO: readonly (readonly [number, number, number])[] = [
  [0, 0, 4],
  [31, 12, 72],
  [85, 15, 109],
  [136, 34, 106],
  [186, 54, 85],
  [227, 89, 51],
  [249, 140, 10],
  [249, 201, 50],
  [252, 255, 164],
];

export const DEFAULT_HEATMAP_OPACITY = 0.55;

/** Inferno colour for intensity 0–255. */
export function inferno(value: number): [number, number, number] {
  const pos = (Math.min(255, Math.max(0, value)) / 255) * (INFERNO.length - 1);
  const i = Math.min(INFERNO.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = INFERNO[i]!;
  const b = INFERNO[i + 1]!;
  return [0, 1, 2].map((k) => Math.round(a[k]! + (b[k]! - a[k]!) * f)) as [number, number, number];
}

/** Grayscale RGBA pixels (from the API's 8-bit PNG) → inferno with alpha rising with intensity, in place. */
export function colorize(pixels: Uint8ClampedArray): Uint8ClampedArray {
  for (let p = 0; p < pixels.length; p += 4) {
    const v = pixels[p]!;
    const [r, g, b] = inferno(v);
    pixels[p] = r;
    pixels[p + 1] = g;
    pixels[p + 2] = b;
    pixels[p + 3] = v;
  }
  return pixels;
}
