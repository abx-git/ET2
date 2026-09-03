/** Akzentfarbe für Markdown-Notizen (Chrome, nicht Kartenfarbe). */

import type { CardColorScheme } from "@/lib/card-color";

export const NOTE_ACCENT_IDS = [
  "steel",
  "slate",
  "sky",
  "cyan",
  "emerald",
  "amber",
  "rose",
  "violet",
] as const;

export type NoteAccentId = (typeof NOTE_ACCENT_IDS)[number];

/** Standard: dunkles Blaugrau. */
export const DEFAULT_NOTE_ACCENT: NoteAccentId = "steel";

/** Listen-Tokens, die auf einer Notiz --list-text/--list-muted überschreiben. */
export type NoteAccentInk = {
  text: string;
  muted: string;
  link: string;
  card: string;
  hover: string;
  border: string;
};

export interface NoteAccentClasses {
  id: NoteAccentId;
  label: string;
  swatchClass: string;
  /** Kartenhintergrund (ohne Rahmen) */
  cardClass: string;
  cardClassNested: string;
  nestDrop: string;
  keyboardRing: string;
  accentBar: string;
  icon: string;
  listButton: string;
  outlineIcon: string;
  outlineNest: string;
  editorRing: string;
  editorPrimary: string;
  markdownBlockquote: string;
  markdownCode: string;
  markdownHr: string;
  markdownLink: string;
}

interface NoteAccentOption {
  id: NoteAccentId;
  label: string;
  swatchClass: string;
  accentHex: string;
  accentBar: string;
  editorRing: string;
  editorPrimary: string;
  keyboardRing: string;
  cardClass: string;
  cardClassDark: string;
  cardClassNested: string;
  cardClassNestedDark: string;
  icon: { light: string; dark: string };
  outlineIcon: { light: string; dark: string };
  nestDrop: { light: string; dark: string };
  listButton: { light: string; dark: string };
  outlineNest: { light: string; dark: string };
  markdownBlockquote: { light: string; dark: string };
  markdownCode: { light: string; dark: string };
  markdownHr: { light: string; dark: string };
  ink: { light: NoteAccentInk; dark: NoteAccentInk };
}

const NOTE_ACCENT_OPTIONS_RAW: NoteAccentOption[] = [
  {
    id: "steel",
    label: "Blaugrau",
    swatchClass: "bg-slate-600",
    accentHex: "#475569",
    accentBar: "bg-slate-600",
    editorRing: "ring-slate-500/30",
    editorPrimary: "bg-slate-700 hover:bg-slate-800",
    keyboardRing: "ring-2 ring-slate-400/80",
    cardClass: "bg-slate-50",
    cardClassDark: "bg-slate-700",
    cardClassNested: "bg-slate-100",
    cardClassNestedDark: "bg-slate-800",
    icon: { light: "text-slate-700", dark: "text-slate-200" },
    outlineIcon: { light: "text-slate-600", dark: "text-slate-300" },
    nestDrop: {
      light: "bg-slate-200 ring-2 ring-slate-400/70",
      dark: "bg-slate-600 ring-2 ring-slate-300/50",
    },
    listButton: {
      light: "bg-slate-200/90 px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-300/80",
      dark: "bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-600",
    },
    outlineNest: {
      light: "bg-slate-100 ring-1 ring-slate-400",
      dark: "bg-slate-700/80 ring-1 ring-slate-400",
    },
    markdownBlockquote: { light: "border-slate-400", dark: "border-slate-400" },
    markdownCode: {
      light: "bg-slate-200 text-slate-900",
      dark: "bg-slate-900/70 text-slate-100",
    },
    markdownHr: { light: "border-slate-300", dark: "border-slate-500" },
    ink: {
      light: {
        text: "#0f172a",
        muted: "#334155",
        link: "#0369a1",
        card: "#f8fafc",
        hover: "#e2e8f0",
        border: "rgba(71, 85, 105, 0.35)",
      },
      dark: {
        text: "#f8fafc",
        muted: "#cbd5e1",
        link: "#7dd3fc",
        card: "#334155",
        hover: "#475569",
        border: "rgba(148, 163, 184, 0.4)",
      },
    },
  },
  {
    id: "slate",
    label: "Grau",
    swatchClass: "bg-slate-400",
    accentHex: "#64748b",
    accentBar: "bg-slate-500",
    editorRing: "ring-slate-500/30",
    editorPrimary: "bg-slate-600 hover:bg-slate-700",
    keyboardRing: "ring-2 ring-slate-300/90",
    cardClass: "bg-white",
    cardClassDark: "bg-slate-800",
    cardClassNested: "bg-slate-50",
    cardClassNestedDark: "bg-slate-900",
    icon: { light: "text-slate-600", dark: "text-slate-200" },
    outlineIcon: { light: "text-slate-500", dark: "text-slate-300" },
    nestDrop: {
      light: "bg-slate-100 ring-2 ring-slate-300/70",
      dark: "bg-slate-700 ring-2 ring-slate-400/50",
    },
    listButton: {
      light: "bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200",
      dark: "bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-600",
    },
    outlineNest: {
      light: "bg-slate-50 ring-1 ring-slate-300",
      dark: "bg-slate-800 ring-1 ring-slate-500",
    },
    markdownBlockquote: { light: "border-slate-300", dark: "border-slate-500" },
    markdownCode: {
      light: "bg-slate-100 text-slate-900",
      dark: "bg-slate-900/80 text-slate-100",
    },
    markdownHr: { light: "border-slate-200", dark: "border-slate-600" },
    ink: {
      light: {
        text: "#0f172a",
        muted: "#334155",
        link: "#0369a1",
        card: "#ffffff",
        hover: "#f1f5f9",
        border: "rgba(100, 116, 139, 0.35)",
      },
      dark: {
        text: "#f8fafc",
        muted: "#cbd5e1",
        link: "#7dd3fc",
        card: "#1e293b",
        hover: "#334155",
        border: "rgba(148, 163, 184, 0.4)",
      },
    },
  },
  {
    id: "sky",
    label: "Blau",
    swatchClass: "bg-sky-500",
    accentHex: "#0ea5e9",
    accentBar: "bg-sky-500",
    editorRing: "ring-sky-500/30",
    editorPrimary: "bg-sky-600 hover:bg-sky-700",
    keyboardRing: "ring-2 ring-sky-300/90",
    cardClass: "bg-sky-100",
    cardClassDark: "bg-sky-950",
    cardClassNested: "bg-sky-50",
    cardClassNestedDark: "bg-sky-900",
    icon: { light: "text-sky-800", dark: "text-sky-200" },
    outlineIcon: { light: "text-sky-600", dark: "text-sky-300" },
    nestDrop: {
      light: "bg-sky-200/80 ring-2 ring-sky-400/70",
      dark: "bg-sky-800 ring-2 ring-sky-400/50",
    },
    listButton: {
      light: "bg-sky-100 px-2.5 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-200",
      dark: "bg-sky-800 px-2.5 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-700",
    },
    outlineNest: {
      light: "bg-sky-50 ring-1 ring-sky-300",
      dark: "bg-sky-900 ring-1 ring-sky-500",
    },
    markdownBlockquote: { light: "border-sky-400", dark: "border-sky-500" },
    markdownCode: {
      light: "bg-sky-200/80 text-sky-950",
      dark: "bg-sky-900/80 text-sky-100",
    },
    markdownHr: { light: "border-sky-200", dark: "border-sky-700" },
    ink: {
      light: {
        text: "#0c4a6e",
        muted: "#075985",
        link: "#0369a1",
        card: "#e0f2fe",
        hover: "#bae6fd",
        border: "rgba(14, 165, 233, 0.4)",
      },
      dark: {
        text: "#f0f9ff",
        muted: "#bae6fd",
        link: "#7dd3fc",
        card: "#082f49",
        hover: "#075985",
        border: "rgba(56, 189, 248, 0.4)",
      },
    },
  },
  {
    id: "cyan",
    label: "Türkis",
    swatchClass: "bg-cyan-500",
    accentHex: "#06b6d4",
    accentBar: "bg-cyan-500",
    editorRing: "ring-cyan-500/30",
    editorPrimary: "bg-cyan-600 hover:bg-cyan-700",
    keyboardRing: "ring-2 ring-cyan-300/90",
    cardClass: "bg-cyan-100",
    cardClassDark: "bg-cyan-950",
    cardClassNested: "bg-cyan-50",
    cardClassNestedDark: "bg-cyan-900",
    icon: { light: "text-cyan-800", dark: "text-cyan-200" },
    outlineIcon: { light: "text-cyan-600", dark: "text-cyan-300" },
    nestDrop: {
      light: "bg-cyan-200/80 ring-2 ring-cyan-400/70",
      dark: "bg-cyan-800 ring-2 ring-cyan-400/50",
    },
    listButton: {
      light: "bg-cyan-100 px-2.5 py-1.5 text-xs font-medium text-cyan-900 hover:bg-cyan-200",
      dark: "bg-cyan-800 px-2.5 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-700",
    },
    outlineNest: {
      light: "bg-cyan-50 ring-1 ring-cyan-300",
      dark: "bg-cyan-900 ring-1 ring-cyan-500",
    },
    markdownBlockquote: { light: "border-cyan-400", dark: "border-cyan-500" },
    markdownCode: {
      light: "bg-cyan-200/80 text-cyan-950",
      dark: "bg-cyan-900/80 text-cyan-100",
    },
    markdownHr: { light: "border-cyan-200", dark: "border-cyan-700" },
    ink: {
      light: {
        text: "#164e63",
        muted: "#0e7490",
        link: "#0e7490",
        card: "#cffafe",
        hover: "#a5f3fc",
        border: "rgba(6, 182, 212, 0.4)",
      },
      dark: {
        text: "#ecfeff",
        muted: "#a5f3fc",
        link: "#67e8f9",
        card: "#164e63",
        hover: "#155e75",
        border: "rgba(34, 211, 238, 0.4)",
      },
    },
  },
  {
    id: "emerald",
    label: "Grün",
    swatchClass: "bg-emerald-500",
    accentHex: "#10b981",
    accentBar: "bg-emerald-500",
    editorRing: "ring-emerald-500/30",
    editorPrimary: "bg-emerald-600 hover:bg-emerald-700",
    keyboardRing: "ring-2 ring-emerald-300/90",
    cardClass: "bg-emerald-100",
    cardClassDark: "bg-emerald-950",
    cardClassNested: "bg-emerald-50",
    cardClassNestedDark: "bg-emerald-900",
    icon: { light: "text-emerald-800", dark: "text-emerald-200" },
    outlineIcon: { light: "text-emerald-600", dark: "text-emerald-300" },
    nestDrop: {
      light: "bg-emerald-200/80 ring-2 ring-emerald-400/70",
      dark: "bg-emerald-800 ring-2 ring-emerald-400/50",
    },
    listButton: {
      light: "bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-200",
      dark: "bg-emerald-800 px-2.5 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-700",
    },
    outlineNest: {
      light: "bg-emerald-50 ring-1 ring-emerald-300",
      dark: "bg-emerald-900 ring-1 ring-emerald-500",
    },
    markdownBlockquote: { light: "border-emerald-400", dark: "border-emerald-500" },
    markdownCode: {
      light: "bg-emerald-200/80 text-emerald-950",
      dark: "bg-emerald-900/80 text-emerald-100",
    },
    markdownHr: { light: "border-emerald-200", dark: "border-emerald-700" },
    ink: {
      light: {
        text: "#064e3b",
        muted: "#047857",
        link: "#047857",
        card: "#d1fae5",
        hover: "#a7f3d0",
        border: "rgba(16, 185, 129, 0.4)",
      },
      dark: {
        text: "#ecfdf5",
        muted: "#a7f3d0",
        link: "#6ee7b7",
        card: "#064e3b",
        hover: "#065f46",
        border: "rgba(52, 211, 153, 0.4)",
      },
    },
  },
  {
    id: "amber",
    label: "Gelb",
    swatchClass: "bg-amber-500",
    accentHex: "#f59e0b",
    accentBar: "bg-amber-500",
    editorRing: "ring-amber-500/30",
    editorPrimary: "bg-amber-600 hover:bg-amber-700",
    keyboardRing: "ring-2 ring-amber-300/90",
    cardClass: "bg-amber-100",
    cardClassDark: "bg-amber-950",
    cardClassNested: "bg-amber-50",
    cardClassNestedDark: "bg-amber-900",
    icon: { light: "text-amber-900", dark: "text-amber-100" },
    outlineIcon: { light: "text-amber-700", dark: "text-amber-300" },
    nestDrop: {
      light: "bg-amber-200/80 ring-2 ring-amber-400/70",
      dark: "bg-amber-800 ring-2 ring-amber-400/50",
    },
    listButton: {
      light: "bg-amber-100 px-2.5 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-200",
      dark: "bg-amber-800 px-2.5 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-700",
    },
    outlineNest: {
      light: "bg-amber-50 ring-1 ring-amber-300",
      dark: "bg-amber-900 ring-1 ring-amber-500",
    },
    markdownBlockquote: { light: "border-amber-400", dark: "border-amber-500" },
    markdownCode: {
      light: "bg-amber-200/90 text-amber-950",
      dark: "bg-amber-900/80 text-amber-100",
    },
    markdownHr: { light: "border-amber-200", dark: "border-amber-700" },
    ink: {
      light: {
        text: "#78350f",
        muted: "#92400e",
        link: "#b45309",
        card: "#fef3c7",
        hover: "#fde68a",
        border: "rgba(245, 158, 11, 0.45)",
      },
      dark: {
        text: "#fffbeb",
        muted: "#fde68a",
        link: "#fcd34d",
        card: "#78350f",
        hover: "#92400e",
        border: "rgba(251, 191, 36, 0.4)",
      },
    },
  },
  {
    id: "rose",
    label: "Rot",
    swatchClass: "bg-rose-500",
    accentHex: "#f43f5e",
    accentBar: "bg-rose-500",
    editorRing: "ring-rose-500/30",
    editorPrimary: "bg-rose-600 hover:bg-rose-700",
    keyboardRing: "ring-2 ring-rose-300/90",
    cardClass: "bg-rose-100",
    cardClassDark: "bg-rose-950",
    cardClassNested: "bg-rose-50",
    cardClassNestedDark: "bg-rose-900",
    icon: { light: "text-rose-800", dark: "text-rose-100" },
    outlineIcon: { light: "text-rose-600", dark: "text-rose-300" },
    nestDrop: {
      light: "bg-rose-200/80 ring-2 ring-rose-400/70",
      dark: "bg-rose-800 ring-2 ring-rose-400/50",
    },
    listButton: {
      light: "bg-rose-100 px-2.5 py-1.5 text-xs font-medium text-rose-900 hover:bg-rose-200",
      dark: "bg-rose-800 px-2.5 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-700",
    },
    outlineNest: {
      light: "bg-rose-50 ring-1 ring-rose-300",
      dark: "bg-rose-900 ring-1 ring-rose-500",
    },
    markdownBlockquote: { light: "border-rose-400", dark: "border-rose-500" },
    markdownCode: {
      light: "bg-rose-200/80 text-rose-950",
      dark: "bg-rose-900/80 text-rose-100",
    },
    markdownHr: { light: "border-rose-200", dark: "border-rose-700" },
    ink: {
      light: {
        text: "#881337",
        muted: "#9f1239",
        link: "#be123c",
        card: "#ffe4e6",
        hover: "#fecdd3",
        border: "rgba(244, 63, 94, 0.4)",
      },
      dark: {
        text: "#fff1f2",
        muted: "#fecdd3",
        link: "#fda4af",
        card: "#881337",
        hover: "#9f1239",
        border: "rgba(251, 113, 133, 0.45)",
      },
    },
  },
  {
    id: "violet",
    label: "Violett",
    swatchClass: "bg-violet-400",
    accentHex: "#8b5cf6",
    accentBar: "bg-violet-500",
    editorRing: "ring-violet-500/30",
    editorPrimary: "bg-violet-600 hover:bg-violet-700",
    keyboardRing: "ring-2 ring-violet-300/90",
    cardClass: "bg-violet-100",
    cardClassDark: "bg-violet-950",
    cardClassNested: "bg-violet-50",
    cardClassNestedDark: "bg-violet-900",
    icon: { light: "text-violet-800", dark: "text-violet-200" },
    outlineIcon: { light: "text-violet-600", dark: "text-violet-300" },
    nestDrop: {
      light: "bg-violet-200/80 ring-2 ring-violet-400/70",
      dark: "bg-violet-800 ring-2 ring-violet-400/50",
    },
    listButton: {
      light: "bg-violet-100 px-2.5 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-200",
      dark: "bg-violet-800 px-2.5 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-700",
    },
    outlineNest: {
      light: "bg-violet-50 ring-1 ring-violet-300",
      dark: "bg-violet-900 ring-1 ring-violet-500",
    },
    markdownBlockquote: { light: "border-violet-400", dark: "border-violet-500" },
    markdownCode: {
      light: "bg-violet-200/80 text-violet-950",
      dark: "bg-violet-900/80 text-violet-100",
    },
    markdownHr: { light: "border-violet-200", dark: "border-violet-700" },
    ink: {
      light: {
        text: "#4c1d95",
        muted: "#6d28d9",
        link: "#6d28d9",
        card: "#ede9fe",
        hover: "#ddd6fe",
        border: "rgba(139, 92, 246, 0.4)",
      },
      dark: {
        text: "#f5f3ff",
        muted: "#ddd6fe",
        link: "#c4b5fd",
        card: "#4c1d95",
        hover: "#5b21b6",
        border: "rgba(167, 139, 250, 0.45)",
      },
    },
  },
];

export const NOTE_ACCENT_OPTIONS: NoteAccentClasses[] = NOTE_ACCENT_OPTIONS_RAW.map((opt) =>
  resolveAccent(opt, "light"),
);

const BY_ID = Object.fromEntries(NOTE_ACCENT_OPTIONS_RAW.map((o) => [o.id, o])) as Record<
  NoteAccentId,
  NoteAccentOption
>;

function resolveAccent(opt: NoteAccentOption, scheme: CardColorScheme): NoteAccentClasses {
  const dark = scheme === "dark";
  return {
    id: opt.id,
    label: opt.label,
    swatchClass: opt.swatchClass,
    cardClass: dark ? opt.cardClassDark : opt.cardClass,
    cardClassNested: dark ? opt.cardClassNestedDark : opt.cardClassNested,
    nestDrop: opt.nestDrop[scheme],
    keyboardRing: opt.keyboardRing,
    accentBar: opt.accentBar,
    icon: opt.icon[scheme],
    listButton: opt.listButton[scheme],
    outlineIcon: opt.outlineIcon[scheme],
    outlineNest: opt.outlineNest[scheme],
    editorRing: opt.editorRing,
    editorPrimary: opt.editorPrimary,
    markdownBlockquote: opt.markdownBlockquote[scheme],
    markdownCode: opt.markdownCode[scheme],
    markdownHr: opt.markdownHr[scheme],
    markdownLink: dark ? "text-sky-300 hover:text-sky-200" : "text-sky-800 hover:text-sky-950",
  };
}

export function parseNoteAccent(raw: unknown): NoteAccentId {
  if (typeof raw === "string" && NOTE_ACCENT_IDS.includes(raw as NoteAccentId)) {
    return raw as NoteAccentId;
  }
  return DEFAULT_NOTE_ACCENT;
}

export function noteAccentClasses(
  id: NoteAccentId | undefined,
  scheme: CardColorScheme = "light",
): NoteAccentClasses {
  const opt = BY_ID[id ?? DEFAULT_NOTE_ACCENT] ?? BY_ID[DEFAULT_NOTE_ACCENT];
  return resolveAccent(opt, scheme);
}

/** Überschreibt Listen-Text-/Rahmen-Tokens auf einer Notiz. */
export function noteAccentCssVars(
  id: NoteAccentId | undefined,
  scheme: CardColorScheme = "light",
): Record<string, string> {
  const opt = BY_ID[id ?? DEFAULT_NOTE_ACCENT] ?? BY_ID[DEFAULT_NOTE_ACCENT];
  const ink = opt.ink[scheme];
  return {
    "--list-text": ink.text,
    "--list-muted": ink.muted,
    "--list-card": ink.card,
    "--list-hover": ink.hover,
    "--list-border": ink.border,
    "--note-link": ink.link,
  };
}

/** SVG/Export-Palette (helles Papier, unabhängig vom Board-Schema). */
export function noteAccentPalette(id: NoteAccentId | undefined): {
  fill: string;
  accent: string;
  text: string;
  muted: string;
} {
  const opt = BY_ID[id ?? DEFAULT_NOTE_ACCENT] ?? BY_ID[DEFAULT_NOTE_ACCENT];
  const ink = opt.ink.light;
  return { fill: ink.card, accent: opt.accentHex, text: ink.text, muted: ink.muted };
}
