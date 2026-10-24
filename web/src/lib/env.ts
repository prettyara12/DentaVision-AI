import "server-only";
import { z } from "zod";

// Parsed lazily (on first call), so `next build` in CI needs no secrets.
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
  GEMINI_FALLBACK_MODEL: z.string().min(1).optional(),
  INFERENCE_API_URL: z.url(),
  INFERENCE_API_SECRET: z.string().min(16),
  IP_HASH_SALT: z.string().min(16),
  QUOTA_GUEST_SCANS: z.coerce.number().int().nonnegative().default(5),
  QUOTA_GUEST_CHATS: z.coerce.number().int().nonnegative().default(20),
  QUOTA_USER_SCANS: z.coerce.number().int().nonnegative().default(20),
  QUOTA_USER_CHATS: z.coerce.number().int().nonnegative().default(100),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Name the variables only; never echo values.
    const names = [...new Set(result.error.issues.map((i) => i.path.join(".")))];
    throw new Error(`Invalid or missing env: ${names.join(", ")}`);
  }
  return result.data;
}

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
