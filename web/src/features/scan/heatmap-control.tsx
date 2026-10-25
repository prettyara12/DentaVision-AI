"use client";

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
      <label className="flex flex-col gap-2">
        <span className={label}>{t(lang, "heatmap.label")}</span>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="min-h-11 rounded-sm border border-rule bg-surface px-3 text-sm text-ink"
        >
          <option value="">{t(lang, "heatmap.off")}</option>
          {classIds.map((id) => (
            <option key={id} value={id}>
              {classCatalog[id]?.name[lang]}
            </option>
          ))}
        </select>
      </label>
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
