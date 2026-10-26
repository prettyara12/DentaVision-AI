import { describe, expect, it } from "vitest";
import { readBody } from "./body";

function request(body: string, contentLength: string | null, chunks = 1) {
  const bytes = new TextEncoder().encode(body);
  const size = Math.ceil(bytes.length / chunks);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
      controller.close();
    },
  });
  return new Request("http://test/api", {
    method: "POST",
    body: stream,
    // @ts-expect-error -- Node needs duplex for a streamed request body
    duplex: "half",
    headers: {
      "content-type": "application/json",
      ...(contentLength === null ? {} : { "content-length": contentLength }),
    },
  });
}

const status = async (result: Awaited<ReturnType<typeof readBody>>) =>
  "error" in result ? [result.error.status, (await result.error.json()).code] : "ok";

describe("readBody", () => {
  it("returns the body with its content type when it fits", async () => {
    const result = await readBody(request('{"a":1}', "7"), 10);
    if ("error" in result) throw new Error("expected a body");
    expect(await result.body.json()).toEqual({ a: 1 });
  });

  it("needs a numeric Content-Length and rejects a declared size over the cap", async () => {
    expect(await status(await readBody(request("{}", null), 10))).toEqual([411, "length_required"]);
    expect(await status(await readBody(request("{}", "abc"), 10))).toEqual([
      411,
      "length_required",
    ]);
    expect(await status(await readBody(request("{}", "11"), 10))).toEqual([413, "too_large"]);
  });

  it("stops at the cap when the client under-declares Content-Length", async () => {
    const big = JSON.stringify({ text: "x".repeat(100) });
    expect(await status(await readBody(request(big, "2", 8), 50))).toEqual([413, "too_large"]);
  });
});
