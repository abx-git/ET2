import { defaultCardSize } from "@/lib/card-type-registry";
import { isSymbolNode } from "@/lib/tree-node-kind";
import type { TaskNode } from "@/types/task-node";

export interface Point {
  x: number;
  y: number;
}

export interface ElementRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function taskCardRect(node: TaskNode): ElementRect {
  const defaults = defaultCardSize(node.kind, node.symbolType);
  return {
    x: node.x ?? 0,
    y: node.y ?? 0,
    w: node.width ?? defaults.width,
    h: node.height ?? defaults.height,
  };
}

export function taskCardCenter(node: TaskNode): Point {
  const rect = taskCardRect(node);
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/** Intersection of the ray from `from` toward `toward` with the rectangle edge. */
export function rectEdgePoint(rect: ElementRect, from: Point, toward: Point): Point {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }

  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const hw = rect.w / 2;
  const hh = rect.h / 2;

  const scaleX = Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const scaleY = Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const t = Math.min(scaleX, scaleY);

  return { x: cx + dx * t, y: cy + dy * t };
}

/** Ray from center toward `toward` ∩ ellipse inscribed in rect. */
export function ellipseEdgePoint(rect: ElementRect, toward: Point): Point {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const rx = rect.w / 2;
  const ry = rect.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return { x: cx + rx, y: cy };
  }
  const scale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/** Ray from center toward `toward` ∩ diamond (rhombus) inscribed in rect. */
export function diamondEdgePoint(rect: ElementRect, toward: Point): Point {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return { x: cx + hw, y: cy };
  }
  const t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
  return { x: cx + dx * t, y: cy + dy * t };
}

function nodeEdgePoint(node: TaskNode, toward: Point): Point {
  const rect = taskCardRect(node);
  const center = taskCardCenter(node);
  if (isSymbolNode(node)) {
    if (node.symbolType === "useCase") return ellipseEdgePoint(rect, toward);
    if (node.symbolType === "decision") return diamondEdgePoint(rect, toward);
  }
  return rectEdgePoint(rect, center, toward);
}

export function relationAnchors(
  source: TaskNode,
  target: TaskNode,
): { start: Point; end: Point } {
  const sc = taskCardCenter(source);
  const tc = taskCardCenter(target);
  return {
    start: nodeEdgePoint(source, tc),
    end: nodeEdgePoint(target, sc),
  };
}

/** Top-most card whose axis-aligned rect contains the world point (last in `nodes` wins). */
export function findCardAtWorldPoint(
  nodes: readonly TaskNode[],
  worldX: number,
  worldY: number,
  excludeIds?: ReadonlySet<string> | readonly string[],
): TaskNode | null {
  const excluded =
    excludeIds == null
      ? null
      : excludeIds instanceof Set
        ? excludeIds
        : new Set(excludeIds);
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i];
    if (!node) continue;
    if (excluded?.has(node.id)) continue;
    const r = taskCardRect(node);
    if (
      worldX >= r.x &&
      worldX <= r.x + r.w &&
      worldY >= r.y &&
      worldY <= r.y + r.h
    ) {
      return node;
    }
  }
  return null;
}
