"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { suggestions } from "@/features/chat/chat";
import { ChatPanel } from "@/features/chat/chat-panel";
import { useChat } from "@/features/chat/use-chat";
import { CONTEXT_MIN_CONFIDENCE } from "@/features/insight/insight";
import { InsightPanel } from "@/features/insight/insight-panel";
import { useInsight } from "@/features/insight/use-insight";
import { t, type Locale } from "@/lib/i18n";
import { classCatalog, GROUPS, groupInfo, type FindingGroup } from "./class-catalog";
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
import { findSample } from "./samples";
import { XrayViewer, type ViewerBox } from "./xray-viewer";

const noSubscribe = () => () => {};

function readStoredScan(): string | null {
  try {
    return sessionStorage.getItem(SCAN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function ResultWorkspace({ lang, initialScan }: { lang: Locale; initialScan?: StoredScan }) {
  const raw = useSyncExternalStore(noSubscribe, readStoredScan, () => null);
  const scan = useMemo(() => {
    if (initialScan) return initialScan;
    if (!raw) return null;
    try {
      const parsed = storedScanSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [initialScan, raw]);

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
  // A new scan in this tab starts a fresh workspace (filters, insight, chat).
  return <Workspace key={scan.image} lang={lang} scan={scan} />;
}

const TABS = ["findings", "summary", "chat"] as const;
type Tab = (typeof TABS)[number];

// WAI-ARIA tabs: arrow keys move between tabs and select them.
function onTabKey(event: KeyboardEvent, current: Tab, select: (tab: Tab) => void) {
  const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (!step) return;
  const next = TABS[(TABS.indexOf(current) + step + TABS.length) % TABS.length]!;
  select(next);
  document.getElementById(`tab-${next}`)?.focus();
}

// Below 640 px the chat tab opens as a bottom sheet over the page (docs/design-system.md §6).
const PHONE = "(max-width: 639px)";
const isPhone = () => window.matchMedia(PHONE).matches;

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
  const [tab, setTab] = useState<Tab>("findings");
  const [lastTab, setLastTab] = useState<Exclude<Tab, "chat">>("findings");
  const insight = useInsight(scan, lang);
  const chat = useChat(lang, scan, scan.chat ?? []);

  const selectTab = (next: Tab) => {
    if (next !== "chat") setLastTab(next);
    setTab(next);
    if (next === "chat" && isPhone())
      requestAnimationFrame(() => document.getElementById("chat-input")?.focus());
  };
  const closeSheet = () => setTab(lastTab);

  // On phones the chat sheet is modal: everything behind it is inert (no focus, hidden from screen
  // readers) and Esc closes it wherever focus is. Focus goes back to the Chat tab on close.
  useEffect(() => {
    if (tab !== "chat") return;
    const phone = window.matchMedia(PHONE);
    const behind: Element[] = [];
    for (
      let node = document.getElementById("panel-chat");
      node?.parentElement;
      node = node.parentElement
    ) {
      for (const sibling of node.parentElement.children) {
        if (sibling !== node && !sibling.hasAttribute("data-sheet-backdrop")) behind.push(sibling);
      }
    }
    const sync = () => behind.forEach((el) => el.toggleAttribute("inert", phone.matches));
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && phone.matches) setTab(lastTab);
    };
    sync();
    phone.addEventListener("change", sync);
    window.addEventListener("keydown", onKey);
    return () => {
      phone.removeEventListener("change", sync);
      window.removeEventListener("keydown", onKey);
      behind.forEach((el) => el.removeAttribute("inert"));
      if (phone.matches) document.getElementById("tab-chat")?.focus();
    };
  }, [tab, lastTab]);

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
  const sample = scan.sample ? findSample(scan.sample) : undefined;
  // The insight always uses the 0.25 context, whatever the slider says.
  const insightNoAttention = !scan.result.detections.some(
    (d) =>
      d.confidence >= CONTEXT_MIN_CONFIDENCE && classCatalog[d.class_id]?.group === "attention",
  );
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
      <section className="flex flex-col gap-6 lg:col-span-4">
        <div
          role="tablist"
          aria-label={t(lang, "tabs.label")}
          onKeyDown={(e) => onTabKey(e, tab, selectTab)}
          className="flex gap-1 border-b border-rule"
        >
          {TABS.map((id) => (
            <button
              key={id}
              id={`tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => selectTab(id)}
              className="-mb-px min-h-11 border-b-2 border-transparent px-3 text-sm font-medium text-ink-2 aria-selected:border-accent aria-selected:text-ink"
            >
              {t(lang, `tabs.${id}`)}
            </button>
          ))}
        </div>
        {scan.result.low_quality && (
          <p className="text-sm text-warn">{t(lang, "result.low_quality")}</p>
        )}
        <div
          id="panel-summary"
          role="tabpanel"
          aria-labelledby="tab-summary"
          hidden={tab !== "summary"}
        >
          <InsightPanel
            lang={lang}
            state={insight.state}
            noAttention={insightNoAttention}
            onGenerate={insight.generate}
          />
        </div>
        {tab === "chat" && (
          <div
            aria-hidden
            data-sheet-backdrop
            onClick={closeSheet}
            className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          />
        )}
        <div
          id="panel-chat"
          role="tabpanel"
          aria-labelledby="tab-chat"
          hidden={tab !== "chat"}
          className="sheet-rise flex flex-col gap-3 sm:max-h-[70vh] max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-50 max-sm:h-[85dvh] max-sm:rounded-t-md max-sm:border-t max-sm:border-rule max-sm:bg-surface max-sm:p-4 max-sm:shadow-[0_16px_32px_-20px_rgb(0_0_0/.45)] [&[hidden]]:hidden"
        >
          <div className="flex items-center justify-between sm:hidden">
            <p className="font-mono text-xs tracking-[0.06em] text-ink-2 uppercase">
              {t(lang, "tabs.chat")}
            </p>
            <button
              type="button"
              onClick={closeSheet}
              className="min-h-11 rounded-sm border border-rule px-4 text-sm font-medium"
            >
              {t(lang, "chat.close")}
            </button>
          </div>
          <ChatPanel
            lang={lang}
            chat={chat}
            suggestions={suggestions(lang, scan.result.detections)}
            source
          />
        </div>
        <div
          id="panel-findings"
          role="tabpanel"
          aria-labelledby="tab-findings"
          hidden={tab !== "findings"}
          className="flex flex-col gap-6 [&[hidden]]:hidden"
        >
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
        </div>
        {sample && (
          <p className="text-xs text-ink-2">
            {t(lang, "sample.credit").split("{credit}")[0]}
            <a href={sample.source} className="underline underline-offset-2">
              {sample.credit}
            </a>
            {t(lang, "sample.credit").split("{credit}")[1]}{" "}
            <a href={sample.license.url} className="underline underline-offset-2">
              {sample.license.name}
            </a>
            .
          </p>
        )}
        <Link href={`/${lang}/scan`} className="text-sm text-accent underline underline-offset-4">
          {t(lang, "result.new_scan")}
        </Link>
      </section>
    </div>
  );
}
