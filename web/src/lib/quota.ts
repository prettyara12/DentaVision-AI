import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export type QuotaKind = "scan" | "chat";

export interface QuotaSubjectInfo {
  subject: string;
  role: "user" | "guest";
}

export interface QuotaCheckResult {
  ok: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

export interface QuotaConsumeResult {
  ok: boolean;
  limit: number;
  remaining?: number;
  resetInSeconds: number;
}

const WITA_OFFSET_HOURS = 8;
const WITA_OFFSET_MS = WITA_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Returns today's date string in WITA (Asia/Makassar, UTC+8) formatted as YYYY-MM-DD.
 */
export function getWitaDateString(now = Date.now()): string {
  const witaTime = new Date(now + WITA_OFFSET_MS);
  const year = witaTime.getUTCFullYear();
  const month = String(witaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(witaTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculates remaining seconds until 00:00 WITA (next daily reset).
 */
export function getResetSeconds(now = Date.now()): number {
  const witaTime = new Date(now + WITA_OFFSET_MS);
  const nextWitaMidnightUtc =
    Date.UTC(
      witaTime.getUTCFullYear(),
      witaTime.getUTCMonth(),
      witaTime.getUTCDate() + 1,
      0,
      0,
      0,
    ) - WITA_OFFSET_MS;
  const diffSec = Math.ceil((nextWitaMidnightUtc - now) / 1000);
  return diffSec > 0 && diffSec <= 86400 ? diffSec : 86400;
}

/**
 * Extracts client IP from request headers or defaults to localhost.
 * Trust boundary: on Vercel these headers are written by the platform, which overwrites any
 * client-sent X-Forwarded-For (docs/architecture.md §4.1). Behind another host they must be
 * set by a proxy that drops incoming values, or guests could rotate IPs for fresh quota.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return "127.0.0.1";
}

/**
 * Identifies the subject for quota tracking:
 * - Authenticated: 'u:{user_id}'
 * - Guest: 'ip:{sha256(ip + salt)}'
 */
export function getQuotaSubject(user: { id: string } | null, request: Request): QuotaSubjectInfo {
  if (user) {
    return {
      subject: `u:${user.id}`,
      role: "user",
    };
  }
  const ip = getClientIp(request);
  const salt = env().IP_HASH_SALT;
  const hash = createHash("sha256").update(`${ip}${salt}`).digest("hex");
  return {
    subject: `ip:${hash}`,
    role: "guest",
  };
}

/**
 * Gets the configured quota limits based on role and kind.
 */
export function getQuotaLimit(role: "user" | "guest", kind: QuotaKind): number {
  const currentEnv = env();
  if (role === "user") {
    return kind === "scan" ? currentEnv.QUOTA_USER_SCANS : currentEnv.QUOTA_USER_CHATS;
  }
  return kind === "scan" ? currentEnv.QUOTA_GUEST_SCANS : currentEnv.QUOTA_GUEST_CHATS;
}

/**
 * Generates standard HTTP rate limiting headers.
 */
export function quotaHeaders(info: {
  limit: number;
  remaining: number;
  resetInSeconds: number;
}): Record<string, string> {
  return {
    "RateLimit-Limit": String(info.limit),
    "RateLimit-Remaining": String(Math.max(0, info.remaining)),
    "RateLimit-Reset": String(info.resetInSeconds),
    "Retry-After": String(info.resetInSeconds),
  };
}

/**
 * Reads the current usage count without incrementing.
 * Note: Must be called with a service_role client (createAdminClient) because
 * usage_counters permissions are revoked from anon/authenticated roles.
 */
export async function checkQuota(
  supabase: SupabaseClient<Database>,
  subject: string,
  kind: QuotaKind,
  max: number,
): Promise<QuotaCheckResult> {
  const day = getWitaDateString();
  const resetInSeconds = getResetSeconds();

  const { data, error } = await supabase
    .from("usage_counters")
    .select("count")
    .eq("subject", subject)
    .eq("day", day)
    .eq("kind", kind)
    .maybeSingle();

  // Fail closed: an unreadable counter must not unlock paid Gemini calls; routes answer "unavailable".
  if (error) throw new Error(`Failed to check quota: ${error.message}`);

  const count = data?.count ?? 0;
  return {
    ok: count < max,
    count,
    limit: max,
    remaining: Math.max(0, max - count),
    resetInSeconds,
  };
}

/**
 * Atomically consumes 1 unit of daily quota via PostgreSQL RPC.
 * Note: Must be called with a service_role client (createAdminClient) because
 * consume_quota execute permission is granted only to service_role.
 */
export async function consumeQuota(
  supabase: SupabaseClient<Database>,
  subject: string,
  kind: QuotaKind,
  max: number,
): Promise<QuotaConsumeResult> {
  const resetInSeconds = getResetSeconds();

  const { data, error } = await supabase.rpc("consume_quota", {
    subject,
    kind,
    max,
  });

  // Fail closed, but as an outage rather than a false "quota used up".
  if (error) throw new Error(`Failed to consume quota: ${error.message}`);

  return {
    ok: Boolean(data),
    limit: max,
    resetInSeconds,
  };
}
