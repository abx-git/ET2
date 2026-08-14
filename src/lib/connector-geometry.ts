import { defaultCardSize } from "@/lib/card-type-registry";
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
  const defaults = defaultCardSize(node.kind);
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

export function relationAnchors(
  source: TaskNode,
  target: TaskNode,
): { start: Point; end: Point } {
  const sc = taskCardCenter(source);
  const tc = taskCardCenter(target);
  const sRect = taskCardRect(source);
  const tRect = taskCardRect(target);
  return {
    start: rectEdgePoint(sRect, sc, tc),
    end: rectEdgePoint(tRect, tc, sc),
  };
}
