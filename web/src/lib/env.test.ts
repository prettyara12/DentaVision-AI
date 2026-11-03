import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  GEMINI_API_KEY: "key",
  GEMINI_MODEL: "gemini-3.5-flash-lite",
  INFERENCE_API_URL: "https://example.hf.space",
  INFERENCE_API_SECRET: "0123456789abcdef",
  IP_HASH_SALT: "0123456789abcdef",
};

describe("parseEnv", () => {
  it("applies quota defaults", () => {
    const env = parseEnv(valid);
    expect(env.QUOTA_GUEST_SCANS).toBe(5);
    expect(env.QUOTA_USER_CHATS).toBe(100);
  });

  it("reads quota overrides from strings", () => {
    expect(parseEnv({ ...valid, QUOTA_GUEST_SCANS: "2" }).QUOTA_GUEST_SCANS).toBe(2);
  });

  it("names missing variables without leaking values", () => {
    const run = () => parseEnv({ ...valid, GEMINI_API_KEY: undefined, IP_HASH_SALT: "short-salt" });
    expect(run).toThrow("Invalid or missing env: GEMINI_API_KEY, IP_HASH_SALT");
    expect(run).not.toThrow(/short-salt/);
  });
});
