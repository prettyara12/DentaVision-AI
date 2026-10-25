"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { t, type Locale } from "@/lib/i18n";
import { GROUPS, groupInfo, type FindingGroup } from "./class-catalog";
import { FindingFilters, FindingList } from "./finding-list";
import { groupFindings } from "./findings";
import { DEFAULT_HEATMAP_OPACITY } from "./heatmap";
import { HeatmapControl } from "./heatmap-control";
import {
  DEFAULT_MIN_CONFIDENCE,
  SCAN_STORAGE_KEY,
  storedScanSchema,
  type StoredScan,
} from "./result";
import { XrayViewer, type ViewerBox } from "./xray-viewer";

const noSubscribe = () => () => {};

function readStoredScan(): string | null {
  try {
    return sessionStorage.getItem(SCAN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function ResultWorkspace({ lang }: { lang: Locale }) {
  const raw = useSyncExternalStore(noSubscribe, readStoredScan, () => null);
  const scan = useMemo(() => {
    if (!raw) return null;
    try {
      const parsed = storedScanSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [raw]);

  if (!scan) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-ink-2">{t(lang, "result.empty")}</p>
        <Link
          href={`/${lang}/scan`}
          className="inline-flex min-h-11 items-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-ink"
        >
          {t(lang, "result.new_scan")}
        </Link>
      </div>
    );
  }
  return <Workspace lang={lang} scan={scan} />;
}

function Workspace({ lang, scan }: { lang: Locale; scan: StoredScan }) {
  const [minConfidence, setMinConfidence] = useState(DEFAULT_MIN_CONFIDENCE);
  const [visible, setVisible] = useState(
    () =>
      Object.fromEntries(GROUPS.map((g) => [g, groupInfo[g].visibleByDefault])) as Record<
        FindingGroup,
        boolean
      >,
  );
  const [activeClass, setActiveClass] = useState<number | null>(null);
  const [chosenHeatmap, setChosenHeatmap] = useState<number | null>(null);
  const [heatmapOpacity, setHeatmapOpacity] = useState(DEFAULT_HEATMAP_OPACITY);

  const groups = useMemo(
    () => groupFindings(scan.result.detections, minConfidence),
    [scan, minConfidence],
  );
  const boxes: ViewerBox[] = groups.flatMap(({ group, classes }) =>
    // An active class stays drawn even when its group is toggled off, so list focus always shows something.
    classes
      .filter((c) => visible[group] || c.info.id === activeClass)
      .flatMap((c) =>
        c.boxes.map((d, i) => ({
          id: `${c.info.id}-${i}`,
          classId: c.info.id,
          color: groupInfo[group].color,
          label: `${c.info.name[lang]} · ${d.confidence.toFixed(2)}`,
          box: d.box,
        })),
      ),
  );
  // Heatmaps exist only for classes detected at >= 0.25 (docs/architecture.md §3.1), so offer those still listed.
  const heatmapIds = groups.flatMap(({ classes }) =>
    classes.map((c) => c.info.id).filter((id) => scan.result.heatmaps[String(id)]),
  );
  const heatmapClass =
    chosenHeatmap !== null && heatmapIds.includes(chosenHeatmap) ? chosenHeatmap : null;
  const noAttention = groups[0]?.classes.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <XrayViewer
          lang={lang}
          src={scan.image}
          width={scan.result.image.width}
          height={scan.result.image.height}
          boxes={boxes}
          activeClass={activeClass}
          onHoverClass={setActiveClass}
          heatmap={
            heatmapClass === null ? null : (scan.result.heatmaps[String(heatmapClass)] ?? null)
          }
          heatmapOpacity={heatmapOpacity}
          onToggleHeatmap={() =>
            setChosenHeatmap(heatmapClass === null ? (heatmapIds[0] ?? null) : null)
          }
        />
      </div>
      <section aria-labelledby="findings-title" className="flex flex-col gap-6 lg:col-span-4">
        <h2 id="findings-title" className="text-xl font-semibold">
          {t(lang, "findings.title")}
        </h2>
        {scan.result.low_quality && (
          <p className="text-sm text-warn">{t(lang, "result.low_quality")}</p>
        )}
        {noAttention && (
          <div className="flex flex-col gap-1">
            <p>{t(lang, "findings.none_attention")}</p>
            <p className="text-sm text-ink-2">{t(lang, "findings.limits")}</p>
          </div>
        )}
        <FindingFilters
          lang={lang}
          minConfidence={minConfidence}
          onMinConfidence={setMinConfidence}
          visible={visible}
          onToggleGroup={(g) => setVisible((v) => ({ ...v, [g]: !v[g] }))}
        />
        <HeatmapControl
          lang={lang}
          classIds={heatmapIds}
          value={heatmapClass}
          onChange={setChosenHeatmap}
          opacity={heatmapOpacity}
          onOpacity={setHeatmapOpacity}
        />
        <FindingList
          lang={lang}
          groups={groups}
          activeClass={activeClass}
          onActiveClass={setActiveClass}
          heatmapClasses={new Set(heatmapIds)}
          heatmapClass={heatmapClass}
          onHeatmapClass={setChosenHeatmap}
        />
        <Link href={`/${lang}/scan`} className="text-sm text-accent underline underline-offset-4">
          {t(lang, "result.new_scan")}
        </Link>
      </section>
    </div>
  );
}
