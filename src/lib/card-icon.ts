/** Vordefinierte Karten-Statusicons (feste Palette). */

export const CARD_ICON_IDS = [
  "info",
  "question",
  "warning",
  "idea",
  "decision",
  "important",
  "risk",
  "bug",
] as const;

export type CardIconId = (typeof CARD_ICON_IDS)[number];

export interface CardIconOption {
  id: CardIconId;
  label: string;
  /** Kurze Glyphe für kompakte Picker (z. B. „i“, „?“). */
  glyph: string;
  /** Tailwind-Klassen für Farbe des Badges. */
  toneClass: string;
}

export const CARD_ICON_OPTIONS: CardIconOption[] = [
  {
    id: "info",
    label: "Info",
    glyph: "i",
    toneClass: "text-sky-700 bg-sky-100 ring-sky-200",
  },
  {
    id: "question",
    label: "Frage",
    glyph: "?",
    toneClass: "text-violet-700 bg-violet-100 ring-violet-200",
  },
  {
    id: "warning",
    label: "Warnung",
    glyph: "!",
    toneClass: "text-amber-800 bg-amber-100 ring-amber-200",
  },
  {
    id: "idea",
    label: "Idee",
    glyph: "✦",
    toneClass: "text-yellow-800 bg-yellow-100 ring-yellow-200",
  },
  {
    id: "decision",
    label: "Entscheidung",
    glyph: "✓",
    toneClass: "text-emerald-700 bg-emerald-100 ring-emerald-200",
  },
  {
    id: "important",
    label: "Wichtig",
    glyph: "★",
    toneClass: "text-orange-700 bg-orange-100 ring-orange-200",
  },
  {
    id: "risk",
    label: "Risiko",
    glyph: "△",
    toneClass: "text-rose-700 bg-rose-100 ring-rose-200",
  },
  {
    id: "bug",
    label: "Fehler",
    glyph: "⚙",
    toneClass: "text-slate-700 bg-slate-200/80 ring-slate-300",
  },
];

const CARD_ICON_BY_ID = Object.fromEntries(
  CARD_ICON_OPTIONS.map((o) => [o.id, o]),
) as Record<CardIconId, CardIconOption>;

export function parseCardIcon(raw: unknown): CardIconId | undefined {
  if (typeof raw !== "string") return undefined;
  return CARD_ICON_IDS.includes(raw as CardIconId) ? (raw as CardIconId) : undefined;
}

export function cardIconOption(id: CardIconId | undefined): CardIconOption | null {
  if (!id) return null;
  return CARD_ICON_BY_ID[id] ?? null;
}

export function cardIconLabel(id: CardIconId): string {
  return CARD_ICON_BY_ID[id]?.label ?? id;
}
