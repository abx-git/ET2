import { defaultSymbolSize, isSymbolType } from "@/lib/diagram-symbol";
import type { TreeNodeKind } from "@/lib/tree-node-kind";

/**
 * Extension Point für Kartentypen (analog E2-Modi).
 * Phase 1: `card`, `note`; Ablaufplan-Symbole über `kind: "symbol"` + `symbolType`.
 */
export interface CardTypeDefinition {
  id: TreeNodeKind | string;
  label: string;
  defaultWidth: number;
  defaultHeight: number;
  /** Felder, die der Editor typischerweise anbietet (Dokumentation / spätere UI). */
  editableFields: readonly string[];
  /** Wo der Typ in der UI angeboten wird. Symbole: nur Canvas. */
  listVisibleIn?: "all" | "canvas";
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
    listVisibleIn: "all",
  },
  note: {
    id: "note",
    label: "Notiz",
    defaultWidth: 240,
    defaultHeight: 160,
    editableFields: ["title", "markdown"],
    listVisibleIn: "all",
  },
  symbol: {
    id: "symbol",
    label: "Symbol",
    defaultWidth: 160,
    defaultHeight: 80,
    editableFields: ["title", "symbolType"],
    listVisibleIn: "canvas",
  },
};

export function getCardTypeDefinition(kind: string | undefined): CardTypeDefinition {
  if (kind === "note") return REGISTRY.note!;
  if (kind === "symbol") return REGISTRY.symbol!;
  return REGISTRY.card!;
}

export function listCardTypeDefinitions(): CardTypeDefinition[] {
  return Object.values(REGISTRY);
}

/** Neue Typen später hier registrieren — Store/Canvas lesen nur über diese API. */
export function registerCardType(def: CardTypeDefinition): void {
  REGISTRY[def.id] = def;
}

export function defaultCardSize(
  kind: string | undefined,
  symbolType?: string,
): { width: number; height: number } {
  if (kind === "symbol" && isSymbolType(symbolType)) {
    return defaultSymbolSize(symbolType);
  }
  const d = getCardTypeDefinition(kind);
  return { width: d.defaultWidth, height: d.defaultHeight };
}
