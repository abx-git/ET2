/**
 * Norton-Commander-Transfer zwischen den beiden Split-Panels:
 * Quelle = fokussierter Eintrag im aktiven Panel,
 * Ziel = aktueller Kontext-Ordner des anderen Panels.
 */

import { remapTaskNodeIds } from "@/lib/task-tree-json";
import { collectAllNodeIds } from "@/lib/task-id";
import { createRelationId } from "@/lib/task-relations";
import {
  detachNodeById,
  findDirectParentId,
  findNodeById,
  getSiblingsList,
  insertUnderParent,
  subtreeContainsId,
} from "@/lib/tree-utils";
import type { TaskNode } from "@/types/task-node";
import type { TaskRelation } from "@/types/task-relation";

export type SplitTransferBlockReason =
  | "missing-source"
  | "missing-target"
  | "into-self"
  | "already-there";

export function splitTransferBlockReason(
  roots: TaskNode[],
  nodeId: string | null,
  targetContextId: string | null,
  kind: "copy" | "move",
): SplitTransferBlockReason | null {
  if (!nodeId) return "missing-source";
  const source = findNodeById(roots, nodeId);
  if (!source) return "missing-source";
  if (targetContextId !== null && !findNodeById(roots, targetContextId)) {
    return "missing-target";
  }
  if (kind === "move") {
    if (targetContextId === nodeId || subtreeContainsId(source, targetContextId ?? "")) {
      return "into-self";
    }
    if (findDirectParentId(roots, nodeId) === targetContextId) {
      return "already-there";
    }
  }
  return null;
}

export function splitTransferBlockMessage(reason: SplitTransferBlockReason): string {
  switch (reason) {
    case "missing-source":
      return "Bitte zuerst einen Eintrag im Quell-Panel wählen.";
    case "missing-target":
      return "Das Ziel-Panel hat keinen gültigen Ordner mehr.";
    case "into-self":
      return "Ein Eintrag kann nicht in sich selbst oder seinen Unterbaum gelegt werden.";
    case "already-there":
      return "Der Eintrag liegt bereits in diesem Ordner.";
  }
}

export type CopyNodeToContextResult = {
  roots: TaskNode[];
  relations: TaskRelation[];
  newId: string;
};

export function copyNodeToContext(
  roots: TaskNode[],
  relations: TaskRelation[],
  nodeId: string,
  targetContextId: string | null,
  clipboardRoots: TaskNode[] = [],
): CopyNodeToContextResult | null {
  if (splitTransferBlockReason(roots, nodeId, targetContextId, "copy")) return null;
  const source = findNodeById(roots, nodeId);
  if (!source) return null;

  const taken = collectAllNodeIds([...clipboardRoots, ...roots]);
  const clone = remapTaskNodeIds(source, taken);
  const siblings = getSiblingsList(roots, targetContextId);
  const nextRoots = insertUnderParent(roots, targetContextId, siblings.length, clone);

  const extraRelations: TaskRelation[] = [];
  const idMap = collectIdMap(source, clone);
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

  return {
    roots: nextRoots,
    relations: [...relations, ...extraRelations],
    newId: clone.id,
  };
}

export type MoveNodeToContextResult = {
  roots: TaskNode[];
};

export function moveNodeToContext(
  roots: TaskNode[],
  nodeId: string,
  targetContextId: string | null,
): MoveNodeToContextResult | null {
  if (splitTransferBlockReason(roots, nodeId, targetContextId, "move")) return null;
  const { next, detached } = detachNodeById(roots, nodeId);
  if (!detached) return null;
  const siblings = getSiblingsList(next, targetContextId);
  return {
    roots: insertUnderParent(next, targetContextId, siblings.length, detached),
  };
}

function collectIdMap(source: TaskNode, clone: TaskNode): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (a: TaskNode, b: TaskNode) => {
    map.set(a.id, b.id);
    const n = Math.min(a.children.length, b.children.length);
    for (let i = 0; i < n; i++) {
      walk(a.children[i]!, b.children[i]!);
    }
  };
  walk(source, clone);
  return map;
}
