/**
 * Gruppierungs-Box im Canvas: visuelle Umrandung, die Karten zusammenfasst.
 * Karten, deren Mittelpunkt im Bereich der Box liegt, gelten als gruppiert.
 */
export interface CanvasGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Optionale Hintergrundfarbe (CSS-Klasse). */
  color?: string;
}

const GROUP_COLORS = [
  "bg-sky-50/60 border-sky-300",
  "bg-emerald-50/60 border-emerald-300",
  "bg-amber-50/60 border-amber-300",
  "bg-purple-50/60 border-purple-300",
  "bg-rose-50/60 border-rose-300",
  "bg-slate-50/60 border-slate-300",
] as const;

export type GroupColorId = (typeof GROUP_COLORS)[number];

export const CANVAS_GROUP_COLORS = GROUP_COLORS;

export function defaultGroupColor(index: number): string {
  return GROUP_COLORS[index % GROUP_COLORS.length]!;
}

/** Prüft ob die Karte komplett von der Gruppe umschlossen ist. */
export function isNodeInsideGroup(
  nodeX: number,
  nodeY: number,
  nodeW: number,
  nodeH: number,
  group: CanvasGroup,
): boolean {
  return (
    nodeX >= group.x &&
    nodeY >= group.y &&
    nodeX + nodeW <= group.x + group.width &&
    nodeY + nodeH <= group.y + group.height
  );
}
