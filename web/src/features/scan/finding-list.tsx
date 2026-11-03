"use client";

import { t, type Locale } from "@/lib/i18n";
import { groupInfo, type FindingGroup } from "./class-catalog";
import type { GroupFindings } from "./findings";

type ListProps = {
  lang: Locale;
  groups: GroupFindings[];
  activeClass: number | null;
  onActiveClass: (classId: number | null) => void;
  /** Classes that have a heatmap; clicking one of them toggles it on the image (US-04). */
  heatmapClasses: ReadonlySet<number>;
  heatmapClass: number | null;
  onHeatmapClass: (classId: number | null) => void;
};

export const formatConfidence = (lang: Locale, value: number) =>
  value.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FindingList({
  lang,
  groups,
  activeClass,
  onActiveClass,
  heatmapClasses,
  heatmapClass,
  onHeatmapClass,
}: ListProps) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ group, classes }) => (
        <details
          key={group}
          open={groupInfo[group].visibleByDefault}
          className="group border-t border-rule pt-3"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-mono text-xs tracking-[0.06em] uppercase">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: groupInfo[group].color }}
              />
              {groupInfo[group].label[lang]}
            </span>
            <span className="font-mono text-xs text-ink-2 tabular-nums">
              {classes.length}
              <span
                aria-hidden
                className="ml-2 inline-block transition-transform group-open:rotate-90"
              >
                ›
              </span>
            </span>
          </summary>
          {classes.length === 0 ? (
            <p className="py-2 text-sm text-ink-2">{t(lang, "findings.empty")}</p>
          ) : (
            <ul className="flex flex-col">
              {classes.map((c) => {
                const conf = formatConfidence(lang, c.confidence);
                const hasHeatmap = heatmapClasses.has(c.info.id);
                return (
                  <li key={c.info.id}>
                    <button
                      type="button"
                      data-active={activeClass === c.info.id || undefined}
                      aria-pressed={hasHeatmap ? heatmapClass === c.info.id : undefined}
                      aria-label={t(lang, "findings.item")
                        .replace("{name}", c.info.name[lang])
                        .replace("{conf}", conf)
                        .replace("{n}", String(c.boxes.length))}
                      onPointerEnter={(e) => e.pointerType === "mouse" && onActiveClass(c.info.id)}
                      onPointerLeave={(e) => e.pointerType === "mouse" && onActiveClass(null)}
                      onFocus={() => onActiveClass(c.info.id)}
                      onBlur={() => onActiveClass(null)}
                      // Tap on touch: focus already fires, so click re-asserts the highlight instead of toggling it.
                      onClick={() => {
                        onActiveClass(c.info.id);
                        if (hasHeatmap)
                          onHeatmapClass(heatmapClass === c.info.id ? null : c.info.id);
                      }}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm px-2 text-left hover:bg-surface-2 data-active:bg-surface-2"
                    >
                      <span className="text-sm">{c.info.name[lang]}</span>
                      <span className="shrink-0 font-mono text-xs text-ink-2 tabular-nums">
                        {heatmapClass === c.info.id && (
                          <span className="mr-2 text-accent">{t(lang, "heatmap.badge")}</span>
                        )}
                        {conf} ×{c.boxes.length}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </details>
      ))}
    </div>
  );
}

type FilterProps = {
  lang: Locale;
  minConfidence: number;
  onMinConfidence: (value: number) => void;
  visible: Record<FindingGroup, boolean>;
  onToggleGroup: (group: FindingGroup) => void;
};

export function FindingFilters({
  lang,
  minConfidence,
  onMinConfidence,
  visible,
  onToggleGroup,
}: FilterProps) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="flex items-center justify-between font-mono text-xs tracking-[0.06em] text-ink-2 uppercase">
          {t(lang, "filter.confidence")}
          <span className="text-ink tabular-nums">{formatConfidence(lang, minConfidence)}</span>
        </span>
        <input
          type="range"
          min={0.1}
          max={0.9}
          step={0.05}
          value={minConfidence}
          onChange={(e) => onMinConfidence(Number(e.target.value))}
          className="h-11 w-full accent-[var(--accent)]"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-mono text-xs tracking-[0.06em] text-ink-2 uppercase">
          {t(lang, "filter.groups")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(visible) as FindingGroup[]).map((group) => (
            <button
              key={group}
              type="button"
              aria-pressed={visible[group]}
              onClick={() => onToggleGroup(group)}
              className="flex min-h-11 items-center gap-2 rounded-sm border border-rule px-3 text-sm text-ink-2 transition-colors duration-200 aria-pressed:border-ink aria-pressed:text-ink"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{
                  background: visible[group] ? groupInfo[group].color : "transparent",
                  outline: `1px solid ${groupInfo[group].color}`,
                }}
              />
              {groupInfo[group].label[lang]}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
