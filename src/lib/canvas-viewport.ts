export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.1;

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = { x: 40, y: 40, zoom: 1 };

/** Padding around content when fitting the viewport (screen px). */
export const FIT_VIEW_PADDING = 48;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function zoomAtPoint(
  viewport: CanvasViewport,
  delta: number,
  clientX: number,
  clientY: number,
  rect: DOMRect,
): CanvasViewport {
  const oldZoom = viewport.zoom;
  const newZoom = clampZoom(oldZoom + delta);
  if (newZoom === oldZoom) return viewport;

  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const worldX = (px - viewport.x) / oldZoom;
  const worldY = (py - viewport.y) / oldZoom;

  return {
    x: px - worldX * newZoom,
    y: py - worldY * newZoom,
    zoom: newZoom,
  };
}

export function screenToWorld(
  viewport: CanvasViewport,
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.zoom,
    y: (clientY - rect.top - viewport.y) / viewport.zoom,
  };
}

export function snapToGrid(value: number, gridSize = 20): number {
  return Math.round(value / gridSize) * gridSize;
}

export function unionWorldBounds(
  rects: Iterable<{ x: number; y: number; w: number; h: number }>,
): WorldBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;
  for (const r of rects) {
    if (!Number.isFinite(r.x) || !Number.isFinite(r.y) || !Number.isFinite(r.w) || !Number.isFinite(r.h)) {
      continue;
    }
    if (r.w <= 0 || r.h <= 0) continue;
    found = true;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  if (!found) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Zoom/pan so that `bounds` fills the viewport container (with padding).
 * World → screen: `screen = world * zoom + viewportOffset`.
 */
export function fitViewportToBounds(
  bounds: WorldBounds,
  viewWidth: number,
  viewHeight: number,
  padding: number = FIT_VIEW_PADDING,
): CanvasViewport {
  if (viewWidth <= 0 || viewHeight <= 0) return { ...DEFAULT_CANVAS_VIEWPORT };

  const contentW = Math.max(1, bounds.maxX - bounds.minX);
  const contentH = Math.max(1, bounds.maxY - bounds.minY);
  const pad = Math.max(0, padding);
  const availW = Math.max(1, viewWidth - pad * 2);
  const availH = Math.max(1, viewHeight - pad * 2);
  const zoom = clampZoom(Math.min(availW / contentW, availH / contentH));

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    x: viewWidth / 2 - centerX * zoom,
    y: viewHeight / 2 - centerY * zoom,
    zoom,
  };
}
