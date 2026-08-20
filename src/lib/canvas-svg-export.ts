/**
 * Semantischer SVG-Export des Canvas: echte SVG-Primitiven (rect/path/text/line)
 * in ET2-Weltkoordinaten, plus eingebettetes draw.io-mxfile zum Weiterbearbeiten.
 */

import { APP_VERSION } from "@/lib/app-version";
import type { CanvasGroup } from "@/lib/canvas-group";
import { compareCanvasStackOrder } from "@/lib/canvas-stack";
import type { CardColorId } from "@/lib/card-color";
import { relationAnchors, taskCardRect, type ElementRect } from "@/lib/connector-geometry";
import { relationStroke } from "@/lib/task-relations";
import { DEFAULT_COMPLETED_TAG, isTaskMarkedDone, tagsWithoutCompletedTag } from "@/lib/task-tags";
import {
  isNoteNode,
  isSymbolNode,
  nodeDisplayTitle,
  noteMarkdownPreview,
} from "@/lib/tree-node-kind";
import type { TaskRelation } from "@/types/task-relation";
import { relationArrowLabel } from "@/types/task-relation";
import type { TaskNode } from "@/types/task-node";

const PAD = 40;
const BACKGROUND = "#edf0f4";
const FONT = "Arial, Helvetica, sans-serif";

export interface CanvasSvgScene {
  nodes: readonly TaskNode[];
  relations?: readonly TaskRelation[];
  groups?: readonly CanvasGroup[];
  completedTag?: string;
}

interface Palette {
  fill: string;
  stroke: string;
  accent: string;
}

const CARD_PALETTE: Record<CardColorId, Palette> = {
  sky: { fill: "#e0f2fe", stroke: "#7dd3fc", accent: "#0ea5e9" },
  emerald: { fill: "#d1fae5", stroke: "#6ee7b7", accent: "#10b981" },
  amber: { fill: "#fef3c7", stroke: "#fcd34d", accent: "#f59e0b" },
  rose: { fill: "#ffe4e6", stroke: "#fda4af", accent: "#f43f5e" },
  violet: { fill: "#ede9fe", stroke: "#c4b5fd", accent: "#8b5cf6" },
  cyan: { fill: "#cffafe", stroke: "#67e8f9", accent: "#06b6d4" },
  orange: { fill: "#ffedd5", stroke: "#fdba74", accent: "#f97316" },
  slate: { fill: "#f1f5f9", stroke: "#cbd5e1", accent: "#64748b" },
};

const DEFAULT_CARD: Palette = { fill: "#ffffff", stroke: "#e2e8f0", accent: "#cbd5e1" };
const NOTE_PALETTE: Palette = { fill: "#fefce8", stroke: "#fde68a", accent: "#facc15" };
const SYMBOL_FILL = "#f8fafc";
const SYMBOL_STROKE = "#334155";

const GROUP_PALETTE: Record<string, { fill: string; stroke: string }> = {
  "bg-sky-50/60 border-sky-300": { fill: "#f0f9ff", stroke: "#7dd3fc" },
  "bg-emerald-50/60 border-emerald-300": { fill: "#ecfdf5", stroke: "#6ee7b7" },
  "bg-amber-50/60 border-amber-300": { fill: "#fffbeb", stroke: "#fcd34d" },
  "bg-purple-50/60 border-purple-300": { fill: "#faf5ff", stroke: "#d8b4fe" },
  "bg-rose-50/60 border-rose-300": { fill: "#fff1f2", stroke: "#fda4af" },
  "bg-slate-50/60 border-slate-300": { fill: "#f8fafc", stroke: "#cbd5e1" },
};

function num(v: number): string {
  return String(Math.round(v * 100) / 100);
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlUnescape(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function htmlEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function nodePalette(node: TaskNode): Palette {
  if (isNoteNode(node)) return NOTE_PALETTE;
  if (node.cardColor && CARD_PALETTE[node.cardColor]) return CARD_PALETTE[node.cardColor];
  return DEFAULT_CARD;
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return [];
  const maxChars = Math.max(4, Math.floor(maxWidth / (fontSize * 0.55)));
  const words = trimmed.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function rotatedAabb(rect: ElementRect, rotation: number | undefined): ElementRect {
  if (!rotation) return rect;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners: Array<[number, number]> = [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y + rect.h],
    [rect.x, rect.y + rect.h],
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of corners) {
    const dx = px - cx;
    const dy = py - cy;
    const rx = cx + dx * cos - dy * sin;
    const ry = cy + dx * sin + dy * cos;
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function sceneBounds(scene: CanvasSvgScene): ElementRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const include = (x: number, y: number, w = 0, h = 0) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };

  for (const group of scene.groups ?? []) {
    include(group.x, group.y, group.width, group.height);
  }
  for (const node of scene.nodes) {
    const r = rotatedAabb(taskCardRect(node), node.rotation);
    include(r.x, r.y, r.w, r.h);
  }
  const byId = new Map(scene.nodes.map((n) => [n.id, n]));
  for (const rel of scene.relations ?? []) {
    const src = byId.get(rel.sourceId);
    const tgt = byId.get(rel.targetId);
    if (!src || !tgt) continue;
    const { start, end } = relationAnchors(src, tgt);
    include(start.x, start.y);
    include(end.x, end.y);
  }

  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, w: 400, h: 300 };
  }
  return {
    x: minX - PAD,
    y: minY - PAD,
    w: Math.max(1, maxX - minX + PAD * 2),
    h: Math.max(1, maxY - minY + PAD * 2),
  };
}

function rotateAttr(node: TaskNode, rect: ElementRect): string {
  if (!node.rotation) return "";
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return ` transform="rotate(${num(node.rotation)} ${num(cx)} ${num(cy)})"`;
}

function svgTextLines(
  lines: string[],
  x: number,
  y: number,
  fontSize: number,
  fill: string,
  opts?: { weight?: number; anchor?: "start" | "middle" },
): string {
  if (lines.length === 0) return "";
  const anchor = opts?.anchor ?? "start";
  const weight = opts?.weight ?? 400;
  const lineH = fontSize * 1.25;
  return lines
    .map((line, i) => {
      return `<text x="${num(x)}" y="${num(y + i * lineH)}" text-anchor="${anchor}" font-family="${FONT}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}">${xmlEscape(line)}</text>`;
    })
    .join("");
}

function renderCardOrNote(node: TaskNode, completedTag: string): string {
  const rect = taskCardRect(node);
  const pal = nodePalette(node);
  const note = isNoteNode(node);
  const done = !note && isTaskMarkedDone(node, completedTag);
  const opacity = done ? ` opacity="0.5"` : "";
  const title = node.title.trim() || (note ? "Notiz" : "Ohne Titel");
  const body = note
    ? noteMarkdownPreview(node.markdown, 240)
    : node.description.trim();
  const tags = note ? [] : tagsWithoutCompletedTag(node.tags, completedTag).slice(0, 4);
  const innerX = rect.x + 12;
  const innerW = rect.w - 24;
  const titleLines = wrapText(title, innerW, 13).slice(0, 3);
  const bodyLines = wrapText(body, innerW, 11).slice(0, 5);
  const tagLine = tags.length ? wrapText(tags.join(" · "), innerW, 10).slice(0, 1) : [];
  let cursorY = rect.y + 8 + 14 + 16;

  const titleSvg = svgTextLines(titleLines, innerX, cursorY, 13, "#0f172a", { weight: 600 });
  cursorY += titleLines.length * 16 + 6;
  const bodySvg = svgTextLines(bodyLines, innerX, cursorY, 11, "#64748b");
  cursorY += bodyLines.length * 14 + (tagLine.length ? 6 : 0);
  const tagSvg = svgTextLines(tagLine, innerX, cursorY, 10, "#0369a1");

  return `<g data-et2-id="${xmlEscape(node.id)}" data-et2-kind="${note ? "note" : "card"}"${rotateAttr(node, rect)}${opacity}>
  <rect x="${num(rect.x)}" y="${num(rect.y)}" width="${num(rect.w)}" height="${num(rect.h)}" rx="12" ry="12" fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1"/>
  <path d="M${num(rect.x + 12)} ${num(rect.y)} H${num(rect.x + rect.w - 12)} Q${num(rect.x + rect.w)} ${num(rect.y)} ${num(rect.x + rect.w)} ${num(rect.y + 12)} V${num(rect.y + 8)} H${num(rect.x)} V${num(rect.y + 12)} Q${num(rect.x)} ${num(rect.y)} ${num(rect.x + 12)} ${num(rect.y)} Z" fill="${pal.accent}"/>
  ${titleSvg}${bodySvg}${tagSvg}
</g>`;
}

function symbolGroup(rect: ElementRect, viewW: number, viewH: number, inner: string): string {
  return `<g transform="translate(${num(rect.x)} ${num(rect.y)}) scale(${num(rect.w / viewW)} ${num(rect.h / viewH)})" fill="${SYMBOL_FILL}" stroke="${SYMBOL_STROKE}" stroke-width="2" stroke-linejoin="round">${inner}</g>`;
}

function renderSymbolShape(node: TaskNode, rect: ElementRect): string {
  const type = node.symbolType ?? "process";
  if (type === "actor") {
    const vbW = 72;
    const vbH = 120;
    const scale = Math.min(rect.w / vbW, rect.h / vbH);
    const ox = rect.x + (rect.w - vbW * scale) / 2;
    const oy = rect.y;
    return `<g transform="translate(${num(ox)} ${num(oy)}) scale(${num(scale)})" stroke="${SYMBOL_STROKE}" stroke-width="2">
  <circle cx="36" cy="18" r="12" fill="${SYMBOL_FILL}"/>
  <line x1="36" y1="30" x2="36" y2="68" fill="none"/>
  <line x1="16" y1="48" x2="56" y2="48" fill="none"/>
  <line x1="36" y1="68" x2="18" y2="100" fill="none"/>
  <line x1="36" y1="68" x2="54" y2="100" fill="none"/>
</g>`;
  }
  if (type === "useCase") {
    return symbolGroup(rect, 160, 80, `<ellipse cx="80" cy="40" rx="76" ry="36"/>`);
  }
  if (type === "systemBoundary") {
    return symbolGroup(
      rect,
      360,
      280,
      `<rect x="4" y="4" width="352" height="272" fill="none" stroke-dasharray="8 5"/>`,
    );
  }
  if (type === "process") {
    return symbolGroup(rect, 160, 72, `<rect x="2" y="2" width="156" height="68" rx="10" ry="10"/>`);
  }
  if (type === "decision") {
    return symbolGroup(rect, 120, 120, `<polygon points="60,4 116,60 60,116 4,60"/>`);
  }
  if (type === "terminator") {
    return symbolGroup(rect, 120, 56, `<rect x="2" y="2" width="116" height="52" rx="26" ry="26"/>`);
  }
  return symbolGroup(
    rect,
    140,
    90,
    `<path d="M4 4 H136 V68 Q105 82 70 68 Q35 54 4 68 Z"/>`,
  );
}

function renderSymbol(node: TaskNode): string {
  const rect = taskCardRect(node);
  const type = node.symbolType ?? "process";
  const title = nodeDisplayTitle(node);
  const titleOnShape = type !== "actor";
  const innerW = rect.w - 16;
  const titleLines = wrapText(title, innerW, type === "actor" ? 11 : 12).slice(0, 3);
  const titleSvg = titleOnShape
    ? svgTextLines(
        titleLines,
        rect.x + rect.w / 2,
        type === "systemBoundary" ? rect.y + 22 : rect.y + rect.h / 2 - ((titleLines.length - 1) * 15) / 2,
        12,
        "#0f172a",
        { weight: 600, anchor: "middle" },
      )
    : svgTextLines(titleLines, rect.x + rect.w / 2, rect.y + rect.h - 6, 11, "#1e293b", {
        weight: 500,
        anchor: "middle",
      });

  return `<g data-et2-id="${xmlEscape(node.id)}" data-et2-kind="symbol" data-et2-symbol="${xmlEscape(type)}"${rotateAttr(node, rect)}>
  ${renderSymbolShape(node, rect)}
  ${titleSvg}
</g>`;
}

function renderGroup(group: CanvasGroup): string {
  const pal = GROUP_PALETTE[group.color ?? ""] ?? GROUP_PALETTE["bg-slate-50/60 border-slate-300"]!;
  const labelY = group.y + 18;
  return `<g data-et2-id="${xmlEscape(group.id)}" data-et2-kind="group">
  <rect x="${num(group.x)}" y="${num(group.y)}" width="${num(group.width)}" height="${num(group.height)}" rx="8" ry="8" fill="${pal.fill}" fill-opacity="0.6" stroke="${pal.stroke}" stroke-width="2" stroke-dasharray="6 4"/>
  ${svgTextLines(wrapText(group.label || "Gruppe", group.width - 16, 12).slice(0, 1), group.x + 10, labelY, 12, "#475569", { weight: 600 })}
</g>`;
}

function markerId(color: string): string {
  return `et2-arrow-${color.replace("#", "")}`;
}

function renderRelation(rel: TaskRelation, src: TaskNode, tgt: TaskNode): string {
  const { start, end } = relationAnchors(src, tgt);
  const stroke = relationStroke(rel.type);
  const label = relationArrowLabel(rel);
  const dash = stroke.dashed ? ` stroke-dasharray="6 4"` : "";
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const labelSvg = label
    ? svgTextLines([label], midX, midY - 8, 10, "#64748b", { anchor: "middle" })
    : "";
  return `<g data-et2-id="${xmlEscape(rel.id)}" data-et2-kind="relation">
  <line x1="${num(start.x)}" y1="${num(start.y)}" x2="${num(end.x)}" y2="${num(end.y)}" stroke="${stroke.color}" stroke-width="2"${dash} marker-end="url(#${markerId(stroke.color)})"/>
  ${labelSvg}
</g>`;
}

function mxStyle(parts: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(parts)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? `${k}=1` : `${k}=${v}`))
    .join(";");
}

function mxCellId(raw: string, prefix: string, used: Set<string>): string {
  const cleaned = `${prefix}${raw.replace(/[^A-Za-z0-9._-]/g, "_")}` || `${prefix}x`;
  let id = cleaned;
  let n = 2;
  while (used.has(id)) {
    id = `${cleaned}_${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function clamp01(v: number): string {
  return num(Math.min(1, Math.max(0, v)));
}

function symbolMxStyle(node: TaskNode): string {
  const type = node.symbolType ?? "process";
  const common = {
    whiteSpace: "wrap",
    html: true,
    fillColor: SYMBOL_FILL,
    strokeColor: SYMBOL_STROKE,
    strokeWidth: 2,
    fontFamily: "Arial",
    fontSize: 12,
    fontStyle: 1,
    fontColor: "#0f172a",
  };
  if (type === "useCase") return mxStyle({ ellipse: true, ...common });
  if (type === "decision") return mxStyle({ rhombus: true, ...common });
  if (type === "terminator") {
    return mxStyle({ rounded: true, arcSize: 50, ...common });
  }
  if (type === "document") return mxStyle({ shape: "document", ...common });
  if (type === "actor") {
    return mxStyle({
      shape: "umlActor",
      verticalLabelPosition: "bottom",
      verticalAlign: "top",
      outlineConnect: 0,
      ...common,
      fillColor: "#ffffff",
    });
  }
  if (type === "systemBoundary") {
    return mxStyle({
      ...common,
      rounded: 0,
      dashed: true,
      dashPattern: "8 5",
      fillColor: "none",
      verticalAlign: "top",
    });
  }
  return mxStyle({ rounded: true, arcSize: 14, absoluteArcSize: 1, ...common });
}

function cardMxStyle(node: TaskNode): string {
  const pal = nodePalette(node);
  return mxStyle({
    rounded: true,
    arcSize: 12,
    absoluteArcSize: 1,
    whiteSpace: "wrap",
    html: true,
    fillColor: pal.fill,
    strokeColor: pal.stroke,
    fontFamily: "Arial",
    fontSize: 12,
    fontColor: "#0f172a",
    align: "left",
    verticalAlign: "top",
    spacingLeft: 10,
    spacingTop: 8,
    spacingRight: 8,
    spacingBottom: 8,
  });
}

function cardMxValue(node: TaskNode, completedTag: string): string {
  const title = htmlEscape(node.title.trim() || (isNoteNode(node) ? "Notiz" : "Ohne Titel"));
  const parts = [`<b>${title}</b>`];
  if (isNoteNode(node)) {
    const md = node.markdown?.trim();
    if (md) parts.push(htmlEscape(noteMarkdownPreview(md, 400)));
  } else {
    if (node.description.trim()) parts.push(htmlEscape(node.description.trim()));
    const tags = tagsWithoutCompletedTag(node.tags, completedTag);
    if (tags.length) parts.push(`<font color="#0369a1">${htmlEscape(tags.join(" · "))}</font>`);
  }
  return parts.join("<br>");
}

function buildDrawioMxfile(scene: CanvasSvgScene, bounds: ElementRect): string {
  const completedTag = scene.completedTag ?? DEFAULT_COMPLETED_TAG;
  const relations = scene.relations ?? [];
  const used = new Set(["0", "1"]);
  const nodeIds = new Map<string, string>();
  const cells: string[] = [
    `<mxCell id="0"/>`,
    `<mxCell id="1" parent="0"/>`,
  ];

  for (const group of scene.groups ?? []) {
    const id = mxCellId(group.id, "g_", used);
    const pal = GROUP_PALETTE[group.color ?? ""] ?? GROUP_PALETTE["bg-slate-50/60 border-slate-300"]!;
    const style = mxStyle({
      rounded: true,
      arcSize: 8,
      absoluteArcSize: 1,
      whiteSpace: "wrap",
      html: true,
      dashed: true,
      dashPattern: "6 4",
      fillColor: pal.fill,
      fillOpacity: 60,
      strokeColor: pal.stroke,
      strokeWidth: 2,
      verticalAlign: "top",
      align: "left",
      fontFamily: "Arial",
      fontSize: 12,
      fontColor: "#475569",
      fontStyle: 1,
    });
    cells.push(
      `<mxCell id="${xmlEscape(id)}" value="${xmlEscape(htmlEscape(group.label || "Gruppe"))}" style="${style}" vertex="1" parent="1"><mxGeometry x="${num(group.x)}" y="${num(group.y)}" width="${num(group.width)}" height="${num(group.height)}" as="geometry"/></mxCell>`,
    );
  }

  const stacked = [...scene.nodes].sort(compareCanvasStackOrder);
  for (const node of stacked) {
    const id = mxCellId(node.id, "n_", used);
    nodeIds.set(node.id, id);
    const rect = taskCardRect(node);
    const rotation = node.rotation ? `;rotation=${num(node.rotation)}` : "";
    if (isSymbolNode(node)) {
      const style = `${symbolMxStyle(node)}${rotation}`;
      cells.push(
        `<mxCell id="${xmlEscape(id)}" value="${xmlEscape(htmlEscape(nodeDisplayTitle(node)))}" style="${style}" vertex="1" parent="1"><mxGeometry x="${num(rect.x)}" y="${num(rect.y)}" width="${num(rect.w)}" height="${num(rect.h)}" as="geometry"/></mxCell>`,
      );
    } else {
      const style = `${cardMxStyle(node)}${rotation}`;
      cells.push(
        `<mxCell id="${xmlEscape(id)}" value="${xmlEscape(cardMxValue(node, completedTag))}" style="${style}" vertex="1" parent="1"><mxGeometry x="${num(rect.x)}" y="${num(rect.y)}" width="${num(rect.w)}" height="${num(rect.h)}" as="geometry"/></mxCell>`,
      );
    }
  }

  const byId = new Map(scene.nodes.map((n) => [n.id, n]));
  for (const rel of relations) {
    const src = byId.get(rel.sourceId);
    const tgt = byId.get(rel.targetId);
    const srcId = nodeIds.get(rel.sourceId);
    const tgtId = nodeIds.get(rel.targetId);
    if (!src || !tgt || !srcId || !tgtId) continue;
    const { start, end } = relationAnchors(src, tgt);
    const sr = taskCardRect(src);
    const tr = taskCardRect(tgt);
    const stroke = relationStroke(rel.type);
    const label = relationArrowLabel(rel);
    const id = mxCellId(rel.id, "e_", used);
    const style = mxStyle({
      endArrow: "block",
      endFill: true,
      html: true,
      strokeWidth: 2,
      strokeColor: stroke.color,
      dashed: stroke.dashed,
      dashPattern: stroke.dashed ? "6 4" : undefined,
      exitX: clamp01((start.x - sr.x) / Math.max(1, sr.w)),
      exitY: clamp01((start.y - sr.y) / Math.max(1, sr.h)),
      entryX: clamp01((end.x - tr.x) / Math.max(1, tr.w)),
      entryY: clamp01((end.y - tr.y) / Math.max(1, tr.h)),
      fontFamily: "Arial",
      fontSize: 10,
      fontColor: "#64748b",
    });
    cells.push(
      `<mxCell id="${xmlEscape(id)}" value="${xmlEscape(htmlEscape(label))}" style="${style}" edge="1" parent="1" source="${xmlEscape(srcId)}" target="${xmlEscape(tgtId)}"><mxGeometry relative="1" as="geometry"/></mxCell>`,
    );
  }

  const pageW = Math.max(1, Math.round(bounds.x + bounds.w));
  const pageH = Math.max(1, Math.round(bounds.y + bounds.h));
  return `<mxfile host="ET2" agent="ET2 ${APP_VERSION}" type="device"><diagram id="et2-canvas" name="Canvas"><mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageW}" pageHeight="${pageH}" math="0" shadow="0"><root>${cells.join("")}</root></mxGraphModel></diagram></mxfile>`;
}

function defsForRelations(relations: readonly TaskRelation[]): string {
  const colors = new Set<string>();
  for (const rel of relations) colors.add(relationStroke(rel.type).color);
  if (colors.size === 0) colors.add("#64748b");
  const markers = [...colors].map((color) => {
    return `<marker id="${markerId(color)}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, 10 3.5, 0 7" fill="${color}"/></marker>`;
  });
  return `<defs>${markers.join("")}</defs>`;
}

/** Baut SVG-Syntax (keine foreignObject/HTML-Klone) mit ET2-Layout und draw.io-Modell. */
export function buildCanvasSvg(scene: CanvasSvgScene): string {
  const completedTag = scene.completedTag ?? DEFAULT_COMPLETED_TAG;
  const bounds = sceneBounds(scene);
  const byId = new Map(scene.nodes.map((n) => [n.id, n]));
  const stacked = [...scene.nodes].sort(compareCanvasStackOrder);

  const groupsSvg = (scene.groups ?? []).map(renderGroup).join("");
  const nodesSvg = stacked
    .map((node) => (isSymbolNode(node) ? renderSymbol(node) : renderCardOrNote(node, completedTag)))
    .join("");
  const relations = scene.relations ?? [];
  const relationsSvg = relations
    .map((rel) => {
      const src = byId.get(rel.sourceId);
      const tgt = byId.get(rel.targetId);
      if (!src || !tgt) return "";
      return renderRelation(rel, src, tgt);
    })
    .join("");

  const mxfile = buildDrawioMxfile({ ...scene, relations }, bounds);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${num(bounds.w)}" height="${num(bounds.h)}" viewBox="${num(bounds.x)} ${num(bounds.y)} ${num(bounds.w)} ${num(bounds.h)}" content="${xmlEscape(mxfile)}">
${defsForRelations(relations)}
<rect x="${num(bounds.x)}" y="${num(bounds.y)}" width="${num(bounds.w)}" height="${num(bounds.h)}" fill="${BACKGROUND}"/>
${groupsSvg}
${nodesSvg}
${relationsSvg}
</svg>
`;
}

/** Liest das eingebettete draw.io-mxfile aus einem von ET2 erzeugten SVG. */
export function extractDrawioMxfileFromSvg(svg: string): string | null {
  const match = svg.match(/\scontent="([^"]*)"/);
  if (!match?.[1]) return null;
  return xmlUnescape(match[1]);
}
