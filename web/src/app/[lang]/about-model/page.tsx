import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { classCatalog, GROUPS, groupInfo } from "@/features/scan/class-catalog";
import { samples } from "@/features/scan/samples";
import { aboutModel, metrics } from "@/features/transparency/content";
import { BlockSection, DocPage, DocSection } from "@/features/transparency/doc-page";
import { isLocale } from "@/lib/i18n";

// Two samples share one source; list each source once.
const credits = samples.filter((s, i) => samples.findIndex((o) => o.source === s.source) === i);

const MODEL_REPO = "https://huggingface.co/adrielwalintukan/dentavision-yolov8m-resnet50";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/about-model">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: `${aboutModel[lang].title} · DentaVision AI` } : {};
}

export default async function AboutModelPage({ params }: PageProps<"/[lang]/about-model">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const page = aboutModel[lang];

  return (
    <DocPage title={page.title} lede={page.lede}>
      <DocSection title={page.model.title}>
        <ul className="flex flex-col">
          {page.model.points.map((point) => (
            <li key={point} className="border-t border-rule py-3">
              {point}
            </li>
          ))}
          <li className="border-t border-rule py-3">
            <a
              href={MODEL_REPO}
              className="font-mono text-sm break-all text-accent hover:underline"
            >
              huggingface.co/adrielwalintukan/dentavision-yolov8m-resnet50
            </a>{" "}
            <span className="text-sm text-ink-2">· AGPL-3.0</span>
          </li>
        </ul>
      </DocSection>

      <DocSection title={page.metricsTitle} lede={page.metricsLede}>
        <dl className="flex flex-col">
          {metrics.map((m) => (
            <div
              key={m.key}
              className="grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-1 border-t border-rule py-3 sm:grid-cols-[8rem_5rem_1fr]"
            >
              <dt className="font-mono text-xs tracking-[0.06em] text-ink-2 uppercase sm:self-baseline">
                {page.metricLabels[m.key].name}
              </dt>
              <dd className="font-mono text-lg tabular-nums sm:self-baseline">
                {m.value.toLocaleString(lang, { minimumFractionDigits: 3 })}
              </dd>
              <dd className="col-span-2 text-ink-2 sm:col-span-1 sm:self-baseline">
                {page.metricLabels[m.key].meaning}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-ink-2">{page.metricsNote}</p>
      </DocSection>

      <BlockSection block={page.limits} />
      <BlockSection block={page.dataset} />

      <DocSection title={page.classesTitle} lede={page.classesLede}>
        <div className="flex flex-col gap-6">
          {GROUPS.map((group) => (
            <div key={group} className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 font-mono text-xs tracking-[0.06em] uppercase">
                <span
                  aria-hidden
                  className="size-2 rounded-[1px]"
                  style={{ background: groupInfo[group].color }}
                />
                {groupInfo[group].label[lang]}
              </h3>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {classCatalog
                  .filter((c) => c.group === group)
                  .map((c) => (
                    <li key={c.id}>{c.name[lang]}</li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection title={page.samplesTitle}>
        <ul className="flex flex-col text-sm">
          {credits.map((s) => (
            <li key={s.source} className="border-t border-rule py-3">
              <a href={s.source} className="underline hover:text-accent">
                {s.credit}
              </a>
              {", "}
              <a href={s.license.url} className="underline hover:text-accent">
                {s.license.name}
              </a>
            </li>
          ))}
        </ul>
      </DocSection>
    </DocPage>
  );
}
