export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.1;

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = { x: 40, y: 40, zoom: 1 };

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
