import { defineConfig } from "vitest/config";
import base from "./vitest.config";

// `npm run eval:insight`: calls the real Gemini API (docs/ai-design.md §6). Never part of `npm test` or CI.
export default defineConfig({
  resolve: base.resolve,
  test: { include: ["tests/eval/**/*.eval.ts"], testTimeout: 90_000 },
});
