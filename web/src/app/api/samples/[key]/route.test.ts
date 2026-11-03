import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeResultSchema } from "@/features/scan/result";
import { samples } from "@/features/scan/samples";
import { GET, generateStaticParams } from "./route";

const get = (key: string) =>
  GET(new Request(`http://test/api/samples/${key}`), { params: Promise.resolve({ key }) });

describe("GET /api/samples/[key]", () => {
  it("prerenders every sample", () => {
    expect(generateStaticParams()).toEqual(samples.map(({ key }) => ({ key })));
  });

  it.each(samples.map((s) => s.key))("serves a valid result and image for %s", async (key) => {
    const response = await get(key);
    expect(response.status).toBe(200);
    const result = analyzeResultSchema.parse(await response.json());
    expect(result.detections.length).toBeGreaterThan(0);
    expect(existsSync(join(process.cwd(), "public/samples", `${key}.jpg`))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/samples", `${key}-thumb.jpg`))).toBe(true);
  });

  it.each(["nope", "__proto__", "toString"])("answers 404 for %s", async (key) => {
    expect((await get(key)).status).toBe(404);
  });
});
