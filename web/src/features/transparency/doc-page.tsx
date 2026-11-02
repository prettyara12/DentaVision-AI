import type { ReactNode } from "react";
import type { Block } from "./content";

/** Shared frame of the transparency pages: a report-like column with hairline sections. */
export function DocPage({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-4 py-12 sm:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] sm:text-[44px]">
          {title}
        </h1>
        <p className="text-ink-2">{lede}</p>
      </header>
      {children}
    </main>
  );
}

export function DocSection({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] sm:text-[28px]">
        {title}
      </h2>
      {lede && <p className="text-ink-2">{lede}</p>}
      {children}
    </section>
  );
}

export function BlockSection({ block }: { block: Block }) {
  return (
    <DocSection title={block.title} lede={block.lede}>
      <ul className="flex flex-col">
        {block.points.map((point) => (
          <li key={point} className="border-t border-rule py-3">
            {point}
          </li>
        ))}
      </ul>
    </DocSection>
  );
}
