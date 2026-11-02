import Image from "next/image";
import type { CSSProperties } from "react";
import { classCatalog, groupInfo } from "@/features/scan/class-catalog";
import sample from "@/features/scan/samples/restorations.json";
import { samples } from "@/features/scan/samples";
import { t, type Locale } from "@/lib/i18n";
import { heroFindings } from "./hero";

const SWEEP_MS = 1600; // design-system §4 `sweep`; the cycle repeats every 8 s (globals.css)
const credit = samples.find((s) => s.key === "restorations");
const findings = heroFindings(sample.detections as never);
const { width, height } = sample.image;

const pad = (n: number) => String(n).padStart(2, "0");

/** Hero sweep (design-system §4, signature moment 1): a public sample X-ray, annotated live. */
export function HeroSweep({ lang }: { lang: Locale }) {
  return (
    <figure className="flex flex-col gap-3">
      {/* The X-ray is the light source, so the frame always uses the dark (lightbox) palette. */}
      <div
        data-room="lightbox"
        className="relative overflow-hidden rounded-md border border-rule bg-bg"
      >
        <Image
          src="/samples/restorations.jpg"
          alt={t(lang, "home.hero.alt")}
          width={width}
          height={height}
          priority
          sizes="(min-width: 1024px) 58vw, 100vw"
          className="block h-auto w-full"
        />
        <svg
          aria-hidden
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 size-full"
          preserveAspectRatio="none"
        >
          {findings.map((f) => {
            const [x1, y1, x2, y2] = f.box;
            const group = classCatalog[f.class_id]?.group ?? "attention";
            return (
              <rect
                key={f.index}
                className="hero-box"
                style={{ "--at": `${Math.round(x1 * SWEEP_MS)}ms` } as CSSProperties}
                x={x1 * width}
                y={y1 * height}
                width={(x2 - x1) * width}
                height={(y2 - y1) * height}
                fill="none"
                stroke={groupInfo[group].color}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                pathLength={1}
              />
            );
          })}
        </svg>
        {findings.map((f) => (
          <span
            key={f.index}
            aria-hidden
            className="hero-tag absolute -translate-y-full bg-bg px-1 font-mono text-[10px] leading-4 text-ink tabular-nums sm:text-xs"
            style={
              {
                left: `${f.box[0] * 100}%`,
                top: `${f.box[1] * 100}%`,
                "--at": `${Math.round(f.box[0] * SWEEP_MS)}ms`,
              } as CSSProperties
            }
          >
            {pad(f.index)}
          </span>
        ))}
        <div aria-hidden className="hero-sweep pointer-events-none absolute inset-0">
          <div className="h-full w-0.5 bg-accent" />
        </div>
      </div>
      <figcaption className="flex flex-col gap-2">
        <ol className="flex flex-col font-mono text-xs tabular-nums">
          {findings.map((f) => {
            const info = classCatalog[f.class_id];
            const group = info?.group ?? "attention";
            return (
              <li key={f.index} className="flex items-baseline gap-3 border-b border-rule py-1.5">
                <span className="text-ink-2">{pad(f.index)}</span>
                <span
                  aria-hidden
                  className="size-2 shrink-0 self-center rounded-[1px]"
                  style={{ background: groupInfo[group].color }}
                />
                <span className="min-w-0 flex-1 truncate uppercase tracking-[0.06em]">
                  {info?.name[lang]}
                </span>
                <span className="text-ink-2">{f.confidence.toFixed(2)}</span>
              </li>
            );
          })}
        </ol>
        {credit && (
          <p className="text-xs text-ink-2">
            {t(lang, "home.hero.caption")}{" "}
            <a href={credit.source} className="underline hover:text-accent">
              {credit.credit}
            </a>
            , {credit.license.name}
          </p>
        )}
      </figcaption>
    </figure>
  );
}
