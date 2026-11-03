"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { t, type Locale } from "@/lib/i18n";
import { colorize } from "./heatmap";
import { IDENTITY, boxToScreen, fitRect, panBy, zoomAt, type Rect, type View } from "./viewer-math";

export type ViewerBox = {
  id: string;
  classId: number;
  color: string;
  label: string;
  box: readonly number[];
};

type Props = {
  lang: Locale;
  src: string;
  width: number;
  height: number;
  boxes: ViewerBox[];
  activeClass: number | null;
  onHoverClass: (classId: number | null) => void;
  /** Base64 grayscale PNG of the selected class, or null when the heatmap is off. */
  heatmap: string | null;
  heatmapOpacity: number;
  onToggleHeatmap: () => void;
};

const KEY_PAN = 48;
const KEY_ZOOM = 1.25;

export function XrayViewer({
  lang,
  src,
  width,
  height,
  boxes,
  activeClass,
  onHoverClass,
  heatmap,
  heatmapOpacity,
  onToggleHeatmap,
}: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const heatCanvas = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>(IDENTITY);
  const fit: Rect | null = useMemo(
    () => (size.w && size.h ? fitRect(size.w, size.h, width, height) : null),
    [size, width, height],
  );

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      setView(IDENTITY);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Colour the API's grayscale CAM in the browser; the previous one stays until the new one is drawn.
  useEffect(() => {
    if (!heatmap) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      const canvas = heatCanvas.current;
      const ctx = canvas?.getContext("2d");
      if (cancelled || !canvas || !ctx) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      colorize(data.data);
      ctx.putImageData(data, 0, 0);
    };
    image.src = `data:image/png;base64,${heatmap}`;
    return () => {
      cancelled = true;
    };
  }, [heatmap, fit]);

  // React's onWheel is passive, so preventDefault (stop page scroll while zooming) needs a native listener.
  useEffect(() => {
    const el = frame.current;
    if (!el || !fit) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0015);
      setView((v) => zoomAt(v, fit, factor, event.clientX - r.left, event.clientY - r.top));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fit]);

  function local(event: PointerEvent) {
    const r = frame.current!.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, local(event));
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !fit) return;
    const point = local(event);
    pointers.current.set(event.pointerId, point);
    const others = [...pointers.current].filter(([id]) => id !== event.pointerId);
    if (others.length === 0) {
      setView((v) => panBy(v, fit, point.x - previous.x, point.y - previous.y));
      return;
    }
    // Pinch: scale by the change in finger distance around the midpoint, then follow the midpoint.
    const other = others[0]![1];
    const before = Math.hypot(previous.x - other.x, previous.y - other.y);
    const after = Math.hypot(point.x - other.x, point.y - other.y);
    if (!before) return;
    const mid = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 };
    const prevMid = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
    setView((v) =>
      panBy(
        zoomAt(v, fit, after / before, mid.x, mid.y),
        fit,
        mid.x - prevMid.x,
        mid.y - prevMid.y,
      ),
    );
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
  }

  function zoomCentre(factor: number) {
    if (fit) setView((v) => zoomAt(v, fit, factor, size.w / 2, size.h / 2));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!fit) return;
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [KEY_PAN, 0],
      ArrowRight: [-KEY_PAN, 0],
      ArrowUp: [0, KEY_PAN],
      ArrowDown: [0, -KEY_PAN],
    };
    const delta = pan[event.key];
    if (delta) setView((v) => panBy(v, fit, ...delta));
    else if (event.key === "+" || event.key === "=") zoomCentre(KEY_ZOOM);
    else if (event.key === "-") zoomCentre(1 / KEY_ZOOM);
    else if (event.key === "0") setView(IDENTITY);
    else if (event.key === "h" || event.key === "H") onToggleHeatmap();
    else return;
    event.preventDefault();
  }

  const control =
    "flex size-11 items-center justify-center rounded-sm border border-rule bg-surface font-mono text-sm text-ink";

  return (
    <div className="relative h-[55vh] overflow-hidden rounded-md bg-black lg:h-[72vh]">
      <div
        ref={frame}
        role="group"
        aria-label={t(lang, "viewer.label")}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
      >
        {fit && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL kept in sessionStorage */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute top-0 left-0 max-w-none origin-top-left"
              style={{
                width: fit.width,
                height: fit.height,
                transform: `translate(${fit.left + view.x}px, ${fit.top + view.y}px) scale(${view.scale})`,
              }}
            />
            <canvas
              ref={heatCanvas}
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 origin-top-left transition-opacity duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
              style={{
                width: fit.width,
                height: fit.height,
                opacity: heatmap ? heatmapOpacity : 0,
                transform: `translate(${fit.left + view.x}px, ${fit.top + view.y}px) scale(${view.scale})`,
              }}
            />
            {/* Decorative: FindingList is the accessible source of the same findings. */}
            <div aria-hidden className="absolute inset-0">
              {boxes.map((b) => {
                const r = boxToScreen(b.box, fit, view);
                const state =
                  activeClass === null
                    ? "default"
                    : activeClass === b.classId
                      ? "active"
                      : "dimmed";
                return (
                  <div
                    key={b.id}
                    data-state={state}
                    onPointerEnter={(e) => e.pointerType === "mouse" && onHoverClass(b.classId)}
                    onPointerLeave={(e) => e.pointerType === "mouse" && onHoverClass(null)}
                    className="absolute rounded-[2px] border-2 transition-opacity duration-[120ms] data-[state=active]:z-10 data-[state=active]:border-[3px] data-[state=dimmed]:opacity-25 [&[data-state=dimmed]>span]:hidden"
                    style={{
                      left: r.left,
                      top: r.top,
                      width: r.width,
                      height: r.height,
                      borderColor: b.color,
                    }}
                  >
                    <span
                      className="absolute bottom-full left-[-2px] mb-0.5 whitespace-nowrap px-1 font-mono text-[10px] leading-4 tracking-[0.06em] text-bg uppercase tabular-nums"
                      style={{ background: b.color }}
                    >
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="absolute right-2 bottom-2 flex gap-1">
        <button
          type="button"
          onClick={() => zoomCentre(1 / KEY_ZOOM)}
          aria-label={t(lang, "viewer.zoom_out")}
          className={control}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => zoomCentre(KEY_ZOOM)}
          aria-label={t(lang, "viewer.zoom_in")}
          className={control}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setView(IDENTITY)}
          className={`${control} w-auto px-3 text-xs tracking-[0.06em] uppercase`}
        >
          {t(lang, "viewer.reset")}
        </button>
      </div>
    </div>
  );
}
