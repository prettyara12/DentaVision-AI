"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale, type Locale, type MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "./next-path";

export type AuthState = { error?: MessageKey; sent?: true; done?: true } | undefined;

const email = z.string().trim().toLowerCase().pipe(z.email().max(320));
const password = z.string().min(1).max(72); // bcrypt, which Supabase uses, reads 72 bytes at most

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function langOf(form: FormData): Locale {
  const lang = form.get("lang");
  return isLocale(lang) ? lang : "id";
}

// Email links and Google return here; Supabase only accepts URLs on its allow list.
async function callbackUrl(next: string) {
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

// Supabase error codes we can explain; anything else gets the generic message.
const errorKeys: Record<string, MessageKey> = {
  invalid_credentials: "auth.error.invalid_credentials",
  email_not_confirmed: "auth.error.email_not_confirmed",
  weak_password: "auth.error.weak_password",
  same_password: "auth.error.same_password",
  over_email_send_rate_limit: "auth.error.rate_limited",
  over_request_rate_limit: "auth.error.rate_limited",
  session_not_found: "auth.error.link_expired",
};

function fail(error: AuthError): AuthState {
  const key = (error.code && errorKeys[error.code]) || "auth.error.generic";
  if (key === "auth.error.generic") console.error("auth failed:", error.code ?? error.status);
  return { error: key };
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const lang = langOf(form);
  const input = z.object({ email, password }).safeParse({
    email: field(form, "email"),
    password: field(form, "password"),
  });
  if (!input.success) return { error: "auth.error.invalid_input" };

  const { error } = await (await createClient()).auth.signInWithPassword(input.data);
  if (error) return fail(error);
  redirect(safeNext(field(form, "next"), lang));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const lang = langOf(form);
  const input = z.object({ email, password }).safeParse({
    email: field(form, "email"),
    password: field(form, "password"),
  });
  if (!input.success) return { error: "auth.error.invalid_input" };

  const next = safeNext(field(form, "next"), lang);
  const { data, error } = await (
    await createClient()
  ).auth.signUp({
    ...input.data,
    options: { emailRedirectTo: await callbackUrl(next) },
  });
  if (error) return fail(error);
  // Without email confirmation (local dev) the session starts right away.
  if (data.session) redirect(next);
  // Same answer whether or not the email already has an account (no account enumeration).
  return { sent: true };
}

export async function signInWithGoogle(_: AuthState, form: FormData): Promise<AuthState> {
  const next = safeNext(field(form, "next"), langOf(form));
  const { data, error } = await (
    await createClient()
  ).auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(next) },
  });
  if (error || !data.url) return { error: "auth.error.google_unavailable" };
  redirect(data.url);
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const lang = langOf(form);
  const input = email.safeParse(field(form, "email"));
  if (!input.success) return { error: "auth.error.invalid_input" };

  const { error } = await (
    await createClient()
  ).auth.resetPasswordForEmail(input.data, {
    redirectTo: await callbackUrl(`/${lang}/reset-password?mode=update`),
  });
  // Only rate limits are worth telling; unknown emails get the same "sent" answer.
  if (error?.code === "over_email_send_rate_limit") return fail(error);
  return { sent: true };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const input = password.safeParse(field(form, "password"));
  if (!input.success) return { error: "auth.error.invalid_input" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "auth.error.link_expired" };
  const { error } = await supabase.auth.updateUser({ password: input.data });
  return error ? fail(error) : { done: true };
}

export async function signOut(form: FormData) {
  await (await createClient()).auth.signOut();
  redirect(`/${langOf(form)}`);
}
