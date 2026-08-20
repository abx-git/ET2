import { taskCardRect } from "@/lib/connector-geometry";
import type { TaskNode } from "@/types/task-node";

/** Ausrichten / Verteilen / gleiche Größe — wie in E2. */
export type AlignMode =
  | "left"
  | "centerX"
  | "right"
  | "top"
  | "centerY"
  | "bottom"
  | "distributeX"
  | "distributeY"
  | "sameWidth"
  | "sameHeight";

export type ElementGeometryPatch = {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export const ALIGN_MODE_LABELS: Record<AlignMode, string> = {
  left: "Links ausrichten",
  centerX: "Horizontal zentrieren",
  right: "Rechts ausrichten",
  top: "Oben ausrichten",
  centerY: "Vertikal zentrieren",
  bottom: "Unten ausrichten",
  distributeX: "Horizontal verteilen",
  distributeY: "Vertikal verteilen",
  sameWidth: "Gleiche Breite",
  sameHeight: "Gleiche Höhe",
};

export const ALIGN_MODES_TWO: AlignMode[] = [
  "left",
  "centerX",
  "right",
  "top",
  "centerY",
  "bottom",
  "sameWidth",
  "sameHeight",
];

export const ALIGN_MODES_THREE: AlignMode[] = ["distributeX", "distributeY"];

type Sized = { id: string; x: number; y: number; w: number; h: number };

function sized(nodes: TaskNode[]): Sized[] {
  return nodes.map((node) => {
    const b = taskCardRect(node);
    return { id: node.id, x: b.x, y: b.y, w: b.w, h: b.h };
  });
}

/** Geometrie-Patches für Ausrichten / Verteilen / gleiche Größe der Auswahl. */
export function computeAlignPatches(
  nodes: TaskNode[],
  mode: AlignMode,
  referenceId?: string,
): ElementGeometryPatch[] {
  if (nodes.length < 2) return [];
  const items = sized(nodes);

  switch (mode) {
    case "left": {
      const edge = Math.min(...items.map((i) => i.x));
      return items.map((i) => ({ id: i.id, x: edge }));
    }
    case "right": {
      const edge = Math.max(...items.map((i) => i.x + i.w));
      return items.map((i) => ({ id: i.id, x: edge - i.w }));
    }
    case "centerX": {
      const min = Math.min(...items.map((i) => i.x));
      const max = Math.max(...items.map((i) => i.x + i.w));
      const mid = (min + max) / 2;
      return items.map((i) => ({ id: i.id, x: mid - i.w / 2 }));
    }
    case "top": {
      const edge = Math.min(...items.map((i) => i.y));
      return items.map((i) => ({ id: i.id, y: edge }));
    }
    case "bottom": {
      const edge = Math.max(...items.map((i) => i.y + i.h));
      return items.map((i) => ({ id: i.id, y: edge - i.h }));
    }
    case "centerY": {
      const min = Math.min(...items.map((i) => i.y));
      const max = Math.max(...items.map((i) => i.y + i.h));
      const mid = (min + max) / 2;
      return items.map((i) => ({ id: i.id, y: mid - i.h / 2 }));
    }
    case "distributeX": {
      if (items.length < 3) return [];
      const sorted = [...items].sort((a, b) => a.x - b.x);
      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;
      const span = last.x + last.w - first.x;
      const totalW = sorted.reduce((sum, i) => sum + i.w, 0);
      const gap = (span - totalW) / (sorted.length - 1);
      let x = first.x;
      return sorted.map((item) => {
        const patch = { id: item.id, x };
        x += item.w + gap;
        return patch;
      });
    }
    case "distributeY": {
      if (items.length < 3) return [];
      const sorted = [...items].sort((a, b) => a.y - b.y);
      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;
      const span = last.y + last.h - first.y;
      const totalH = sorted.reduce((sum, i) => sum + i.h, 0);
      const gap = (span - totalH) / (sorted.length - 1);
      let y = first.y;
      return sorted.map((item) => {
        const patch = { id: item.id, y };
        y += item.h + gap;
        return patch;
      });
    }
    case "sameWidth": {
      const ref = items.find((i) => i.id === referenceId) ?? items[0]!;
      return items.map((i) => ({ id: i.id, width: ref.w }));
    }
    case "sameHeight": {
      const ref = items.find((i) => i.id === referenceId) ?? items[0]!;
      return items.map((i) => ({ id: i.id, height: ref.h }));
    }
    default:
      return [];
  }
}

/** Wendet Geometrie-Patches auf den Wald an (immutable). */
export function applyGeometryPatches(roots: TaskNode[], patches: ElementGeometryPatch[]): TaskNode[] {
  if (patches.length === 0) return roots;
  const byId = new Map(patches.map((p) => [p.id, p]));
  function walk(nodes: TaskNode[]): TaskNode[] {
    let changed = false;
    const next = nodes.map((n) => {
      const patch = byId.get(n.id);
      let node = n;
      if (patch) {
        node = {
          ...n,
          ...(patch.x !== undefined ? { x: patch.x } : {}),
          ...(patch.y !== undefined ? { y: patch.y } : {}),
          ...(patch.width !== undefined ? { width: patch.width } : {}),
          ...(patch.height !== undefined ? { height: patch.height } : {}),
        };
        changed = true;
      }
      if (n.children.length > 0) {
        const children = walk(n.children);
        if (children !== n.children) {
          node = { ...node, children };
          changed = true;
        }
      }
      return node;
    });
    return changed ? next : nodes;
  }
  return walk(roots);
}
