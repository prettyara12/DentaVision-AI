import { Suspense, type ReactNode } from "react";

/** Shared frame of /login, /register and /reset-password (light room, narrow column). */
export function AuthPage(props: { title: string; lede: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em]">
          {props.title}
        </h1>
        <p className="text-ink-2">{props.lede}</p>
      </header>
      {/* The forms read ?next= / ?error= / ?mode=, which only exist at request time. */}
      <Suspense>{props.children}</Suspense>
    </main>
  );
}
