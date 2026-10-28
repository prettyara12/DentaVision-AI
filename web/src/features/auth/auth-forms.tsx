"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, type ReactNode } from "react";
import { t, type Locale, type MessageKey } from "@/lib/i18n";
import {
  requestPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
  updatePassword,
  type AuthState,
} from "./actions";

type Action = (state: AuthState, form: FormData) => Promise<AuthState>;

const input =
  "min-h-11 w-full rounded-sm border border-rule bg-surface-2 px-3 text-base text-ink placeholder:text-ink-2";
const primary =
  "min-h-11 w-full rounded-sm bg-accent px-5 text-sm font-medium text-accent-ink disabled:opacity-50";
const link = "text-accent underline underline-offset-4";

/** Hidden fields every auth form sends: the UI language and where to go afterwards. */
function Context({ lang }: { lang: Locale }) {
  const next = useSearchParams().get("next") ?? "";
  return (
    <>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="next" value={next} />
    </>
  );
}

function withNext(path: string, next: string | null) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

function Message({ lang, error }: { lang: Locale; error?: MessageKey }) {
  return error ? (
    <p role="alert" className="text-sm text-warn">
      {t(lang, error)}
    </p>
  ) : null;
}

function Field(props: {
  label: string;
  name: string;
  type: "email" | "password";
  autoComplete: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {props.label}
      <input
        name={props.name}
        type={props.type}
        autoComplete={props.autoComplete}
        required
        maxLength={props.type === "email" ? 320 : 72}
        className={input}
      />
    </label>
  );
}

function AuthForm(props: {
  lang: Locale;
  action: Action;
  submit: MessageKey;
  children: ReactNode;
  initialError?: MessageKey;
  sent?: MessageKey;
}) {
  const [state, action, pending] = useActionState(props.action, undefined);
  if (state?.sent && props.sent) {
    return (
      <p role="status" className="leading-relaxed">
        {t(props.lang, props.sent)}
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <Context lang={props.lang} />
      {props.children}
      <Message lang={props.lang} error={state?.error ?? props.initialError} />
      <button type="submit" disabled={pending} className={primary}>
        {t(props.lang, props.submit)}
      </button>
    </form>
  );
}

/** Google's "G" mark; its brand guidelines require the original colours. */
function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-[18px] shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function GoogleButton({ lang }: { lang: Locale }) {
  const [state, action, pending] = useActionState(signInWithGoogle, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Context lang={lang} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-sm border border-rule px-5 text-sm font-medium disabled:opacity-50"
      >
        <GoogleLogo />
        {t(lang, "auth.google")}
      </button>
      <Message lang={lang} error={state?.error} />
      <p className="flex items-center gap-3 font-mono text-xs tracking-[0.06em] text-ink-2 uppercase">
        <span aria-hidden className="h-px flex-1 bg-rule" />
        {t(lang, "auth.or")}
        <span aria-hidden className="h-px flex-1 bg-rule" />
      </p>
    </form>
  );
}

export function LoginForm({ lang }: { lang: Locale }) {
  const params = useSearchParams();
  const next = params.get("next");
  return (
    <div className="flex flex-col gap-6">
      <GoogleButton lang={lang} />
      <AuthForm
        lang={lang}
        action={signIn}
        submit="auth.submit.login"
        initialError={params.get("error") === "link" ? "auth.error.link_expired" : undefined}
      >
        <Field label={t(lang, "auth.email")} name="email" type="email" autoComplete="email" />
        <Field
          label={t(lang, "auth.password")}
          name="password"
          type="password"
          autoComplete="current-password"
        />
      </AuthForm>
      <div className="flex flex-col gap-2 text-sm">
        <Link href={withNext(`/${lang}/reset-password`, next)} className={link}>
          {t(lang, "auth.forgot")}
        </Link>
        <Link href={withNext(`/${lang}/register`, next)} className={link}>
          {t(lang, "auth.to_register")}
        </Link>
      </div>
    </div>
  );
}

export function RegisterForm({ lang }: { lang: Locale }) {
  const next = useSearchParams().get("next");
  return (
    <div className="flex flex-col gap-6">
      <GoogleButton lang={lang} />
      <AuthForm lang={lang} action={signUp} submit="auth.submit.register" sent="auth.sent.verify">
        <Field label={t(lang, "auth.email")} name="email" type="email" autoComplete="email" />
        <Field
          label={t(lang, "auth.password")}
          name="password"
          type="password"
          autoComplete="new-password"
        />
      </AuthForm>
      <Link href={withNext(`/${lang}/login`, next)} className={`text-sm ${link}`}>
        {t(lang, "auth.to_login")}
      </Link>
    </div>
  );
}

/** Asks for a reset link, or (back from that link, `?mode=update`) sets the new password. */
export function ResetForm({ lang }: { lang: Locale }) {
  const update = useSearchParams().get("mode") === "update";
  const [state, action, pending] = useActionState(updatePassword, undefined);

  if (!update) {
    return (
      <AuthForm
        lang={lang}
        action={requestPasswordReset}
        submit="auth.submit.reset"
        sent="auth.sent.reset"
      >
        <Field label={t(lang, "auth.email")} name="email" type="email" autoComplete="email" />
      </AuthForm>
    );
  }
  if (state?.done) {
    return (
      <div role="status" className="flex flex-col items-start gap-4">
        <p>{t(lang, "auth.updated")}</p>
        <Link href={`/${lang}/scan`} className={link}>
          {t(lang, "result.new_scan")}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <Context lang={lang} />
      <Field
        label={t(lang, "auth.new_password")}
        name="password"
        type="password"
        autoComplete="new-password"
      />
      <Message lang={lang} error={state?.error} />
      {state?.error === "auth.error.link_expired" && (
        <Link href={`/${lang}/reset-password`} className={`text-sm ${link}`}>
          {t(lang, "auth.submit.reset")}
        </Link>
      )}
      <button type="submit" disabled={pending} className={primary}>
        {t(lang, "auth.submit.update")}
      </button>
    </form>
  );
}
