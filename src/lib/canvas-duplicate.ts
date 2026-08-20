import { remapTaskNodeIds } from "@/lib/task-tree-json";
import { collectAllNodeIds } from "@/lib/task-id";
import { createRelationId } from "@/lib/task-relations";
import { findDirectParentId, getSiblingsList, insertUnderParent } from "@/lib/tree-utils";
import type { TaskNode } from "@/types/task-node";
import type { TaskRelation } from "@/types/task-relation";

export const CANVAS_DUPLICATE_OFFSET = 24;

export interface DuplicateCanvasResult {
  roots: TaskNode[];
  relations: TaskRelation[];
  newIds: string[];
}

/**
 * Dupliziert die gewählten Geschwister (inkl. Unterbaum) mit neuen IDs,
 * versetzt sie auf dem Canvas und kopiert Relationen innerhalb der Auswahl.
 */
export function duplicateCanvasNodes(
  roots: TaskNode[],
  relations: TaskRelation[],
  nodeIds: string[],
  options?: { clipboardRoots?: TaskNode[]; offset?: number },
): DuplicateCanvasResult | null {
  if (nodeIds.length === 0) return null;
  const idSet = new Set(nodeIds);
  const parentId = findDirectParentId(roots, nodeIds[0]!);
  if (parentId === undefined) return null;
  for (const id of nodeIds) {
    if (findDirectParentId(roots, id) !== parentId) return null;
  }

  const siblings = getSiblingsList(roots, parentId);
  const toClone = siblings.filter((n) => idSet.has(n.id));
  if (toClone.length === 0) return null;

  const offset = options?.offset ?? CANVAS_DUPLICATE_OFFSET;
  const taken = collectAllNodeIds([...(options?.clipboardRoots ?? []), ...roots]);
  const idMap = new Map<string, string>();
  const clones: TaskNode[] = [];

  for (const node of toClone) {
    const fresh = remapTaskNodeIds(node, taken);
    clones.push({
      ...fresh,
      x: (node.x ?? 0) + offset,
      y: (node.y ?? 0) + offset,
    });
    idMap.set(node.id, fresh.id);
  }

  const extraRelations: TaskRelation[] = [];
  for (const rel of relations) {
    const sourceId = idMap.get(rel.sourceId);
    const targetId = idMap.get(rel.targetId);
    if (!sourceId || !targetId) continue;
    extraRelations.push({
      ...rel,
      id: createRelationId([...relations, ...extraRelations]),
      sourceId,
      targetId,
    });
  }

  const lastIndex = Math.max(...toClone.map((n) => siblings.findIndex((s) => s.id === n.id)));
  let nextRoots = roots;
  let insertAt = lastIndex + 1;
  for (const clone of clones) {
    nextRoots = insertUnderParent(nextRoots, parentId, insertAt, clone);
    insertAt += 1;
  }

  return {
    roots: nextRoots,
    relations: [...relations, ...extraRelations],
    newIds: clones.map((c) => c.id),
  };
}
