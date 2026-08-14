/** Abhängigkeit zwischen Geschwister-Karten auf derselben Hierarchie-Ebene. */
export type TaskRelationType = "temporal" | "organizational" | "other";

export interface TaskRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: TaskRelationType;
  label?: string;
}

export const TASK_RELATION_TYPES: TaskRelationType[] = [
  "temporal",
  "organizational",
  "other",
];

export function isTaskRelationType(value: unknown): value is TaskRelationType {
  return value === "temporal" || value === "organizational" || value === "other";
}

export const TASK_RELATION_TYPE_LABELS: Record<TaskRelationType, string> = {
  temporal: "Zeitlich",
  organizational: "Organisatorisch",
  other: "Sonstiges",
};
