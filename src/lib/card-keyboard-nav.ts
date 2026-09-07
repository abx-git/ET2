import type { CardInteractionMode, VisibleCardEntry } from "@/lib/card-expand";
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
  if (
    preferredSiblingId &&
    preferredSiblingId !== removedId &&
    findNodeById(roots, preferredSiblingId)
  ) {
    return preferredSiblingId;
  }
  const parentResult = findDirectParentId(roots, removedId);
  if (parentResult === undefined) return null;
  const siblings = getSiblingsList(roots, parentResult);
  const idx = siblings.findIndex((s) => s.id === removedId);
  if (idx >= 0) {
    const next = siblings[idx + 1];
    if (next) return next.id;
    const prev = siblings[idx - 1];
    if (prev) return prev.id;
  }
  return parentResult;
}

/**
 * Nächster Eintrag in einer sichtbaren Liste, wenn `lostId` verschwindet:
 * erst der Nachfolger (gleiche visuelle Position), sonst der Vorgänger.
 * Springt nicht an den Listenanfang, nur weil etwas gelöscht wurde.
 */
export function nearestRemainingId(
  previousIds: readonly string[],
  nextIds: readonly string[],
  lostId: string | null,
): string | null {
  const nextSet = new Set(nextIds);
  if (lostId && nextSet.has(lostId)) return lostId;
  if (!lostId) return null;
  const idx = previousIds.indexOf(lostId);
  if (idx >= 0) {
    for (let i = idx + 1; i < previousIds.length; i++) {
      const id = previousIds[i];
      if (id && nextSet.has(id)) return id;
    }
    for (let i = idx - 1; i >= 0; i--) {
      const id = previousIds[i];
      if (id && nextSet.has(id)) return id;
    }
  }
  for (const id of previousIds) {
    if (nextSet.has(id)) return id;
  }
  return null;
}

export type RecoverPaneListFocusArgs = {
  previousIds: readonly string[];
  nextIds: readonly string[];
  previousFocusId: string | null;
  previousContextId: string | null;
  previousRoots: TaskNode[];
  nextRoots: TaskNode[];
};

/**
 * Fokus in einem Split-Panel halten, wenn der Baum sich ändert.
 * Verschwundene Einträge → Nachbar in derselben Liste; verschwundener
 * Kontext-Ordner → Nachbar des Ordners in der neuen (Eltern-)Liste.
 */
export function recoverPaneListFocus({
  previousIds,
  nextIds,
  previousFocusId,
  previousContextId,
  previousRoots,
  nextRoots,
}: RecoverPaneListFocusArgs): string | null {
  const nextSet = new Set(nextIds);
  if (previousFocusId && nextSet.has(previousFocusId)) return previousFocusId;

  if (previousFocusId && previousIds.includes(previousFocusId)) {
    const nearby = nearestRemainingId(previousIds, nextIds, previousFocusId);
    if (nearby) return nearby;
  }

  if (previousContextId && !findNodeById(nextRoots, previousContextId)) {
    const parent = findDirectParentId(previousRoots, previousContextId);
    if (parent !== undefined) {
      const oldSiblingIds = getSiblingsList(previousRoots, parent).map((n) => n.id);
      const nearby = nearestRemainingId(oldSiblingIds, nextIds, previousContextId);
      if (nearby) return nearby;
    }
  }

  if (previousFocusId && !findNodeById(nextRoots, previousFocusId)) {
    let candidate = focusTargetAfterRemoving(previousRoots, previousFocusId);
    const seen = new Set<string>([previousFocusId]);
    while (candidate && !nextSet.has(candidate) && !seen.has(candidate)) {
      seen.add(candidate);
      if (!findNodeById(nextRoots, candidate)) {
        candidate = focusTargetAfterRemoving(previousRoots, candidate);
        continue;
      }
      break;
    }
    if (candidate && nextSet.has(candidate)) return candidate;
  }

  if (previousFocusId && findNodeById(nextRoots, previousFocusId)) {
    return previousFocusId;
  }
  return null;
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
 *
 * `collapsedIds`: in Expand/Light unsichtbare Äste. Einrücken unter eine
 * zugeklappte Karte ist verboten — die verschobene Karte würde sofort verschwinden.
 */
export function moveCardWithKeyboard(
  roots: TaskNode[],
  nodeId: string,
  direction: CardNavDirection,
  collapsedIds?: ReadonlySet<string>,
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
  if (collapsedIds?.has(prev.id)) return null;
  return relocateNode(roots, nodeId, prev.id, prev.children.length, prev.id);
}

/** Welche Shift+Pfeil-Verschiebungen für diese Karte möglich sind. */
export function availableKeyboardMoves(
  roots: TaskNode[],
  nodeId: string,
  collapsedIds?: ReadonlySet<string>,
): Record<CardNavDirection, boolean> {
  const parentId = findDirectParentId(roots, nodeId);
  if (parentId === undefined) {
    return { up: false, down: false, left: false, right: false };
  }
  const siblings = getSiblingsList(roots, parentId);
  const idx = siblings.findIndex((n) => n.id === nodeId);
  if (idx < 0) {
    return { up: false, down: false, left: false, right: false };
  }
  const prev = idx > 0 ? siblings[idx - 1] : undefined;
  return {
    up: idx > 0,
    down: idx < siblings.length - 1,
    left: parentId !== null,
    right: prev != null && !collapsedIds?.has(prev.id),
  };
}

/**
 * Welche Klapp-IDs Shift+Rechts beachten muss: nur wo zugeklappte Äste
 * Nachfahren wirklich ausblenden (Light-Baum bzw. Listen-Expand).
 */
export function collapsedIdsHidingKeyboardNest(
  lightModeEnabled: boolean,
  cardInteractionMode: CardInteractionMode,
  collapsedIds: readonly string[],
  cardCollapsedIds: readonly string[],
): ReadonlySet<string> | undefined {
  if (lightModeEnabled) return new Set(collapsedIds);
  if (cardInteractionMode === "expand") return new Set(cardCollapsedIds);
  return undefined;
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
