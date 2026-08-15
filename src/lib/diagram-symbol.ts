/**
 * Canvas-only Ablaufplan- / Use-Case-Symbole (`kind: "symbol"`).
 * Erscheinen nicht in Liste, Outline oder Suche.
 */

export const SYMBOL_TYPES = [
  "actor",
  "useCase",
  "systemBoundary",
  "process",
  "decision",
  "terminator",
  "document",
] as const;

export type SymbolType = (typeof SYMBOL_TYPES)[number];

export type SymbolGroup = "useCase" | "flowchart";

export interface SymbolTypeDefinition {
  id: SymbolType;
  group: SymbolGroup;
  label: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultTitle: string;
}

export const SYMBOL_TYPE_DEFINITIONS: Record<SymbolType, SymbolTypeDefinition> = {
  actor: {
    id: "actor",
    group: "useCase",
    label: "Akteur",
    defaultWidth: 72,
    defaultHeight: 120,
    defaultTitle: "Akteur",
  },
  useCase: {
    id: "useCase",
    group: "useCase",
    label: "Use Case",
    defaultWidth: 160,
    defaultHeight: 80,
    defaultTitle: "Use Case",
  },
  systemBoundary: {
    id: "systemBoundary",
    group: "useCase",
    label: "Systemgrenze",
    defaultWidth: 360,
    defaultHeight: 280,
    defaultTitle: "System",
  },
  process: {
    id: "process",
    group: "flowchart",
    label: "Prozess",
    defaultWidth: 160,
    defaultHeight: 72,
    defaultTitle: "Prozess",
  },
  decision: {
    id: "decision",
    group: "flowchart",
    label: "Entscheidung",
    defaultWidth: 120,
    defaultHeight: 120,
    defaultTitle: "?",
  },
  terminator: {
    id: "terminator",
    group: "flowchart",
    label: "Start / Ende",
    defaultWidth: 120,
    defaultHeight: 56,
    defaultTitle: "Start",
  },
  document: {
    id: "document",
    group: "flowchart",
    label: "Dokument",
    defaultWidth: 140,
    defaultHeight: 90,
    defaultTitle: "Dokument",
  },
};

export const SYMBOL_GROUP_LABELS: Record<SymbolGroup, string> = {
  useCase: "Use Case",
  flowchart: "Flowchart",
};

export function isSymbolType(value: unknown): value is SymbolType {
  return typeof value === "string" && (SYMBOL_TYPES as readonly string[]).includes(value);
}

export function parseSymbolType(value: unknown): SymbolType | undefined {
  return isSymbolType(value) ? value : undefined;
}

export function getSymbolTypeDefinition(type: SymbolType): SymbolTypeDefinition {
  return SYMBOL_TYPE_DEFINITIONS[type];
}

export function listSymbolTypesByGroup(group: SymbolGroup): SymbolTypeDefinition[] {
  return SYMBOL_TYPES.map((id) => SYMBOL_TYPE_DEFINITIONS[id]).filter((d) => d.group === group);
}

export function defaultSymbolSize(type: SymbolType): { width: number; height: number } {
  const d = SYMBOL_TYPE_DEFINITIONS[type];
  return { width: d.defaultWidth, height: d.defaultHeight };
}

/** Standard-Stapelebene: Systemgrenzen hinten, übrige Symbole darüber. */
export function defaultSymbolZIndex(type: SymbolType): number {
  return type === "systemBoundary" ? 0 : 10;
}
