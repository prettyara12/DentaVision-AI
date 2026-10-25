"use client";

import { Select } from "@/components/ui/select";
import { t, type Locale } from "@/lib/i18n";
import { classCatalog } from "./class-catalog";
import { formatConfidence } from "./finding-list";

type Props = {
  lang: Locale;
  /** Classes with a heatmap, in list order. */
  classIds: number[];
  value: number | null;
  onChange: (classId: number | null) => void;
  opacity: number;
  onOpacity: (value: number) => void;
};

const label = "font-mono text-xs tracking-[0.06em] text-ink-2 uppercase";

export function HeatmapControl({ lang, classIds, value, onChange, opacity, onOpacity }: Props) {
  if (classIds.length === 0) return null;
  const name = value === null ? null : classCatalog[value]?.name[lang];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor="heatmap-class" className={label}>
          {t(lang, "heatmap.label")}
        </label>
        {/* Radix forbids an empty item value, so "off" stands for no heatmap. */}
        <Select
          id="heatmap-class"
          value={value === null ? "off" : String(value)}
          onValueChange={(v) => onChange(v === "off" ? null : Number(v))}
          options={[
            { value: "off", label: t(lang, "heatmap.off") },
            ...classIds.map((id) => ({
              value: String(id),
              label: classCatalog[id]?.name[lang] ?? "",
            })),
          ]}
        />
      </div>
      {name && (
        <>
          <label className="flex flex-col gap-2">
            <span className={`flex items-center justify-between ${label}`}>
              {t(lang, "heatmap.opacity")}
              <span className="text-ink tabular-nums">{formatConfidence(lang, opacity)}</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => onOpacity(Number(e.target.value))}
              className="h-11 w-full accent-[var(--accent)]"
            />
          </label>
          <p className="text-sm text-ink-2">{t(lang, "heatmap.how").replace("{name}", name)}</p>
        </>
      )}
    </div>
  );
}
