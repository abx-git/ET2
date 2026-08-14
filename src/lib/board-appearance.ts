/** Configurable workspace chrome colors (persisted with the board) — same model as E2. */
export interface BoardAppearance {
  /** Canvas / Arbeitsbereich background. */
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
  { id: "waypoints", label: "Waypoints", appearance: { canvas: "#1a2330", sidebar: "#161e28" } },
  { id: "midnight", label: "Mitternacht", appearance: { canvas: "#0b1020", sidebar: "#121826" } },
  { id: "workshop", label: "Workshop hell", appearance: { canvas: "#e8ecf1", sidebar: "#f4f6f8" } },
  { id: "paper", label: "Papier", appearance: { canvas: "#f3efe6", sidebar: "#ebe4d6" } },
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

/** Derive CSS custom properties from canvas + sidebar picks. */
export function appearanceToCssVars(appearance: BoardAppearance): Record<string, string> {
  const sidebar = appearance.sidebar;
  const canvas = appearance.canvas;
  const lightUi = luminance(sidebar) > 0.55;
  const { r, g, b } = hexToRgb(sidebar);
  const bg = mix(sidebar, lightUi ? 255 : 0, 0.18);
  const control = mix(sidebar, lightUi ? 0 : 255, lightUi ? 0.06 : 0.12);
  const controlHover = mix(sidebar, lightUi ? 0 : 255, lightUi ? 0.12 : 0.18);
  const text = lightUi ? "#1a2330" : "#e8eef4";
  const muted = lightUi ? "#5c6b7a" : "#8b9aab";
  const border = lightUi ? "rgba(30, 40, 55, 0.14)" : "rgba(70, 90, 110, 0.55)";

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
