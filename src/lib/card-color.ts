/** Vordefinierte Kartenfarben (Tailwind-Klassen). */

export const CARD_COLOR_IDS = [
  "sky",
  "emerald",
  "amber",
  "rose",
  "violet",
  "cyan",
  "orange",
  "slate",
] as const;

export type CardColorId = (typeof CARD_COLOR_IDS)[number];
export type CardColorScheme = "light" | "dark";

/** Listen-Tokens, die auf einer farbigen Karte --list-text/--list-muted überschreiben. */
export type CardColorListInk = {
  text: string;
  muted: string;
  card: string;
  hover: string;
  border: string;
};

export interface CardColorOption {
  id: CardColorId;
  label: string;
  /** Vorschau-Swatch im Editor / Kontextmenü */
  swatchClass: string;
  /** Kartenhintergrund im hellen Schema */
  cardClass: string;
  /** Kartenhintergrund im dunklen Listenschema */
  cardClassDark: string;
  /** Linke Akzentleiste — bleibt auch bei Statusfarben sichtbar */
  accentBarClass: string;
  listInk: { light: CardColorListInk; dark: CardColorListInk };
}

export const CARD_COLOR_OPTIONS: CardColorOption[] = [
  {
    id: "sky",
    label: "Blau",
    swatchClass: "bg-sky-400",
    cardClass: "bg-sky-100",
    cardClassDark: "bg-sky-950",
    accentBarClass: "bg-sky-500",
    listInk: {
      light: { text: "#0c4a6e", muted: "#0369a1", card: "#e0f2fe", hover: "#bae6fd", border: "rgba(14, 165, 233, 0.45)" },
      dark: { text: "#f0f9ff", muted: "#bae6fd", card: "#075985", hover: "#0369a1", border: "rgba(56, 189, 248, 0.4)" },
    },
  },
  {
    id: "emerald",
    label: "Grün",
    swatchClass: "bg-emerald-400",
    cardClass: "bg-emerald-100",
    cardClassDark: "bg-emerald-950",
    accentBarClass: "bg-emerald-500",
    listInk: {
      light: { text: "#064e3b", muted: "#047857", card: "#d1fae5", hover: "#a7f3d0", border: "rgba(16, 185, 129, 0.45)" },
      dark: { text: "#ecfdf5", muted: "#a7f3d0", card: "#065f46", hover: "#047857", border: "rgba(52, 211, 153, 0.4)" },
    },
  },
  {
    id: "amber",
    label: "Gelb",
    swatchClass: "bg-amber-400",
    cardClass: "bg-amber-100",
    cardClassDark: "bg-amber-950",
    accentBarClass: "bg-amber-500",
    listInk: {
      light: { text: "#78350f", muted: "#b45309", card: "#fef3c7", hover: "#fde68a", border: "rgba(245, 158, 11, 0.5)" },
      dark: { text: "#fffbeb", muted: "#fde68a", card: "#92400e", hover: "#b45309", border: "rgba(251, 191, 36, 0.4)" },
    },
  },
  {
    id: "rose",
    label: "Rot",
    swatchClass: "bg-rose-400",
    cardClass: "bg-rose-100",
    cardClassDark: "bg-rose-950",
    accentBarClass: "bg-rose-500",
    listInk: {
      light: { text: "#4c0519", muted: "#9f1239", card: "#ffe4e6", hover: "#fecdd3", border: "rgba(244, 63, 94, 0.45)" },
      dark: { text: "#fff1f2", muted: "#fecdd3", card: "#9f1239", hover: "#be123c", border: "rgba(251, 113, 133, 0.45)" },
    },
  },
  {
    id: "violet",
    label: "Violett",
    swatchClass: "bg-violet-400",
    cardClass: "bg-violet-100",
    cardClassDark: "bg-violet-950",
    accentBarClass: "bg-violet-500",
    listInk: {
      light: { text: "#2e1065", muted: "#6d28d9", card: "#ede9fe", hover: "#ddd6fe", border: "rgba(139, 92, 246, 0.45)" },
      dark: { text: "#f5f3ff", muted: "#ddd6fe", card: "#5b21b6", hover: "#6d28d9", border: "rgba(167, 139, 250, 0.45)" },
    },
  },
  {
    id: "cyan",
    label: "Türkis",
    swatchClass: "bg-cyan-400",
    cardClass: "bg-cyan-100",
    cardClassDark: "bg-cyan-950",
    accentBarClass: "bg-cyan-500",
    listInk: {
      light: { text: "#164e63", muted: "#0e7490", card: "#cffafe", hover: "#a5f3fc", border: "rgba(6, 182, 212, 0.45)" },
      dark: { text: "#ecfeff", muted: "#a5f3fc", card: "#155e75", hover: "#0e7490", border: "rgba(34, 211, 238, 0.4)" },
    },
  },
  {
    id: "orange",
    label: "Orange",
    swatchClass: "bg-orange-400",
    cardClass: "bg-orange-100",
    cardClassDark: "bg-orange-950",
    accentBarClass: "bg-orange-500",
    listInk: {
      light: { text: "#7c2d12", muted: "#c2410c", card: "#ffedd5", hover: "#fed7aa", border: "rgba(249, 115, 22, 0.5)" },
      dark: { text: "#fff7ed", muted: "#fed7aa", card: "#9a3412", hover: "#c2410c", border: "rgba(251, 146, 60, 0.45)" },
    },
  },
  {
    id: "slate",
    label: "Grau",
    swatchClass: "bg-slate-400",
    cardClass: "bg-slate-100",
    cardClassDark: "bg-slate-800",
    accentBarClass: "bg-slate-500",
    listInk: {
      light: { text: "#0f172a", muted: "#475569", card: "#f1f5f9", hover: "#e2e8f0", border: "rgba(100, 116, 139, 0.45)" },
      dark: { text: "#f8fafc", muted: "#cbd5e1", card: "#334155", hover: "#475569", border: "rgba(148, 163, 184, 0.4)" },
    },
  },
];

const CARD_COLOR_BY_ID = Object.fromEntries(
  CARD_COLOR_OPTIONS.map((o) => [o.id, o]),
) as Record<CardColorId, CardColorOption>;

export function parseCardColor(raw: unknown): CardColorId | undefined {
  if (typeof raw !== "string") return undefined;
  return CARD_COLOR_IDS.includes(raw as CardColorId) ? (raw as CardColorId) : undefined;
}

export function cardColorClass(
  color: CardColorId | undefined,
  scheme: CardColorScheme = "light",
): string | null {
  if (!color) return null;
  const opt = CARD_COLOR_BY_ID[color];
  if (!opt) return null;
  return scheme === "dark" ? opt.cardClassDark : opt.cardClass;
}

export function cardColorAccentClass(color: CardColorId | undefined): string | null {
  if (!color) return null;
  return CARD_COLOR_BY_ID[color]?.accentBarClass ?? null;
}

/** Überschreibt Listen-Text-/Rahmen-Tokens auf einer farbigen Karte. */
export function cardColorCssVars(
  color: CardColorId | undefined,
  scheme: CardColorScheme = "light",
): Record<string, string> | undefined {
  if (!color) return undefined;
  const ink = CARD_COLOR_BY_ID[color]?.listInk[scheme];
  if (!ink) return undefined;
  return {
    "--list-text": ink.text,
    "--list-muted": ink.muted,
    "--list-card": ink.card,
    "--list-hover": ink.hover,
    "--list-border": ink.border,
  };
}
