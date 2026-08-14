import { defaultCardSize } from "@/lib/card-type-registry";
import type { TaskNode } from "@/types/task-node";

const COLS = 4;
const GAP_X = 40;
const GAP_Y = 36;
const ORIGIN_X = 80;
const ORIGIN_Y = 80;

export function nodeHasCanvasPosition(node: TaskNode): boolean {
  return typeof node.x === "number" && typeof node.y === "number" && Number.isFinite(node.x) && Number.isFinite(node.y);
}

/** Weist fehlenden Geschwistern ein einfaches Grid-Layout zu (immutable). */
export function ensureCanvasLayout(nodes: TaskNode[]): TaskNode[] {
  let nextIndex = 0;
  let changed = false;
  const out = nodes.map((node) => {
    if (nodeHasCanvasPosition(node)) return node;
    const size = defaultCardSize(node.kind);
    const col = nextIndex % COLS;
    const row = Math.floor(nextIndex / COLS);
    nextIndex += 1;
    changed = true;
    return {
      ...node,
      x: ORIGIN_X + col * (size.width + GAP_X),
      y: ORIGIN_Y + row * (size.height + GAP_Y),
      width: node.width ?? size.width,
      height: node.height ?? size.height,
    };
  });
  return changed ? out : nodes;
}

/** Ersetzt Geschwister unter `parentId` (`null` = roots) durch `siblings`. */
export function replaceSiblingsInForest(
  roots: TaskNode[],
  parentId: string | null,
  siblings: TaskNode[],
): TaskNode[] {
  if (parentId === null) return siblings;

  function walk(nodes: TaskNode[]): TaskNode[] {
    return nodes.map((n) => {
      if (n.id === parentId) {
        return { ...n, children: siblings };
      }
      if (n.children.length === 0) return n;
      return { ...n, children: walk(n.children) };
    });
  }
  return walk(roots);
}
