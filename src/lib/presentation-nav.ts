import { isCardNode, isSymbolNode } from "@/lib/tree-node-kind";
import type { TaskNode } from "@/types/task-node";

export type PresentationNavDirection = "up" | "down" | "left" | "right";

export type PresentationNavResult = {
  nextId: string | null;
  /** Rechts auf Karte mit Kindern: in die Unterebene. */
  shouldDrillIn?: boolean;
  /** Links: eine Ebene hoch. */
  shouldDrillUp?: boolean;
};

export function firstPresentationItemId(items: ReadonlyArray<TaskNode>): string | null {
  return items[0]?.id ?? null;
}

/** Karte hat präsentierbare Kinder (keine reinen Symbol-Unterebenen). */
export function canPresentationDrillIn(node: TaskNode): boolean {
  if (!isCardNode(node)) return false;
  return node.children.some((c) => !isSymbolNode(c));
}

/**
 * Präsentations-Navigation auf einer Folie (Geschwister der Context-Ebene).
 * Hoch/Runter = Fokus · Rechts = drill-in (nur Karte mit Kindern) · Links = drill-up.
 */
export function navigatePresentation(
  items: ReadonlyArray<TaskNode>,
  currentId: string | null,
  direction: PresentationNavDirection,
): PresentationNavResult {
  if (items.length === 0) {
    if (direction === "left") return { nextId: null, shouldDrillUp: true };
    return { nextId: null };
  }

  if (!currentId) {
    if (direction === "left") return { nextId: null, shouldDrillUp: true };
    if (direction === "up" || direction === "down" || direction === "right") {
      return { nextId: items[0]!.id };
    }
    return { nextId: null };
  }

  const idx = items.findIndex((n) => n.id === currentId);
  if (idx < 0) {
    return { nextId: items[0]!.id };
  }

  if (direction === "up") {
    return { nextId: idx > 0 ? items[idx - 1]!.id : items[idx]!.id };
  }
  if (direction === "down") {
    return { nextId: idx < items.length - 1 ? items[idx + 1]!.id : items[idx]!.id };
  }
  if (direction === "left") {
    return { nextId: null, shouldDrillUp: true };
  }

  // right
  const node = items[idx]!;
  if (canPresentationDrillIn(node)) {
    return { nextId: node.id, shouldDrillIn: true };
  }
  return { nextId: currentId };
}

/** Nach drill-in: Fokus auf erstes Kind der neuen Ebene. */
export function focusAfterDrillIn(children: ReadonlyArray<TaskNode>): string | null {
  return firstPresentationItemId(children);
}
