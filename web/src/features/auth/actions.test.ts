import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getClaims: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://dentavision.test" }),
}));
// redirect() throws in Next; keep that so code after it never runs.
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

const actions = await import("./actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}
const authError = (code: string) => ({ code, status: 400, message: code });

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset();
  redirect.mockClear();
});

describe("signIn", () => {
  it("signs in with a normalised email and goes to the safe next path", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    const fields = {
      lang: "en",
      next: "/en/scan/result",
      email: " A@Example.TEST ",
      password: "pw",
    };
    await expect(actions.signIn(undefined, form(fields))).rejects.toThrow(
      "REDIRECT /en/scan/result",
    );
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@example.test",
      password: "pw",
    });
  });

  it("maps Supabase errors to messages and validates input first", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: authError("invalid_credentials") });
    expect(
      await actions.signIn(undefined, form({ email: "a@example.test", password: "x" })),
    ).toEqual({ error: "auth.error.invalid_credentials" });
    expect(await actions.signIn(undefined, form({ email: "not-an-email", password: "x" }))).toEqual(
      {
        error: "auth.error.invalid_input",
      },
    );
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
  });
});

describe("signUp", () => {
  it("asks for email verification through the callback, keeping next", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const fields = { lang: "id", next: "/id/chat", email: "b@example.test", password: "long-pw" };
    expect(await actions.signUp(undefined, form(fields))).toEqual({ sent: true });
    expect(auth.signUp.mock.calls[0]?.[0].options.emailRedirectTo).toBe(
      "https://dentavision.test/auth/callback?next=%2Fid%2Fchat",
    );
  });

  it("goes straight on when no verification is required", async () => {
    auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    const fields = { lang: "id", email: "b@example.test", password: "pw" };
    await expect(actions.signUp(undefined, form(fields))).rejects.toThrow("REDIRECT /id/scan");
  });
});

describe("signInWithGoogle", () => {
  it("redirects to Google, or explains when the provider is off", async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.test/o" },
      error: null,
    });
    await expect(actions.signInWithGoogle(undefined, form({ lang: "en" }))).rejects.toThrow(
      "REDIRECT https://accounts.google.test/o",
    );
    expect(auth.signInWithOAuth.mock.calls[0]?.[0].options.redirectTo).toBe(
      "https://dentavision.test/auth/callback?next=%2Fen%2Fscan",
    );

    auth.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: authError("validation_failed"),
    });
    expect(await actions.signInWithGoogle(undefined, form({ lang: "en" }))).toEqual({
      error: "auth.error.google_unavailable",
    });
  });
});

describe("password reset", () => {
  it("answers 'sent' whether or not the email exists", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: authError("user_not_found") });
    const fields = { lang: "en", email: "x@example.test" };
    expect(await actions.requestPasswordReset(undefined, form(fields))).toEqual({ sent: true });
    expect(auth.resetPasswordForEmail.mock.calls[0]?.[1].redirectTo).toBe(
      "https://dentavision.test/auth/callback?next=%2Fen%2Freset-password%3Fmode%3Dupdate",
    );
  });

  it("updates the password only with a session from the reset link", async () => {
    auth.getClaims.mockResolvedValue({ data: null });
    expect(await actions.updatePassword(undefined, form({ password: "new-pw" }))).toEqual({
      error: "auth.error.link_expired",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();

    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    auth.updateUser.mockResolvedValue({ error: null });
    expect(await actions.updatePassword(undefined, form({ password: "new-pw" }))).toEqual({
      done: true,
    });
  });
});

describe("signOut", () => {
  it("ends the session and returns to the landing page", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await expect(actions.signOut(form({ lang: "en" }))).rejects.toThrow("REDIRECT /en");
    expect(auth.signOut).toHaveBeenCalled();
  });
});
