import type { Point } from "@/lib/connector-geometry";

export function beginConnectorEndpointDrag(options: {
  clientToWorld: (clientX: number, clientY: number) => Point;
  onMove: (world: Point) => void;
  onCommit: (world: Point) => void;
  onCancel?: () => void;
}): void {
  const { clientToWorld, onMove, onCommit, onCancel } = options;

  const onPointerMove = (ev: PointerEvent) => {
    onMove(clientToWorld(ev.clientX, ev.clientY));
  };

  const onPointerUp = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    onCommit(clientToWorld(ev.clientX, ev.clientY));
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}
