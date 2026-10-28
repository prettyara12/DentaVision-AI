import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/** Supabase auth cookies are named `sb-<project-ref>-auth-token` (chunked as `.0`, `.1`, …). */
export const hasAuthCookie = (names: string[]) =>
  names.some((name) => name.startsWith("sb-") && name.includes("-auth-token"));

/**
 * Supabase client acting as the signed-in user (anon key + session cookies, so RLS applies).
 * Server Components cannot write cookies; there a refreshed session is written by src/proxy.ts.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();
  return createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: ignore, the proxy refreshes the session.
        }
      },
    },
  });
}

/** The signed-in user's id and email, or null for guests (no network call without a session cookie). */
export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const cookieStore = await cookies();
  if (!hasAuthCookie(cookieStore.getAll().map((c) => c.name))) return null;
  const { data } = await (await createClient()).auth.getClaims();
  const claims = data?.claims;
  return claims?.sub ? { id: claims.sub, email: claims.email ?? null } : null;
}
