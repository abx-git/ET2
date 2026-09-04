/**
 * Dual-pane (Norton-style) navigation: shared tree, per-pane drill context.
 */

import { normalizeContextNodeId } from "@/lib/board-context";
import { findNodeById, pathFromRootToNode } from "@/lib/tree-utils";
import type { TaskNode } from "@/types/task-node";

export type BoardPaneId = "left" | "right";

export type PaneContexts = Record<BoardPaneId, string | null>;

export const BOARD_PANE_IDS: BoardPaneId[] = ["left", "right"];

export const DEFAULT_PANE_CONTEXTS: PaneContexts = { left: null, right: null };

export function isBoardPaneId(value: unknown): value is BoardPaneId {
  return value === "left" || value === "right";
}

export function otherBoardPane(pane: BoardPaneId): BoardPaneId {
  return pane === "left" ? "right" : "left";
}

/**
 * Kontext nach Baumänderungen: existierender Ordner bleibt,
 * verschwundener Ordner → nächster noch vorhandener Vorfahr (nicht die Wurzel, wenn ein Parent lebt).
 */
export function recoverContextAfterRemoval(
  previousRoots: TaskNode[],
  nextRoots: TaskNode[],
  contextId: string | null,
): string | null {
  if (!contextId) return null;
  if (findNodeById(nextRoots, contextId)) return contextId;
  const path = pathFromRootToNode(previousRoots, contextId) ?? [];
  for (let i = path.length - 2; i >= 0; i--) {
    const id = path[i];
    if (id && findNodeById(nextRoots, id)) return id;
  }
  return null;
}

export function normalizePaneContexts(
  nextRoots: TaskNode[],
  contexts: PaneContexts,
  previousRoots: TaskNode[] = nextRoots,
): PaneContexts {
  if (previousRoots === nextRoots) {
    return {
      left: normalizeContextNodeId(nextRoots, contexts.left),
      right: normalizeContextNodeId(nextRoots, contexts.right),
    };
  }
  return {
    left: recoverContextAfterRemoval(previousRoots, nextRoots, contexts.left),
    right: recoverContextAfterRemoval(previousRoots, nextRoots, contexts.right),
  };
}

/** Prefix for context-list DnD ids so left/right panes never collide. */
export const CONTEXT_PANE_ID_RE = /^pane:(left|right):(.*)$/;

export function withContextPanePrefix(pane: BoardPaneId, bareId: string): string {
  return `pane:${pane}:${bareId}`;
}

export function parseContextPanePrefixedId(id: string | number): {
  pane: BoardPaneId;
  bareId: string;
} | null {
  const m = CONTEXT_PANE_ID_RE.exec(String(id));
  if (!m) return null;
  return { pane: m[1] as BoardPaneId, bareId: m[2]! };
}

export function stripContextPanePrefix(id: string | number): string {
  return parseContextPanePrefixedId(id)?.bareId ?? String(id);
}
