import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, checkFile, fitWithin, readLines } from "./upload";

describe("checkFile", () => {
  it("accepts JPG and PNG up to 10 MB", () => {
    expect(checkFile({ type: "image/jpeg", size: MAX_FILE_BYTES })).toBeNull();
    expect(checkFile({ type: "image/png", size: 1 })).toBeNull();
  });

  it("rejects other types and larger files", () => {
    expect(checkFile({ type: "image/gif", size: 1 })).toBe("unsupported_type");
    expect(checkFile({ type: "", size: 1 })).toBe("unsupported_type");
    expect(checkFile({ type: "image/png", size: MAX_FILE_BYTES + 1 })).toBe("too_large");
  });
});

describe("fitWithin", () => {
  it("shrinks the longest side to 2048 and keeps the ratio", () => {
    expect(fitWithin(2944, 1476)).toEqual([2048, 1027]);
    expect(fitWithin(1000, 4096)).toEqual([500, 2048]);
  });

  it("never upscales", () => {
    expect(fitWithin(1024, 512)).toEqual([1024, 512]);
  });
});

describe("readLines", () => {
  it("yields one object per line, also across chunk boundaries", async () => {
    const chunks = ['{"a":1}\n{"b"', ':2}\n\n{"c":3}'];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    });
    const out: unknown[] = [];
    for await (const line of readLines(body)) out.push(line);
    expect(out).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  function trackedStream(chunks: string[]) {
    const state = { cancelled: false };
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      },
      cancel() {
        state.cancelled = true;
      },
    });
    return { body, state };
  }

  it("cancels the stream when the consumer stops early", async () => {
    const { body, state } = trackedStream(['{"final":true}\n', '{"late":1}\n']);
    for await (const line of readLines(body)) {
      expect(line).toEqual({ final: true });
      break;
    }
    expect(state.cancelled).toBe(true);
  });

  it("cancels the stream and rethrows on invalid JSON", async () => {
    const { body, state } = trackedStream(["not json\n"]);
    await expect(async () => {
      for await (const _ of readLines(body)) void _;
    }).rejects.toThrow(SyntaxError);
    expect(state.cancelled).toBe(true);
  });
});
