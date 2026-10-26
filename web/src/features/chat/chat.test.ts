import { describe, expect, it } from "vitest";
import { lastTurns, suggestions } from "./chat";
import type { ChatMessage } from "./message";

const turns = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "model" : "user", text: `m${i}` }));

describe("lastTurns", () => {
  it("keeps the last 20 messages, starting at a user turn", () => {
    expect(lastTurns(turns(3))).toEqual(turns(3));
    const recent = lastTurns(turns(25));
    // The last 20 start at m5 (a model turn), so it is dropped.
    expect(recent.map((m) => m.text)).toEqual(
      turns(25)
        .slice(6)
        .map((m) => m.text),
    );
    expect(lastTurns([{ role: "model", text: "Hi." }])).toEqual([]);
  });
});

describe("suggestions", () => {
  const caries = {
    class_id: 0,
    confidence: 0.71,
    box: [0, 0, 1, 1] as [number, number, number, number],
  };

  it("gives three questions, naming the top attention finding", () => {
    const qs = suggestions("en", [caries]);
    expect(qs).toHaveLength(3);
    expect(qs[0]).toBe("The AI marked Cavity (caries). What does that mean?");
    expect(new Set(qs).size).toBe(3);
  });

  it("falls back to general questions without findings or a scan", () => {
    expect(suggestions("id", [])).toHaveLength(3);
    const general = suggestions("id", null);
    expect(general).toHaveLength(3);
    expect(general[0]).toBe("Bagaimana cara menyikat gigi yang benar?");
  });
});
