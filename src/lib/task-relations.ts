import { isTaskRelationType, type TaskRelation, type TaskRelationType } from "@/types/task-relation";
import { findDirectParentId, findNodeById } from "@/lib/tree-utils";
import type { TaskNode } from "@/types/task-node";
import { generateUniqueTaskIdFromTaken } from "@/lib/task-id";

export function createRelationId(existing: TaskRelation[]): string {
  const taken = new Set(existing.map((r) => r.id));
  // reuse Lox-style uniqueness without requiring a forest
  return generateUniqueTaskIdFromTaken(taken);
}

export function parseTaskRelation(raw: unknown, path: string): TaskRelation {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${path}: Objekt erwartet`);
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) throw new Error(`${path}.id erwartet`);
  if (typeof o.sourceId !== "string" || !o.sourceId.trim()) throw new Error(`${path}.sourceId erwartet`);
  if (typeof o.targetId !== "string" || !o.targetId.trim()) throw new Error(`${path}.targetId erwartet`);
  if (!isTaskRelationType(o.type)) throw new Error(`${path}.type ungültig`);
  if (o.label !== undefined && typeof o.label !== "string") throw new Error(`${path}.label erwartet`);
  return {
    id: o.id.trim(),
    sourceId: o.sourceId.trim(),
    targetId: o.targetId.trim(),
    type: o.type,
    ...(typeof o.label === "string" && o.label.trim() ? { label: o.label.trim() } : {}),
  };
}

export function parseTaskRelations(raw: unknown): TaskRelation[] {
  if (!Array.isArray(raw)) return [];
  const out: TaskRelation[] = [];
  for (let i = 0; i < raw.length; i++) {
    try {
      out.push(parseTaskRelation(raw[i], `relations[${i}]`));
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

/** Behält nur Kanten, deren Endpunkte noch existieren und Geschwister sind. */
export function sanitizeRelations(roots: TaskNode[], relations: TaskRelation[] | undefined | null): TaskRelation[] {
  const byId = new Map<string, TaskNode>();
  function walk(nodes: TaskNode[]) {
    for (const n of nodes) {
      byId.set(n.id, n);
      walk(n.children);
    }
  }
  walk(roots);

  return (relations ?? []).filter((rel) => {
    if (rel.sourceId === rel.targetId) return false;
    if (!byId.has(rel.sourceId) || !byId.has(rel.targetId)) return false;
    const sp = findDirectParentId(roots, rel.sourceId);
    const tp = findDirectParentId(roots, rel.targetId);
    // Both must be under same parent (including both roots → parent null)
    if (sp === undefined || tp === undefined) return false;
    return sp === tp;
  });
}

export function relationsForContext(
  relations: TaskRelation[],
  contextNodeIds: Set<string>,
): TaskRelation[] {
  return relations.filter(
    (r) => contextNodeIds.has(r.sourceId) && contextNodeIds.has(r.targetId),
  );
}

export function canConnectSiblings(
  roots: TaskNode[],
  sourceId: string,
  targetId: string,
): boolean {
  if (sourceId === targetId) return false;
  if (!findNodeById(roots, sourceId) || !findNodeById(roots, targetId)) return false;
  const sp = findDirectParentId(roots, sourceId);
  const tp = findDirectParentId(roots, targetId);
  return sp !== undefined && tp !== undefined && sp === tp;
}

export function relationStroke(type: TaskRelationType): { color: string; dashed?: boolean } {
  switch (type) {
    case "temporal":
      return { color: "#0f766e" };
    case "organizational":
      return { color: "#1d4ed8", dashed: true };
    default:
      return { color: "#64748b" };
  }
}
