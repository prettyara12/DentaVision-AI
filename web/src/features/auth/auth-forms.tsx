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

function GoogleButton({ lang }: { lang: Locale }) {
  const [state, action, pending] = useActionState(signInWithGoogle, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Context lang={lang} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-sm border border-rule px-5 text-sm font-medium disabled:opacity-50"
      >
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
