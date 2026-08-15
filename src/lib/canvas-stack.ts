import { defaultSymbolZIndex } from "@/lib/diagram-symbol";
import { isSymbolNode } from "@/lib/tree-node-kind";
import type { TaskNode } from "@/types/task-node";

export type CanvasZAction = "front" | "forward" | "backward" | "back";

/** Logische Canvas-Stapelebene (höher = weiter vorne). */
export function resolveCanvasZIndex(node: TaskNode): number {
  if (typeof node.zIndex === "number" && Number.isFinite(node.zIndex)) {
    return node.zIndex;
  }
  if (isSymbolNode(node) && node.symbolType) {
    return defaultSymbolZIndex(node.symbolType);
  }
  if (isSymbolNode(node)) return 10;
  return 15;
}

/** CSS z-index: Layer-Abstand groß genug, Auswahl-Boost nur innerhalb derselben Ebene. */
export function canvasStackCssZIndex(
  node: TaskNode,
  opts?: { selected?: boolean; hovered?: boolean; connectSource?: boolean; editing?: boolean },
): number {
  const base = 10 + resolveCanvasZIndex(node) * 2;
  if (opts?.selected || opts?.editing || opts?.connectSource) return base + 1;
  if (opts?.hovered) return base;
  return base;
}

export function compareCanvasStackOrder(a: TaskNode, b: TaskNode): number {
  const dz = resolveCanvasZIndex(a) - resolveCanvasZIndex(b);
  if (dz !== 0) return dz;
  return a.id.localeCompare(b.id);
}

/**
 * Neue zIndex-Werte für `nodeId` und ggf. getauschten Nachbarn unter `siblings`.
 * Liefert Patches; leeres Array wenn nichts zu tun.
 */
export function computeCanvasZIndexPatches(
  siblings: readonly TaskNode[],
  nodeId: string,
  action: CanvasZAction,
): { id: string; zIndex: number }[] {
  const target = siblings.find((n) => n.id === nodeId);
  if (!target) return [];

  const ranked = [...siblings].sort(compareCanvasStackOrder);
  const idx = ranked.findIndex((n) => n.id === nodeId);
  if (idx < 0) return [];

  if (action === "front") {
    const max = Math.max(...ranked.map(resolveCanvasZIndex));
    const next = max + 1;
    if (resolveCanvasZIndex(target) === next) return [];
    return [{ id: nodeId, zIndex: next }];
  }

  if (action === "back") {
    const min = Math.min(...ranked.map(resolveCanvasZIndex));
    const next = min - 1;
    if (resolveCanvasZIndex(target) === next) return [];
    return [{ id: nodeId, zIndex: next }];
  }

  if (action === "forward") {
    const above = ranked[idx + 1];
    if (!above) return computeCanvasZIndexPatches(siblings, nodeId, "front");
    return [
      { id: nodeId, zIndex: resolveCanvasZIndex(above) },
      { id: above.id, zIndex: resolveCanvasZIndex(target) },
    ];
  }

  // backward
  const below = ranked[idx - 1];
  if (!below) return computeCanvasZIndexPatches(siblings, nodeId, "back");
  return [
    { id: nodeId, zIndex: resolveCanvasZIndex(below) },
    { id: below.id, zIndex: resolveCanvasZIndex(target) },
  ];
}
