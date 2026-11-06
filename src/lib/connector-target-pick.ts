import {
  findCardAtWorldPoint,
  taskCardAnchorToward,
  taskCardRect,
  type ElementRect,
  type Point,
} from "@/lib/connector-geometry";
import type { TaskNode } from "@/types/task-node";

function pointInRect(point: Point, rect: ElementRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function expandRect(rect: ElementRect, margin: number): ElementRect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    w: rect.w + margin * 2,
    h: rect.h + margin * 2,
  };
}

/** Innermost card at `point`, optionally snapping near edges (E2-style). */
export function pickConnectorTargetAt(
  point: Point,
  nodes: readonly TaskNode[],
  excludeIds?: ReadonlySet<string> | readonly string[],
  snapMargin = 28,
): TaskNode | null {
  const direct = findCardAtWorldPoint(nodes, point.x, point.y, excludeIds);
  if (direct) return direct;

  let best: TaskNode | null = null;
  let bestArea = Number.POSITIVE_INFINITY;

  const excluded =
    excludeIds == null
      ? null
      : excludeIds instanceof Set
        ? excludeIds
        : new Set(excludeIds);

  for (const node of nodes) {
    if (excluded?.has(node.id)) continue;
    const card = taskCardRect(node);
    const bounds = expandRect(card, snapMargin);
    if (!pointInRect(point, bounds)) continue;
    const area = Math.max(0, card.w) * Math.max(0, card.h);
    if (area < bestArea) {
      best = node;
      bestArea = area;
    }
  }

  return best;
}

export interface ConnectorEndpointDragPreview {
  lineEnd: Point;
  target: TaskNode | null;
  valid: boolean;
}

/** While dragging a relation end: snap line to the target edge toward `toward`. */
export function connectorEndpointDragPreview(
  pointer: Point,
  toward: Point,
  nodes: readonly TaskNode[],
  excludeIds: readonly string[],
  canAttach: (target: TaskNode) => boolean,
): ConnectorEndpointDragPreview {
  const target = pickConnectorTargetAt(pointer, nodes, excludeIds);
  if (!target || !canAttach(target)) {
    return { lineEnd: pointer, target, valid: false };
  }
  return {
    lineEnd: taskCardAnchorToward(target, toward),
    target,
    valid: true,
  };
}
