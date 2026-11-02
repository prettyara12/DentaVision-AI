import Link from "next/link";
import { notFound } from "next/navigation";
import { HeroSweep } from "@/features/landing/hero-sweep";
import { isLocale, t, type Locale, type MessageKey } from "@/lib/i18n";

const STEPS: { title: MessageKey; body: MessageKey }[] = [
  { title: "home.step1.title", body: "home.step1.body" },
  { title: "home.step2.title", body: "home.step2.body" },
  { title: "home.step3.title", body: "home.step3.body" },
];

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-24 px-4 py-12 sm:py-16 lg:gap-36">
      <section className="grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <p className="font-mono text-xs tracking-[0.06em] text-ink-2 uppercase">
            {t(lang, "home.kicker")}
          </p>
          <h1 className="text-[clamp(40px,6vw,88px)] leading-none font-semibold tracking-[-0.02em]">
            {t(lang, "home.title")}
          </h1>
          <p className="max-w-md text-ink-2">{t(lang, "home.lede")}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/${lang}/scan`}
              className="inline-flex min-h-11 items-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-ink transition-opacity duration-[120ms] hover:opacity-90"
            >
              {t(lang, "home.cta.upload")}
            </Link>
            <Link
              href={`/${lang}/scan#samples-title`}
              className="inline-flex min-h-11 items-center rounded-sm border border-rule px-5 text-sm font-medium hover:bg-surface"
            >
              {t(lang, "home.cta.sample")}
            </Link>
          </div>
          <p className="text-sm text-ink-2">{t(lang, "disclaimer.short")}</p>
        </div>
        <div className="lg:col-span-7">
          <HeroSweep lang={lang} />
        </div>
      </section>

      <Section lang={lang} title="home.how.title">
        <ol className="flex flex-col">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="grid gap-1 border-t border-rule py-5 sm:grid-cols-[6rem_12rem_1fr] sm:gap-6"
            >
              <span className="font-mono text-xs tracking-[0.06em] text-ink-2 tabular-nums">
                {`0${i + 1} / 0${STEPS.length}`}
              </span>
              <h3 className="font-semibold">{t(lang, step.title)}</h3>
              <p className="text-ink-2">{t(lang, step.body)}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section lang={lang} title="home.limits.title" lede="home.limits.lede">
        <ul className="flex flex-col">
          <Point text={t(lang, "home.limits.diagnosis")} />
          <Point text={t(lang, "home.limits.recall")} />
          <Point text={t(lang, "home.limits.empty")} />
        </ul>
        <MoreLink href={`/${lang}/about-model`} label={t(lang, "home.limits.more")} />
      </Section>

      <Section lang={lang} title="home.data.title" lede="home.data.lede">
        <ul className="flex flex-col">
          <Point text={t(lang, "home.data.guest")} />
          <Point text={t(lang, "home.data.account")} />
          <Point text={t(lang, "home.data.gemini")} />
        </ul>
        <MoreLink href={`/${lang}/privacy`} label={t(lang, "home.data.more")} />
      </Section>
    </main>
  );
}

function Section({
  lang,
  title,
  lede,
  children,
}: {
  lang: Locale;
  title: MessageKey;
  lede?: MessageKey;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-12">
      <div className="flex flex-col gap-2 lg:col-span-4">
        <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] sm:text-[28px]">
          {t(lang, title)}
        </h2>
        {lede && <p className="text-ink-2">{t(lang, lede)}</p>}
      </div>
      <div className="flex flex-col gap-4 lg:col-span-8">{children}</div>
    </section>
  );
}

function Point({ text }: { text: string }) {
  return <li className="border-t border-rule py-4">{text}</li>;
}

function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center self-start text-sm font-medium text-accent hover:underline"
    >
      {label}
    </Link>
  );
}
