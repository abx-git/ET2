/**
 * Visueller Gruppierungsrahmen auf dem Canvas (kein Baum-Elternteil).
 * Mitgliedschaft ist räumlich: Karten, die vollständig im Rahmen liegen,
 * werden beim Verschieben des Rahmens mitgenommen.
 */

import { taskCardRect } from "@/lib/connector-geometry";
import type { TaskNode } from "@/types/task-node";

export interface CanvasGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Palette-ID (sky, emerald, …). Ältere Dateien können noch CSS-Klassen speichern. */
  color?: string;
}

export const GROUP_COLOR_IDS = [
  "sky",
  "emerald",
  "amber",
  "violet",
  "rose",
  "slate",
] as const;

export type GroupColorId = (typeof GROUP_COLOR_IDS)[number];
export type GroupColorScheme = "light" | "dark";
export type GroupResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface GroupColorPaint {
  fill: string;
  stroke: string;
  label: string;
}

export interface GroupColorOption {
  id: GroupColorId;
  label: string;
  swatchClass: string;
  light: GroupColorPaint;
  dark: GroupColorPaint;
  /** Helle Exportfarben (SVG / draw.io). */
  export: { fill: string; stroke: string };
}

export const GROUP_COLOR_OPTIONS: GroupColorOption[] = [
  {
    id: "sky",
    label: "Blau",
    swatchClass: "bg-sky-400",
    light: { fill: "rgba(186, 230, 253, 0.42)", stroke: "#38bdf8", label: "#0c4a6e" },
    dark: { fill: "rgba(7, 89, 133, 0.42)", stroke: "#38bdf8", label: "#e0f2fe" },
    export: { fill: "#e0f2fe", stroke: "#38bdf8" },
  },
  {
    id: "emerald",
    label: "Grün",
    swatchClass: "bg-emerald-400",
    light: { fill: "rgba(167, 243, 208, 0.42)", stroke: "#34d399", label: "#064e3b" },
    dark: { fill: "rgba(6, 95, 70, 0.42)", stroke: "#34d399", label: "#d1fae5" },
    export: { fill: "#ecfdf5", stroke: "#34d399" },
  },
  {
    id: "amber",
    label: "Gelb",
    swatchClass: "bg-amber-400",
    light: { fill: "rgba(253, 230, 138, 0.45)", stroke: "#fbbf24", label: "#78350f" },
    dark: { fill: "rgba(146, 64, 14, 0.42)", stroke: "#fbbf24", label: "#fef3c7" },
    export: { fill: "#fffbeb", stroke: "#fbbf24" },
  },
  {
    id: "violet",
    label: "Violett",
    swatchClass: "bg-violet-400",
    light: { fill: "rgba(221, 214, 254, 0.45)", stroke: "#a78bfa", label: "#5b21b6" },
    dark: { fill: "rgba(76, 29, 149, 0.42)", stroke: "#a78bfa", label: "#ede9fe" },
    export: { fill: "#f5f3ff", stroke: "#a78bfa" },
  },
  {
    id: "rose",
    label: "Rot",
    swatchClass: "bg-rose-400",
    light: { fill: "rgba(254, 205, 211, 0.45)", stroke: "#fb7185", label: "#9f1239" },
    dark: { fill: "rgba(159, 18, 57, 0.42)", stroke: "#fb7185", label: "#ffe4e6" },
    export: { fill: "#fff1f2", stroke: "#fb7185" },
  },
  {
    id: "slate",
    label: "Grau",
    swatchClass: "bg-slate-400",
    light: { fill: "rgba(226, 232, 240, 0.5)", stroke: "#94a3b8", label: "#334155" },
    dark: { fill: "rgba(51, 65, 85, 0.45)", stroke: "#94a3b8", label: "#e2e8f0" },
    export: { fill: "#f8fafc", stroke: "#94a3b8" },
  },
];

export const GROUP_COLOR_BY_ID = Object.fromEntries(
  GROUP_COLOR_OPTIONS.map((o) => [o.id, o]),
) as Record<GroupColorId, GroupColorOption>;

/** @deprecated Nutze GROUP_COLOR_IDS. Bleibt für alte Importe/Aufrufer. */
export const CANVAS_GROUP_COLORS = GROUP_COLOR_IDS;

const LEGACY_GROUP_COLOR: Record<string, GroupColorId> = {
  "bg-sky-50/60 border-sky-300": "sky",
  "bg-emerald-50/60 border-emerald-300": "emerald",
  "bg-amber-50/60 border-amber-300": "amber",
  "bg-purple-50/60 border-purple-300": "violet",
  "bg-violet-50/60 border-violet-300": "violet",
  "bg-rose-50/60 border-rose-300": "rose",
  "bg-slate-50/60 border-slate-300": "slate",
};

export const MIN_GROUP_WIDTH = 160;
export const MIN_GROUP_HEIGHT = 100;
export const GROUP_FIT_PADDING = 20;
export const GROUP_HEADER_HEIGHT = 28;
export const DEFAULT_GROUP_WIDTH = 400;
export const DEFAULT_GROUP_HEIGHT = 300;

export function parseGroupColor(raw: unknown): GroupColorId | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  if (GROUP_COLOR_IDS.includes(raw as GroupColorId)) return raw as GroupColorId;
  return LEGACY_GROUP_COLOR[raw];
}

export function defaultGroupColor(index: number): GroupColorId {
  return GROUP_COLOR_IDS[index % GROUP_COLOR_IDS.length]!;
}

export function groupColorPaint(
  color: string | undefined,
  scheme: GroupColorScheme = "light",
): GroupColorPaint {
  const id = parseGroupColor(color) ?? "slate";
  const opt = GROUP_COLOR_BY_ID[id];
  return scheme === "dark" ? opt.dark : opt.light;
}

export function groupColorExport(color: string | undefined): { fill: string; stroke: string } {
  const id = parseGroupColor(color) ?? "slate";
  return GROUP_COLOR_BY_ID[id].export;
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

/** IDs der Karten, die vollständig in der Gruppe liegen (Mitgliedschaft beim Drag-Start). */
export function containedNodeIds(nodes: ReadonlyArray<TaskNode>, group: CanvasGroup): string[] {
  return nodes
    .filter((n) => {
      const r = taskCardRect(n);
      return isNodeInsideGroup(r.x, r.y, r.w, r.h, group);
    })
    .map((n) => n.id);
}

export function groupRectAroundNodes(
  nodes: ReadonlyArray<TaskNode>,
  padding = GROUP_FIT_PADDING,
  header = GROUP_HEADER_HEIGHT,
): { x: number; y: number; width: number; height: number } | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const r = taskCardRect(n);
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  if (!Number.isFinite(minX)) return null;
  const width = Math.max(MIN_GROUP_WIDTH, maxX - minX + padding * 2);
  const height = Math.max(MIN_GROUP_HEIGHT, maxY - minY + padding * 2 + header);
  return {
    x: minX - padding,
    y: minY - padding - header,
    width,
    height,
  };
}

/** Rahmen um aktuelle Mitglieder legen. `null` wenn die Gruppe leer ist. */
export function fitGroupToContents(
  group: CanvasGroup,
  nodes: ReadonlyArray<TaskNode>,
): { x: number; y: number; width: number; height: number } | null {
  const memberIds = new Set(containedNodeIds(nodes, group));
  return groupRectAroundNodes(nodes.filter((n) => memberIds.has(n.id)));
}

export function resizedGroupRect(
  orig: { x: number; y: number; width: number; height: number },
  handle: GroupResizeHandle,
  dx: number,
  dy: number,
): { x: number; y: number; width: number; height: number } {
  let x = orig.x;
  let y = orig.y;
  let width = orig.width;
  let height = orig.height;
  if (handle.includes("e")) width = Math.max(MIN_GROUP_WIDTH, orig.width + dx);
  if (handle.includes("s")) height = Math.max(MIN_GROUP_HEIGHT, orig.height + dy);
  if (handle.includes("w")) {
    const nextWidth = Math.max(MIN_GROUP_WIDTH, orig.width - dx);
    x = orig.x + (orig.width - nextWidth);
    width = nextWidth;
  }
  if (handle.includes("n")) {
    const nextHeight = Math.max(MIN_GROUP_HEIGHT, orig.height - dy);
    y = orig.y + (orig.height - nextHeight);
    height = nextHeight;
  }
  return { x, y, width, height };
}

export function parseCanvasGroup(raw: unknown): CanvasGroup | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  const x = Number(o.x);
  const y = Number(o.y);
  const width = Number(o.width);
  const height = Number(o.height);
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
  if (width <= 0 || height <= 0) return null;
  const label = typeof o.label === "string" ? o.label : "";
  const color = parseGroupColor(o.color);
  return {
    id: o.id.trim(),
    label,
    x,
    y,
    width,
    height,
    ...(color ? { color } : { color: "slate" as GroupColorId }),
  };
}

export function parseCanvasGroupsMap(raw: unknown): Record<string, CanvasGroup[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, CanvasGroup[]> = {};
  for (const [key, list] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== "string" || !key) continue;
    if (!Array.isArray(list)) continue;
    const groups: CanvasGroup[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const g = parseCanvasGroup(item);
      if (!g || seen.has(g.id)) continue;
      seen.add(g.id);
      groups.push(g);
    }
    if (groups.length) out[key] = groups;
  }
  return out;
}

export function serializeCanvasGroupsMap(
  groups: Record<string, CanvasGroup[]>,
): Record<string, CanvasGroup[]> {
  const parsed = parseCanvasGroupsMap(groups);
  const out: Record<string, CanvasGroup[]> = {};
  for (const key of Object.keys(parsed).sort()) {
    out[key] = parsed[key]!.map((g) => ({
      id: g.id,
      label: g.label,
      x: g.x,
      y: g.y,
      width: g.width,
      height: g.height,
      color: parseGroupColor(g.color) ?? "slate",
    }));
  }
  return out;
}
