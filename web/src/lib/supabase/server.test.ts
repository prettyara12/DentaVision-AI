import { describe, expect, it, vi } from "vitest";
import { hasAuthCookie } from "./server";
import { createAdminClient } from "./admin";

vi.mock("@/lib/env", () => ({
  env: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-test",
  }),
}));

describe("hasAuthCookie", () => {
  it("returns true when supabase auth token cookie is present", () => {
    expect(hasAuthCookie(["sb-projectref-auth-token"])).toBe(true);
    expect(hasAuthCookie(["other", "sb-abc-auth-token.0"])).toBe(true);
  });

  it("returns false when supabase auth token cookie is absent", () => {
    expect(hasAuthCookie([])).toBe(false);
    expect(hasAuthCookie(["session_id", "sb-other-cookie"])).toBe(false);
  });
});

describe("createAdminClient", () => {
  it("creates a supabase client with service role key", () => {
    const client = createAdminClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});
