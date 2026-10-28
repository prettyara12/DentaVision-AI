import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import {
  checkQuota,
  consumeQuota,
  getClientIp,
  getQuotaLimit,
  getQuotaSubject,
  getResetSeconds,
  getWitaDateString,
  quotaHeaders,
} from "./quota";

vi.mock("./env", () => ({
  env: () => ({
    IP_HASH_SALT: "0123456789abcdef0123456789abcdef",
    QUOTA_GUEST_SCANS: 5,
    QUOTA_GUEST_CHATS: 20,
    QUOTA_USER_SCANS: 20,
    QUOTA_USER_CHATS: 100,
  }),
}));

describe("getClientIp", () => {
  it("extracts the first IP from x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178" },
    });
    expect(getClientIp(req)).toBe("203.0.113.195");
  });

  it("extracts IP from x-real-ip when x-forwarded-for is missing", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "198.51.100.1" },
    });
    expect(getClientIp(req)).toBe("198.51.100.1");
  });

  it("falls back to 127.0.0.1 when headers are absent", () => {
    const req = new Request("https://example.com");
    expect(getClientIp(req)).toBe("127.0.0.1");
  });
});

describe("getQuotaSubject", () => {
  it("returns user prefix for authenticated user", () => {
    const req = new Request("https://example.com");
    const res = getQuotaSubject({ id: "user-uuid-123" }, req);
    expect(res).toEqual({
      subject: "u:user-uuid-123",
      role: "user",
    });
  });

  it("returns salted hashed IP for guest", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "198.51.100.1" },
    });
    const res = getQuotaSubject(null, req);
    expect(res.role).toBe("guest");
    expect(res.subject.startsWith("ip:")).toBe(true);
    // SHA256 hex is 64 chars + 3 for "ip:"
    expect(res.subject.length).toBe(67);
  });
});

describe("getQuotaLimit", () => {
  it("returns configured limits per role and kind", () => {
    expect(getQuotaLimit("user", "scan")).toBe(20);
    expect(getQuotaLimit("user", "chat")).toBe(100);
    expect(getQuotaLimit("guest", "scan")).toBe(5);
    expect(getQuotaLimit("guest", "chat")).toBe(20);
  });
});

describe("getWitaDateString", () => {
  it("formats dates based on WITA (UTC+8)", () => {
    // 2026-10-28 15:59:59 UTC = 2026-10-28 23:59:59 WITA
    const beforeUtc = Date.UTC(2026, 9, 28, 15, 59, 59);
    expect(getWitaDateString(beforeUtc)).toBe("2026-10-28");

    // 2026-10-28 16:00:00 UTC = 2026-10-29 00:00:00 WITA
    const afterUtc = Date.UTC(2026, 9, 28, 16, 0, 0);
    expect(getWitaDateString(afterUtc)).toBe("2026-10-29");
  });
});

describe("getResetSeconds", () => {
  it("calculates positive seconds until next 00:00 WITA", () => {
    const seconds = getResetSeconds();
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(86400);
  });

  it("calculates deterministically for a known time", () => {
    // 2026-10-28 15:59:50 UTC (10 seconds before WITA midnight)
    const fixedNow = Date.UTC(2026, 9, 28, 15, 59, 50);
    expect(getResetSeconds(fixedNow)).toBe(10);
  });
});

describe("quotaHeaders", () => {
  it("constructs standard rate limit headers", () => {
    const headers = quotaHeaders({
      limit: 5,
      remaining: 0,
      resetInSeconds: 3600,
    });
    expect(headers["RateLimit-Limit"]).toBe("5");
    expect(headers["RateLimit-Remaining"]).toBe("0");
    expect(headers["RateLimit-Reset"]).toBe("3600");
    expect(headers["Retry-After"]).toBe("3600");
  });
});

describe("checkQuota & consumeQuota", () => {
  it("checkQuota returns ok: true when below limit", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { count: 2 },
            error: null,
          }),
        }),
      }),
    };

    const res = await checkQuota(
      supabase as unknown as SupabaseClient<Database>,
      "ip:abc",
      "scan",
      5,
    );
    expect(res.ok).toBe(true);
    expect(res.count).toBe(2);
    expect(res.limit).toBe(5);
  });

  it("checkQuota returns ok: false when count reaches max", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { count: 5 },
            error: null,
          }),
        }),
      }),
    };

    const res = await checkQuota(
      supabase as unknown as SupabaseClient<Database>,
      "ip:abc",
      "scan",
      5,
    );
    expect(res.ok).toBe(false);
    expect(res.count).toBe(5);
  });

  it("checkQuota falls back gracefully on table query error", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("DB connection failed"),
          }),
        }),
      }),
    };

    const res = await checkQuota(
      supabase as unknown as SupabaseClient<Database>,
      "ip:abc",
      "scan",
      5,
    );
    expect(res.ok).toBe(true);
    expect(res.count).toBe(0);
  });

  it("consumeQuota calls consume_quota RPC", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    };

    const res = await consumeQuota(
      supabase as unknown as SupabaseClient<Database>,
      "ip:abc",
      "scan",
      5,
    );
    expect(supabase.rpc).toHaveBeenCalledWith("consume_quota", {
      subject: "ip:abc",
      kind: "scan",
      max: 5,
    });
    expect(res.ok).toBe(true);
    expect(res.limit).toBe(5);
  });

  it("consumeQuota returns ok: false when RPC returns false", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    };

    const res = await consumeQuota(
      supabase as unknown as SupabaseClient<Database>,
      "ip:abc",
      "scan",
      5,
    );
    expect(res.ok).toBe(false);
  });

  it("consumeQuota fails closed on RPC error", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("RPC timeout") }),
    };

    const res = await consumeQuota(
      supabase as unknown as SupabaseClient<Database>,
      "ip:abc",
      "scan",
      5,
    );
    expect(res.ok).toBe(false);
  });
});
