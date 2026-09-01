import type { VisibleCardEntry } from "@/lib/card-expand";
import {
  detachNodeById,
  findDirectParentId,
  findNodeById,
  getSiblingsList,
  insertUnderParent,
  subtreeContainsId,
} from "@/lib/tree-utils";
import type { TaskNode } from "@/types/task-node";

export type CardNavDirection = "up" | "down" | "left" | "right";

export type CardNavResult = {
  nextId: string | null;
  /** Drill into this node (Right on a parent, navigate mode). */
  shouldDrillIn?: boolean;
  /** Leave context to parent (Left). */
  shouldDrillUp?: boolean;
  /** Expand collapsed parent (expand mode, Right). */
  shouldExpand?: boolean;
  /** Collapse expanded parent (expand mode, Left). */
  shouldCollapse?: boolean;
};

export function shouldIgnoreCardKeyboard(e: KeyboardEvent): boolean {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function firstContextCardId(nodes: ReadonlyArray<TaskNode>): string | null {
  return nodes[0]?.id ?? null;
}

/**
 * Navigation in the context child list (navigate mode).
 * Up/Down = siblings; Right = drill into focused card; Left = drill up.
 */
export function navigateContextCard(
  siblings: ReadonlyArray<TaskNode>,
  currentId: string,
  direction: CardNavDirection,
): CardNavResult {
  const idx = siblings.findIndex((n) => n.id === currentId);
  if (idx < 0) return { nextId: null };

  if (direction === "up") {
    return { nextId: idx > 0 ? siblings[idx - 1].id : null };
  }
  if (direction === "down") {
    return { nextId: idx < siblings.length - 1 ? siblings[idx + 1].id : null };
  }
  if (direction === "left") {
    return { nextId: null, shouldDrillUp: true };
  }
  const node = siblings[idx];
  if (node.children.length === 0) return { nextId: null };
  return { nextId: node.id, shouldDrillIn: true };
}

/**
 * Navigation over a flattened expand-mode card list.
 * Up/Down = visible rows; Right = expand or enter first child; Left = collapse or parent / drill up.
 */
export function navigateExpandedCard(
  visible: ReadonlyArray<VisibleCardEntry>,
  collapsedIds: ReadonlySet<string>,
  currentId: string,
  direction: CardNavDirection,
): CardNavResult {
  const idx = visible.findIndex((row) => row.node.id === currentId);
  if (idx < 0) return { nextId: null };

  if (direction === "up") {
    return { nextId: idx > 0 ? visible[idx - 1].node.id : null };
  }
  if (direction === "down") {
    return { nextId: idx < visible.length - 1 ? visible[idx + 1].node.id : null };
  }

  const row = visible[idx];
  const hasChildren = row.node.children.length > 0;
  const collapsed = collapsedIds.has(row.node.id);

  if (direction === "right") {
    if (!hasChildren) return { nextId: null };
    if (collapsed) return { nextId: row.node.id, shouldExpand: true };
    const firstChild = visible[idx + 1];
    if (firstChild && firstChild.parentId === row.node.id) {
      return { nextId: firstChild.node.id };
    }
    return { nextId: null };
  }

  // left
  if (hasChildren && !collapsed) {
    return { nextId: row.node.id, shouldCollapse: true };
  }
  if (row.parentId) {
    return { nextId: row.parentId };
  }
  return { nextId: null, shouldDrillUp: true };
}

/**
 * Navigation in der vollen Baumstruktur (Light-Modus).
 * Wie Expand-Karten, aber ohne Drill-up — der Baum hat keine übergeordnete Ebene.
 */
export function navigateOutlineTree(
  visible: ReadonlyArray<VisibleCardEntry>,
  collapsedIds: ReadonlySet<string>,
  currentId: string,
  direction: CardNavDirection,
): CardNavResult {
  const result = navigateExpandedCard(visible, collapsedIds, currentId, direction);
  if (result.shouldDrillUp) return { nextId: null };
  return result;
}

export function focusTargetAfterRemoving(
  roots: TaskNode[],
  removedId: string,
  preferredSiblingId?: string | null,
): string | null {
  if (preferredSiblingId && findNodeById(roots, preferredSiblingId)) {
    return preferredSiblingId;
  }
  const parentResult = findDirectParentId(roots, removedId);
  if (parentResult === undefined) return null;
  const siblings = getSiblingsList(roots, parentResult).filter((s) => s.id !== removedId);
  if (siblings.length > 0) return siblings[0].id;
  return parentResult;
}

export type KeyboardCardMove = {
  roots: TaskNode[];
  /** Neuer direkter Parent nach dem Verschieben (`null` = Wurzel). */
  parentId: string | null;
};

/**
 * Listen-Sortierung per Tastatur:
 * - up/down: unter denselben Geschwistern tauschen
 * - left: eine Ebene höher, direkt hinter die bisherige Elternkarte
 * - right: eine Ebene tiefer, als letztes Kind der Karte direkt darüber (vorheriges Geschwister)
 */
export function moveCardWithKeyboard(
  roots: TaskNode[],
  nodeId: string,
  direction: CardNavDirection,
): KeyboardCardMove | null {
  const parentId = findDirectParentId(roots, nodeId);
  if (parentId === undefined) return null;

  const siblings = getSiblingsList(roots, parentId);
  const idx = siblings.findIndex((n) => n.id === nodeId);
  if (idx < 0) return null;

  if (direction === "up") {
    if (idx === 0) return null;
    return relocateNode(roots, nodeId, parentId, idx - 1, parentId);
  }

  if (direction === "down") {
    if (idx >= siblings.length - 1) return null;
    // Nach dem Detach sitzt das nächste Geschwister auf `idx`; einfügen dahinter.
    return relocateNode(roots, nodeId, parentId, idx + 1, parentId);
  }

  if (direction === "left") {
    if (parentId === null) return null;
    const grandparentId = findDirectParentId(roots, parentId);
    if (grandparentId === undefined) return null;
    const parentSiblings = getSiblingsList(roots, grandparentId);
    const parentIdx = parentSiblings.findIndex((n) => n.id === parentId);
    if (parentIdx < 0) return null;
    return relocateNode(roots, nodeId, grandparentId, parentIdx + 1, grandparentId);
  }

  if (idx === 0) return null;
  const prev = siblings[idx - 1];
  if (!prev) return null;
  return relocateNode(roots, nodeId, prev.id, prev.children.length, prev.id);
}

function relocateNode(
  roots: TaskNode[],
  nodeId: string,
  insertParentId: string | null,
  insertIndex: number,
  resultParentId: string | null,
): KeyboardCardMove | null {
  const { next, detached } = detachNodeById(roots, nodeId);
  if (!detached) return null;
  return {
    roots: insertUnderParent(next, insertParentId, insertIndex, detached),
    parentId: resultParentId,
  };
}

/**
 * Ob die verschobene Karte in der aktuellen Listen-Ansicht noch sichtbar wäre.
 * Navigate zeigt nur Geschwister der Kontext-Ebene, Expand/Light den ganzen Unterbaum.
 */
export function isCardVisibleInListContext(
  roots: TaskNode[],
  nodeId: string,
  contextNodeId: string | null,
  navigateSiblingsOnly: boolean,
): boolean {
  if (navigateSiblingsOnly) {
    return getSiblingsList(roots, contextNodeId).some((n) => n.id === nodeId);
  }
  if (contextNodeId === null) return findNodeById(roots, nodeId) !== null;
  const ctx = findNodeById(roots, contextNodeId);
  if (!ctx) return false;
  return subtreeContainsId(ctx, nodeId);
}
