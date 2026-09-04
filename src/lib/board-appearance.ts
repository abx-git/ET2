/** Configurable workspace chrome colors (persisted with the board) — same model as E2. */
export interface BoardAppearance {
  /** Canvas / Arbeitsbereich / Listen-Hintergrund. */
  canvas: string;
  /** Sidebars, docks, panels (solid). */
  sidebar: string;
}

/** ET2 default stays light; E2 presets remain available. */
export const DEFAULT_APPEARANCE: BoardAppearance = {
  canvas: "#e8ecf1",
  sidebar: "#f4f6f8",
};

export const APPEARANCE_PRESETS: { id: string; label: string; appearance: BoardAppearance }[] = [
  { id: "workshop", label: "Workshop hell", appearance: { canvas: "#e8ecf1", sidebar: "#f4f6f8" } },
  { id: "paper", label: "Papier", appearance: { canvas: "#f3efe6", sidebar: "#ebe4d6" } },
  { id: "kreide", label: "Kreide", appearance: { canvas: "#f7f8fa", sidebar: "#ffffff" } },
  { id: "moos", label: "Moos", appearance: { canvas: "#e4eee6", sidebar: "#eef5f0" } },
  { id: "waypoints", label: "Waypoints", appearance: { canvas: "#1a2330", sidebar: "#161e28" } },
  { id: "midnight", label: "Mitternacht", appearance: { canvas: "#0b1020", sidebar: "#121826" } },
  { id: "tinte", label: "Tinte", appearance: { canvas: "#1c1a2e", sidebar: "#161428" } },
  { id: "graphit", label: "Graphit", appearance: { canvas: "#2a2d32", sidebar: "#22252a" } },
];

export function normalizeAppearance(raw: unknown): BoardAppearance {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_APPEARANCE };
  const a = raw as Partial<BoardAppearance>;
  return {
    canvas: isHexColor(a.canvas) ? a.canvas : DEFAULT_APPEARANCE.canvas,
    sidebar: isHexColor(a.sidebar) ? a.sidebar : DEFAULT_APPEARANCE.sidebar,
  };
}

function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#([0-9a-fA-F]{6})$/.test(v);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(hex: string, toward: number, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (toward - r) * amount,
    g + (toward - g) * amount,
    b + (toward - b) * amount,
  );
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Hell/dunkel der Listenansicht — gleiche Schwelle wie die abgeleiteten Listen-Tokens. */
export function listSchemeFromAppearance(appearance: BoardAppearance): "light" | "dark" {
  return luminance(appearance.canvas) > 0.55 ? "light" : "dark";
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Derive CSS custom properties from canvas + sidebar picks. */
export function appearanceToCssVars(appearance: BoardAppearance): Record<string, string> {
  const sidebar = appearance.sidebar;
  const canvas = appearance.canvas;
  const lightUi = luminance(sidebar) > 0.55;
  const lightList = luminance(canvas) > 0.55;
  const { r, g, b } = hexToRgb(sidebar);
  const bg = mix(sidebar, lightUi ? 255 : 0, 0.18);
  const control = mix(sidebar, lightUi ? 0 : 255, lightUi ? 0.06 : 0.12);
  const controlHover = mix(sidebar, lightUi ? 0 : 255, lightUi ? 0.12 : 0.18);
  const text = lightUi ? "#1a2330" : "#e8eef4";
  const muted = lightUi ? "#5c6b7a" : "#8b9aab";
  const border = lightUi ? "rgba(30, 40, 55, 0.14)" : "rgba(70, 90, 110, 0.55)";

  const listText = lightList ? "#1a2330" : "#e8eef4";
  const listMuted = lightList ? "#5c6b7a" : "#93a1b1";
  const listCard = mix(canvas, 255, lightList ? 0.9 : 0.14);
  const listCardNested = mix(canvas, 255, lightList ? 0.58 : 0.08);
  const listHover = mix(canvas, lightList ? 0 : 255, lightList ? 0.07 : 0.14);
  const listHeader = mix(canvas, lightList ? 255 : 0, lightList ? 0.28 : 0.1);
  const listBorder = lightList ? "rgba(30, 40, 55, 0.14)" : "rgba(190, 210, 230, 0.2)";
  const listFocus = lightList ? "#38bdf8" : "#7dd3fc";
  const listCurrentBg = mix(listFocus, lightList ? 255 : 16, lightList ? 0.82 : 0.78);
  const listCurrentText = lightList ? "#0c4a6e" : "#e0f2fe";
  const listAddBg = mix(listFocus, lightList ? 255 : 16, lightList ? 0.86 : 0.82);
  const listAddText = lightList ? "#0369a1" : "#bae6fd";
  const listDrop = lightList ? "rgba(139, 92, 246, 0.16)" : "rgba(167, 139, 250, 0.28)";
  const listDropBorder = lightList ? "#a78bfa" : "#c4b5fd";
  const listTarget = lightList ? "#d97706" : "#fbbf24";
  const listTargetBg = mix(listTarget, lightList ? 255 : 16, lightList ? 0.88 : 0.78);
  const listTargetText = lightList ? "#92400e" : "#fef3c7";

  return {
    "--bg": bg,
    "--canvas": canvas,
    "--panel-solid": sidebar,
    "--panel": `rgba(${r}, ${g}, ${b}, 0.92)`,
    "--control": control,
    "--control-hover": controlHover,
    "--text": text,
    "--muted": muted,
    "--border": border,
    "--accent": "#0f766e",
    "--accent-2": "#ca8a04",
    "color-scheme": lightUi ? "light" : "dark",
    "--list-bg": canvas,
    "--list-header": listHeader,
    "--list-card": listCard,
    "--list-card-nested": listCardNested,
    "--list-hover": listHover,
    "--list-text": listText,
    "--list-muted": listMuted,
    "--list-border": listBorder,
    "--list-focus": listFocus,
    "--list-current-bg": listCurrentBg,
    "--list-current-text": listCurrentText,
    "--list-add-bg": listAddBg,
    "--list-add-text": listAddText,
    "--list-drop": listDrop,
    "--list-drop-border": listDropBorder,
    "--list-target": listTarget,
    "--list-target-bg": listTargetBg,
    "--list-target-text": listTargetText,
    "--list-target-ring": rgba(listTarget, 0.55),
    "--list-shadow": lightList
      ? "0 1px 2px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.06)"
      : "0 1px 3px rgba(0, 0, 0, 0.4), 0 4px 14px rgba(0, 0, 0, 0.28)",
    "--list-ring": rgba(listFocus, 0.55),
  };
}

export function applyAppearanceToElement(
  el: HTMLElement | null,
  appearance: BoardAppearance,
): void {
  if (!el) return;
  const vars = appearanceToCssVars(appearance);
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
}
