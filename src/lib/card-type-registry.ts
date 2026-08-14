import type { TreeNodeKind } from "@/lib/tree-node-kind";

/**
 * Extension Point für spätere Kartentypen (analog E2-Modi).
 * Phase 1 registriert nur `card` und `note`.
 */
export interface CardTypeDefinition {
  id: TreeNodeKind | string;
  label: string;
  defaultWidth: number;
  defaultHeight: number;
  /** Felder, die der Editor typischerweise anbietet (Dokumentation / spätere UI). */
  editableFields: readonly string[];
}

const REGISTRY: Record<string, CardTypeDefinition> = {
  card: {
    id: "card",
    label: "Karte",
    defaultWidth: 220,
    defaultHeight: 120,
    editableFields: [
      "title",
      "description",
      "tags",
      "dueDate",
      "reminderDate",
      "effort",
      "link",
      "command",
      "cardColor",
    ],
  },
  note: {
    id: "note",
    label: "Notiz",
    defaultWidth: 240,
    defaultHeight: 160,
    editableFields: ["title", "markdown"],
  },
};

export function getCardTypeDefinition(kind: string | undefined): CardTypeDefinition {
  const key = kind === "note" ? "note" : "card";
  return REGISTRY[key] ?? REGISTRY.card!;
}

export function listCardTypeDefinitions(): CardTypeDefinition[] {
  return Object.values(REGISTRY);
}

/** Neue Typen später hier registrieren — Store/Canvas lesen nur über diese API. */
export function registerCardType(def: CardTypeDefinition): void {
  REGISTRY[def.id] = def;
}

export function defaultCardSize(kind: string | undefined): { width: number; height: number } {
  const d = getCardTypeDefinition(kind);
  return { width: d.defaultWidth, height: d.defaultHeight };
}
