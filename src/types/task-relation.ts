/**
 * Abhängigkeit zwischen Geschwister-Karten auf derselben Hierarchie-Ebene.
 *
 * Richtung: Quelle → Ziel (Pfeilspitze am Ziel).
 */
export type TaskRelationType =
  /** Neutraler Pfeil ohne semantischen Typ (Default beim Verbinden). */
  | "untyped"
  /** Quelle liegt zeitlich / in der Reihenfolge vor dem Ziel. */
  | "precedes"
  /** Quelle benötigt das Ziel (Voraussetzung). */
  | "requires"
  /** Quelle blockiert das Ziel. */
  | "blocks"
  /** Quelle liefert Information an das Ziel. */
  | "informs"
  /** Quelle weist Verantwortung / Aufgabe dem Ziel zu. */
  | "assigns"
  /** Quelle unterstützt das Ziel. */
  | "supports";

export interface TaskRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: TaskRelationType;
  label?: string;
}

export const TASK_RELATION_TYPES: TaskRelationType[] = [
  "untyped",
  "precedes",
  "requires",
  "blocks",
  "informs",
  "assigns",
  "supports",
];

const TASK_RELATION_TYPE_SET = new Set<string>(TASK_RELATION_TYPES);

/** Ältere Board-Dateien (vor Typ-Überarbeitung). */
const LEGACY_RELATION_TYPE_MAP: Record<string, TaskRelationType> = {
  temporal: "precedes",
  organizational: "assigns",
  other: "untyped",
};

export function normalizeTaskRelationType(value: unknown): TaskRelationType | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (TASK_RELATION_TYPE_SET.has(raw)) return raw as TaskRelationType;
  return LEGACY_RELATION_TYPE_MAP[raw] ?? null;
}

export function isTaskRelationType(value: unknown): value is TaskRelationType {
  return normalizeTaskRelationType(value) !== null;
}

export const TASK_RELATION_TYPE_LABELS: Record<TaskRelationType, string> = {
  untyped: "Ohne Typ",
  precedes: "geht voraus",
  requires: "benötigt",
  blocks: "blockiert",
  informs: "informiert",
  assigns: "weist zu",
  supports: "unterstützt",
};

/** Kurztext am Pfeil: eigene Beschriftung, sonst Typ — außer „Ohne Typ“. */
export function relationArrowLabel(relation: Pick<TaskRelation, "type" | "label">): string {
  const custom = relation.label?.trim();
  if (custom) return custom;
  if (relation.type === "untyped") return "";
  return TASK_RELATION_TYPE_LABELS[relation.type];
}
