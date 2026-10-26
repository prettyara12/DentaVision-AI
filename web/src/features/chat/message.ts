import { z } from "zod";

// Kept apart from chat.ts so the stored scan schema can use it without an import cycle.
export const MAX_USER_CHARS = 2_000;
// Earlier AI answers travel back with the history; up to 5 sentences fits well under this.
export const MAX_MODEL_CHARS = 4_000;
// A guest conversation keeps this many messages (shown and stored); Gemini still gets the last 20.
export const MAX_KEPT_MESSAGES = 100;

export const chatMessageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), text: z.string().trim().min(1).max(MAX_USER_CHARS) }),
  z.object({ role: z.literal("model"), text: z.string().max(MAX_MODEL_CHARS) }),
]);

export type ChatMessage = z.infer<typeof chatMessageSchema>;
