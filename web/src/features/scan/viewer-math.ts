// Pure geometry for XrayViewer. Screen point of a normalised image point (u, v):
//   x = fit.left + view.x + u * fit.width * view.scale (same for y).
export type Rect = { left: number; top: number; width: number; height: number };
export type View = { scale: number; x: number; y: number };

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
export const IDENTITY: View = { scale: 1, x: 0, y: 0 };

/** Largest rect with the image's aspect ratio that fits the container, centred. */
export function fitRect(boxW: number, boxH: number, imageW: number, imageH: number): Rect {
  const scale = Math.min(boxW / imageW, boxH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return { left: (boxW - width) / 2, top: (boxH - height) / 2, width, height };
}

/** Keep the zoomed image covering its fitted rect, so it can never be dragged out of view. */
export function clampView(view: View, fit: Rect): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale));
  const clamp = (value: number, size: number) => Math.min(0, Math.max(size - size * scale, value));
  return { scale, x: clamp(view.x, fit.width), y: clamp(view.y, fit.height) };
}

/** Zoom by `factor` keeping the screen point (px, py) fixed under the cursor or pinch centre. */
export function zoomAt(view: View, fit: Rect, factor: number, px: number, py: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
  const ratio = scale / view.scale;
  const ox = px - fit.left;
  const oy = py - fit.top;
  return clampView({ scale, x: ox - (ox - view.x) * ratio, y: oy - (oy - view.y) * ratio }, fit);
}

export function panBy(view: View, fit: Rect, dx: number, dy: number): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, fit);
}

/** Screen rect of a normalised [x1, y1, x2, y2] box. */
export function boxToScreen(box: readonly number[], fit: Rect, view: View): Rect {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = box;
  const w = fit.width * view.scale;
  const h = fit.height * view.scale;
  return {
    left: fit.left + view.x + x1 * w,
    top: fit.top + view.y + y1 * h,
    width: (x2 - x1) * w,
    height: (y2 - y1) * h,
  };
}
