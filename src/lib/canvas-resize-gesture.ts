export type CanvasResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const CANVAS_RESIZE_HANDLE_CLASSES: Record<CanvasResizeHandle, string> = {
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
};

export function beginCanvasResizeGesture(options: {
  handle: CanvasResizeHandle;
  zoom: number;
  orig: { x: number; y: number; width: number; height: number };
  minWidth: number;
  minHeight: number;
  clientX: number;
  clientY: number;
  onResize: (patch: { x: number; y: number; width: number; height: number }) => void;
  onEnd?: () => void;
}): void {
  const { handle, zoom, orig, minWidth, minHeight, clientX, clientY, onResize, onEnd } = options;
  const startX = clientX;
  const startY = clientY;

  const onMoveEv = (ev: PointerEvent) => {
    const dx = (ev.clientX - startX) / zoom;
    const dy = (ev.clientY - startY) / zoom;
    let x = orig.x;
    let y = orig.y;
    let width = orig.width;
    let height = orig.height;
    if (handle.includes("e")) width = Math.max(minWidth, orig.width + dx);
    if (handle.includes("s")) height = Math.max(minHeight, orig.height + dy);
    if (handle.includes("w")) {
      const nextWidth = Math.max(minWidth, orig.width - dx);
      x = orig.x + (orig.width - nextWidth);
      width = nextWidth;
    }
    if (handle.includes("n")) {
      const nextHeight = Math.max(minHeight, orig.height - dy);
      y = orig.y + (orig.height - nextHeight);
      height = nextHeight;
    }
    onResize({ x, y, width, height });
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMoveEv);
    window.removeEventListener("pointerup", onUp);
    onEnd?.();
  };

  window.addEventListener("pointermove", onMoveEv);
  window.addEventListener("pointerup", onUp);
}

export function beginCanvasRotateGesture(options: {
  getHostElement: () => HTMLElement | null;
  startRotation: number;
  snapDegrees: number;
  clientX: number;
  clientY: number;
  onRotate: (degrees: number) => void;
  onEnd?: () => void;
}): void {
  const { getHostElement, startRotation, snapDegrees, clientX, clientY, onRotate, onEnd } = options;

  const angleAt = (cx: number, cy: number) => {
    const cardEl = getHostElement();
    if (!cardEl) return 0;
    const r = cardEl.getBoundingClientRect();
    const center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    return (Math.atan2(cy - center.y, cx - center.x) * 180) / Math.PI;
  };

  const startAngle = angleAt(clientX, clientY);

  const onMove = (ev: PointerEvent) => {
    const delta = angleAt(ev.clientX, ev.clientY) - startAngle;
    let next = startRotation + delta;
    if (ev.shiftKey) {
      next = Math.round(next / snapDegrees) * snapDegrees;
    }
    onRotate(next);
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    onEnd?.();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
