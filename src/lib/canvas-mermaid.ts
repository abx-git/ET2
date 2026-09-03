/**
 * Mermaid-Import/-Export für die Canvas-Ebene.
 *
 * Flowchart/Graph → Karten, Ablaufplan-Symbole, Pfeile, Gruppen (subgraph).
 * Mindmap → verschachtelte Karten.
 */

import { generateUniqueTaskIdFromTaken } from "@/lib/task-id";
import { defaultCardSize } from "@/lib/card-type-registry";
import { groupRectAroundNodes, type CanvasGroup } from "@/lib/canvas-group";
import { ensureForestCanvasLayout } from "@/lib/canvas-layout";
import { isSymbolType, type SymbolType } from "@/lib/diagram-symbol";
import {
  createBlankCardNode,
  createBlankNoteNode,
  createBlankSymbolNode,
  isNoteNode,
  isSymbolNode,
  nodeDisplayTitle,
} from "@/lib/tree-node-kind";
import type { TaskNode } from "@/types/task-node";
import {
  TASK_RELATION_TYPE_LABELS,
  type TaskRelation,
  type TaskRelationType,
} from "@/types/task-relation";

export type MermaidDiagramKind = "flowchart" | "mindmap";
export type MermaidDirection = "TD" | "LR";

export interface MermaidCanvasImport {
  kind: MermaidDiagramKind;
  direction: MermaidDirection;
  nodes: TaskNode[];
  relations: Array<Pick<TaskRelation, "sourceId" | "targetId" | "type" | "label">>;
  groups: Array<Pick<CanvasGroup, "label" | "x" | "y" | "width" | "height"> & { memberIds: string[] }>;
}

type MermaidShape =
  | "bare"
  | "rect"
  | "round"
  | "stadium"
  | "circle"
  | "diamond"
  | "hexagon"
  | "subroutine"
  | "cylinder"
  | "parallelogram"
  | "asymmetric";

interface ParsedNode {
  id: string;
  label: string;
  shape: MermaidShape;
  classes: Set<string>;
}

interface ParsedEdge {
  source: string;
  target: string;
  style: "arrow" | "dotted" | "thick" | "cross";
  label: string;
}

interface ParsedSubgraph {
  id: string;
  title: string;
  memberIds: string[];
}

const FLOWCHART_HEADER =
  /^(?:flowchart(?:-elk)?|graph)(?:\s+(TD|TB|BT|LR|RL))?/i;
const MINDMAP_HEADER = /^mindmap\b/i;

const CLASS_KIND: Record<string, { kind: "card" | "note" | "symbol"; symbolType?: SymbolType }> = {
  "et2-card": { kind: "card" },
  "et2-note": { kind: "note" },
  "et2-symbol-process": { kind: "symbol", symbolType: "process" },
  "et2-symbol-decision": { kind: "symbol", symbolType: "decision" },
  "et2-symbol-terminator": { kind: "symbol", symbolType: "terminator" },
  "et2-symbol-document": { kind: "symbol", symbolType: "document" },
  "et2-symbol-actor": { kind: "symbol", symbolType: "actor" },
  "et2-symbol-usecase": { kind: "symbol", symbolType: "useCase" },
  "et2-symbol-systemboundary": { kind: "symbol", symbolType: "systemBoundary" },
  "et2-symbol-entity": { kind: "symbol", symbolType: "entity" },
};

const GAP_X = 72;
const GAP_Y = 48;
const ORIGIN = 80;

export function looksLikeMermaid(text: string): boolean {
  const body = unwrapMermaidSource(text);
  return FLOWCHART_HEADER.test(body) || MINDMAP_HEADER.test(body);
}

export function parseMermaidToCanvas(source: string): MermaidCanvasImport {
  const body = unwrapMermaidSource(source);
  if (!body) throw new Error("Leerer Mermaid-Text.");
  if (MINDMAP_HEADER.test(body)) return parseMindmap(body);
  if (FLOWCHART_HEADER.test(body)) return parseFlowchart(body);
  throw new Error(
    "Kein Mermaid-Flowchart oder -Mindmap erkannt. Erwartet z. B. „flowchart TD“ oder „mindmap“.",
  );
}

/** Verschiebt das importierte Diagramm in Weltkoordinaten. */
export function offsetMermaidImport(
  imp: MermaidCanvasImport,
  dx: number,
  dy: number,
): MermaidCanvasImport {
  if (dx === 0 && dy === 0) return imp;
  const walk = (n: TaskNode): TaskNode => ({
    ...n,
    x: (n.x ?? 0) + dx,
    y: (n.y ?? 0) + dy,
    children: n.children.map(walk),
  });
  return {
    ...imp,
    nodes: imp.nodes.map(walk),
    groups: imp.groups.map((g) => ({ ...g, x: g.x + dx, y: g.y + dy })),
  };
}

/** Vergibt kollisionsfreie Board-IDs und passt Pfeile/Gruppen an. */
export function remapMermaidImport(
  imp: MermaidCanvasImport,
  taken: Set<string>,
): MermaidCanvasImport {
  const idMap = new Map<string, string>();
  const walk = (n: TaskNode): TaskNode => {
    const id = generateUniqueTaskIdFromTaken(taken);
    taken.add(id);
    idMap.set(n.id, id);
    return { ...n, id, children: n.children.map(walk) };
  };
  const nodes = imp.nodes.map(walk);
  const relations = imp.relations
    .map((r) => {
      const sourceId = idMap.get(r.sourceId);
      const targetId = idMap.get(r.targetId);
      if (!sourceId || !targetId || sourceId === targetId) return null;
      return { ...r, sourceId, targetId };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  const groups = imp.groups.map((g) => ({
    ...g,
    memberIds: g.memberIds.map((id) => idMap.get(id)).filter((id): id is string => Boolean(id)),
  }));
  return { ...imp, nodes, relations, groups };
}

export function exportCanvasAsMermaid(
  nodes: readonly TaskNode[],
  relations: readonly TaskRelation[],
  groups: readonly CanvasGroup[] = [],
): string {
  if (nodes.length === 0) {
    return "flowchart TD\n  %% Keine Karten auf dieser Canvas-Ebene\n";
  }
  const direction = inferDirection(nodes);
  const idOf = mermaidIdMap(nodes);
  const lines: string[] = [`flowchart ${direction}`];
  const flowchartish = nodes.some((n) => isSymbolNode(n));
  const grouped = new Set<string>();

  for (const [gIndex, group] of groups.entries()) {
    const members = nodes.filter((n) => {
      const r = { x: n.x ?? 0, y: n.y ?? 0, w: n.width ?? 1, h: n.height ?? 1 };
      return (
        r.x >= group.x &&
        r.y >= group.y &&
        r.x + r.w <= group.x + group.width &&
        r.y + r.h <= group.y + group.height
      );
    });
    if (members.length === 0) continue;
    const gid = `g${gIndex + 1}`;
    lines.push(`  subgraph ${gid} [${mermaidLabel(group.label || "Gruppe")}]`);
    for (const n of members) {
      grouped.add(n.id);
      lines.push(`    ${emitNodeLine(idOf.get(n.id)!, n, flowchartish)}`);
    }
    lines.push("  end");
  }

  for (const n of nodes) {
    if (grouped.has(n.id)) continue;
    lines.push(`  ${emitNodeLine(idOf.get(n.id)!, n, flowchartish)}`);
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const rel of relations) {
    if (!nodeIds.has(rel.sourceId) || !nodeIds.has(rel.targetId)) continue;
    const a = idOf.get(rel.sourceId)!;
    const b = idOf.get(rel.targetId)!;
    lines.push(`  ${a} ${emitEdge(rel)} ${b}`);
  }

  for (const n of nodes) {
    const mid = idOf.get(n.id)!;
    lines.push(`  class ${mid} ${classForNode(n)}`);
  }

  return `${lines.join("\n")}\n`;
}

function unwrapMermaidSource(raw: string): string {
  let text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  const fence = text.match(/^```(?:mermaid)?\s*\n([\s\S]*?)\n```$/i);
  if (fence) text = fence[1]!.trim();
  text = text.replace(/%%\{[\s\S]*?\}%%/g, "");
  text = text
    .split("\n")
    .map((line) => {
      const cut = line.indexOf("%%");
      return cut >= 0 ? line.slice(0, cut) : line;
    })
    .join("\n")
    .trim();
  return text;
}

function parseFlowchart(body: string): MermaidCanvasImport {
  const headerLine = body.split("\n")[0] ?? "";
  const header = headerLine.match(FLOWCHART_HEADER);
  const dirRaw = (header?.[1] ?? "TD").toUpperCase();
  const direction: MermaidDirection = dirRaw === "LR" || dirRaw === "RL" ? "LR" : "TD";
  const rest = body.slice(headerLine.length).trim();
  const statements = splitStatements(rest);

  const nodes = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  const subgraphs: ParsedSubgraph[] = [];
  const stack: ParsedSubgraph[] = [];
  let subgraphSeq = 0;

  const ensureNode = (id: string, label?: string, shape?: MermaidShape): ParsedNode => {
    const existing = nodes.get(id);
    if (existing) {
      if (label && (existing.shape === "bare" || label !== existing.id)) existing.label = label;
      if (shape && shape !== "bare") existing.shape = shape;
      return existing;
    }
    const node: ParsedNode = {
      id,
      label: label && label !== id ? label : id,
      shape: shape ?? "bare",
      classes: new Set(),
    };
    nodes.set(id, node);
    for (const sg of stack) {
      if (!sg.memberIds.includes(id)) sg.memberIds.push(id);
    }
    return node;
  };

  for (const stmt of statements) {
    if (/^end$/i.test(stmt)) {
      stack.pop();
      continue;
    }
    const sg = stmt.match(/^subgraph(?:\s+(\S+))?(?:\s+\[(.+)\])?$/i);
    if (sg) {
      let id = (sg[1] ?? "").replace(/^["']|["']$/g, "");
      let title = decodeMermaidLabel(sg[2] ?? id);
      if (!id) {
        subgraphSeq += 1;
        id = `sg${subgraphSeq}`;
      }
      if (!title) title = id;
      if (sg[1] && !sg[2]) title = decodeMermaidLabel(id);
      const parsed: ParsedSubgraph = { id, title, memberIds: [] };
      subgraphs.push(parsed);
      stack.push(parsed);
      continue;
    }
    if (/^(?:direction|classDef|click|style|linkStyle|cssClass)\b/i.test(stmt)) continue;
    const classStmt = stmt.match(/^class\s+(.+?)\s+(\S+)$/i);
    if (classStmt) {
      const names = classStmt[1]!.split(",").map((x) => x.trim()).filter(Boolean);
      const cls = classStmt[2]!.trim();
      for (const id of names) ensureNode(id).classes.add(cls.toLowerCase());
      continue;
    }
    parseFlowStatement(stmt, ensureNode, edges);
  }

  if (nodes.size === 0) throw new Error("Keine Knoten im Mermaid-Diagramm.");

  const flowchartish = [...nodes.values()].some((n) =>
    ["diamond", "stadium", "circle", "parallelogram", "subroutine", "hexagon", "cylinder"].includes(
      n.shape,
    ),
  );
  const laidOut = layoutFlow(nodes, edges, direction, flowchartish);
  const groups = subgraphs
    .map((sg) => {
      const members = laidOut.filter((n) => sg.memberIds.includes(n.id));
      const rect = groupRectAroundNodes(members);
      if (!rect) return null;
      return { label: sg.title, memberIds: sg.memberIds, ...rect };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  return {
    kind: "flowchart",
    direction,
    nodes: laidOut,
    relations: edges.map((e) => edgeToRelation(e)),
    groups,
  };
}

function parseFlowStatement(
  stmt: string,
  ensureNode: (id: string, label?: string, shape?: MermaidShape) => ParsedNode,
  edges: ParsedEdge[],
): void {
  let i = 0;
  const first = parseNodeToken(stmt, i);
  if (!first) return;
  ensureNode(first.id, first.label, first.shape);
  i = first.next;
  while (i < stmt.length) {
    skipWs(stmt, (n) => {
      i = n;
    }, i);
    if (i >= stmt.length) break;
    const edge = parseEdgeToken(stmt, i);
    if (!edge) break;
    i = edge.next;
    skipWs(stmt, (n) => {
      i = n;
    }, i);
    const next = parseNodeToken(stmt, i);
    if (!next) break;
    ensureNode(next.id, next.label, next.shape);
    edges.push({ source: first.id, target: next.id, style: edge.style, label: edge.label });
    // chain from the latest node
    first.id = next.id;
    first.label = next.label;
    first.shape = next.shape;
    i = next.next;
  }
}

function parseNodeToken(
  s: string,
  start: number,
): { id: string; label?: string; shape: MermaidShape; next: number } | null {
  let i = start;
  while (i < s.length && /\s/.test(s[i]!)) i += 1;
  if (i >= s.length) return null;
  let id: string;
  if (s[i] === '"') {
    const q = readQuoted(s, i);
    if (!q) return null;
    id = q.value;
    i = q.next;
  } else {
    const m = s.slice(i).match(/^[A-Za-z0-9_][\w.-]*/);
    if (!m) return null;
    id = m[0]!;
    i += id.length;
  }
  const shaped = parseShape(s, i);
  if (shaped) {
    return { id, label: shaped.label || id, shape: shaped.shape, next: shaped.next };
  }
  return { id, shape: "bare", next: i };
}

function parseShape(
  s: string,
  start: number,
): { label: string; shape: MermaidShape; next: number } | null {
  const pairs: Array<{ open: string; close: string; shape: MermaidShape }> = [
    { open: "[[", close: "]]", shape: "subroutine" },
    { open: "[(", close: ")]", shape: "cylinder" },
    { open: "((", close: "))", shape: "circle" },
    { open: "([", close: "])", shape: "stadium" },
    { open: "{{", close: "}}", shape: "hexagon" },
    { open: "{", close: "}", shape: "diamond" },
    { open: "[/", close: "/]", shape: "parallelogram" },
    { open: "[\\", close: "\\]", shape: "parallelogram" },
    { open: ">", close: "]", shape: "asymmetric" },
    { open: "[", close: "]", shape: "rect" },
    { open: "(", close: ")", shape: "round" },
  ];
  for (const p of pairs) {
    if (!s.startsWith(p.open, start)) continue;
    const innerStart = start + p.open.length;
    const closeAt = findClose(s, innerStart, p.close);
    if (closeAt < 0) continue;
    const inner = s.slice(innerStart, closeAt);
    return {
      label: decodeMermaidLabel(stripShapeQuotes(inner)),
      shape: p.shape,
      next: closeAt + p.close.length,
    };
  }
  return null;
}

function findClose(s: string, from: number, close: string): number {
  if (s[from] === '"') {
    const q = readQuoted(s, from);
    if (!q) return -1;
    return s.startsWith(close, q.next) ? q.next : -1;
  }
  return s.indexOf(close, from);
}

function parseEdgeToken(
  s: string,
  start: number,
): { style: ParsedEdge["style"]; label: string; next: number } | null {
  let i = start;
  while (i < s.length && /\s/.test(s[i]!)) i += 1;
  const rest = s.slice(i);

    const labeled = rest.match(/^(-->|---|==>|-\.->|--x)\|([^|]*)\|/);
  if (labeled) {
    return {
      style: styleFromOp(labeled[1]!),
      label: decodeMermaidLabel(labeled[2] ?? ""),
      next: i + labeled[0].length,
    };
  }
  const spaced = rest.match(/^(--|-.)\s+(.+?)\s+(-->|\.->|==>)/);
  if (spaced) {
    const op = spaced[3] === ".->" ? "-.->" : spaced[3] === "==>" ? "==>" : "-->";
    return {
      style: styleFromOp(op),
      label: decodeMermaidLabel(spaced[2] ?? ""),
      next: i + spaced[0].length,
    };
  }
  const plain = rest.match(/^(<-->|-\.->|==>|-->|--x|--o|~~~|---)/);
  if (plain) {
    return { style: styleFromOp(plain[1]!), label: "", next: i + plain[0].length };
  }
  return null;
}

function styleFromOp(op: string): ParsedEdge["style"] {
  if (op.includes("x")) return "cross";
  if (op.includes("==")) return "thick";
  if (op.includes(".")) return "dotted";
  return "arrow";
}

function splitStatements(body: string): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  let quote: string | null = null;
  const flush = () => {
    const t = buf.trim();
    if (t) out.push(t);
    buf = "";
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (quote) {
      buf += ch;
      if (ch === quote && body[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if ("[{(".includes(ch)) depth += 1;
    if ("]})".includes(ch) && depth > 0) depth -= 1;
    if ((ch === "\n" || ch === ";") && depth === 0) {
      flush();
      continue;
    }
    buf += ch;
  }
  flush();
  return out;
}

function parseMindmap(body: string): MermaidCanvasImport {
  const lines = body.split("\n").slice(1).filter((l) => l.trim());
  if (lines.length === 0) throw new Error("Leere Mindmap.");
  type Item = { indent: number; node: TaskNode };
  const stack: Item[] = [];
  const roots: TaskNode[] = [];
  let seq = 0;
  for (const line of lines) {
    const indent = line.match(/^[ \t]*/)?.[0]?.replace(/\t/g, "  ").length ?? 0;
    const raw = line.trim();
    const parsed = parseMindmapItem(raw, `mm-${++seq}`);
    while (stack.length && stack[stack.length - 1]!.indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.node.children.push(parsed);
    else roots.push(parsed);
    stack.push({ indent, node: parsed });
  }
  const laid = ensureForestCanvasLayout(roots);
  return { kind: "mindmap", direction: "TD", nodes: laid, relations: [], groups: [] };
}

function parseMindmapItem(raw: string, id: string): TaskNode {
  const shaped = parseShape(`x${raw}`, 1);
  const title = decodeMermaidLabel(shaped?.label ?? raw.replace(/^[-*]\s*/, "")).trim() || "Karte";
  const node = createBlankCardNode(id);
  node.title = title;
  return node;
}

function layoutFlow(
  parsed: Map<string, ParsedNode>,
  edges: ParsedEdge[],
  direction: MermaidDirection,
  flowchartish: boolean,
): TaskNode[] {
  const ids = [...parsed.keys()];
  const preds = new Map<string, string[]>();
  for (const id of ids) preds.set(id, []);
  for (const e of edges) {
    if (!parsed.has(e.source) || !parsed.has(e.target)) continue;
    preds.get(e.target)!.push(e.source);
  }
  const memo = new Map<string, number>();
  const rankOf = (id: string, visiting: Set<string>): number => {
    const hit = memo.get(id);
    if (hit !== undefined) return hit;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const ps = preds.get(id) ?? [];
    const r = ps.length === 0 ? 0 : Math.max(...ps.map((p) => rankOf(p, visiting))) + 1;
    visiting.delete(id);
    memo.set(id, r);
    return r;
  };
  const ranks = new Map<string, number>();
  for (const id of ids) ranks.set(id, rankOf(id, new Set()));
  const byRank = new Map<number, string[]>();
  for (const id of ids) {
    const r = ranks.get(id)!;
    const list = byRank.get(r) ?? [];
    list.push(id);
    byRank.set(r, list);
  }

  const nodes: TaskNode[] = [];
  const colW: number[] = [];
  const rowH: number[] = [];
  const built = new Map<string, TaskNode>();
  for (const id of ids) {
    const n = parsedNodeToTask(parsed.get(id)!, flowchartish);
    built.set(id, n);
  }
  const maxRank = Math.max(...ranks.values(), 0);
  for (let r = 0; r <= maxRank; r++) {
    const list = byRank.get(r) ?? [];
    colW[r] = Math.max(0, ...list.map((id) => built.get(id)!.width ?? 160));
    rowH[r] = Math.max(0, ...list.map((id) => built.get(id)!.height ?? 80));
  }

  if (direction === "LR") {
    let x = ORIGIN;
    for (let r = 0; r <= maxRank; r++) {
      const list = byRank.get(r) ?? [];
      let y = ORIGIN;
      for (const id of list) {
        const n = built.get(id)!;
        n.x = x;
        n.y = y;
        y += (n.height ?? 80) + GAP_Y;
        nodes.push(n);
      }
      x += (colW[r] ?? 160) + GAP_X;
    }
  } else {
    let y = ORIGIN;
    for (let r = 0; r <= maxRank; r++) {
      const list = byRank.get(r) ?? [];
      let x = ORIGIN;
      for (const id of list) {
        const n = built.get(id)!;
        n.x = x;
        n.y = y;
        x += (n.width ?? 160) + GAP_X;
        nodes.push(n);
      }
      y += (rowH[r] ?? 80) + GAP_Y;
    }
  }
  return nodes;
}

function parsedNodeToTask(n: ParsedNode, flowchartish: boolean): TaskNode {
  const fromClass = [...n.classes].map((c) => CLASS_KIND[c]).find(Boolean);
  let kind: "card" | "note" | "symbol" = fromClass?.kind ?? "card";
  let symbolType: SymbolType | undefined = fromClass?.symbolType;
  if (!fromClass) {
    if (n.shape === "diamond") {
      kind = "symbol";
      symbolType = "decision";
    } else if (n.shape === "stadium") {
      kind = "symbol";
      symbolType = "terminator";
    } else if (n.shape === "circle") {
      kind = "symbol";
      symbolType = "useCase";
    } else if (n.shape === "parallelogram" || n.shape === "cylinder") {
      kind = "symbol";
      symbolType = "document";
    } else if (n.shape === "subroutine" || n.shape === "hexagon" || n.shape === "asymmetric") {
      kind = "symbol";
      symbolType = "process";
    } else if (flowchartish && (n.shape === "rect" || n.shape === "round" || n.shape === "bare")) {
      kind = "symbol";
      symbolType = "process";
    }
  }
  const title = n.label.trim() || n.id;
  if (kind === "note") {
    const node = createBlankNoteNode(n.id);
    node.title = title;
    const size = defaultCardSize("note");
    node.width = size.width;
    node.height = size.height;
    return node;
  }
  if (kind === "symbol" && isSymbolType(symbolType)) {
    const node = createBlankSymbolNode(n.id, symbolType);
    node.title = title;
    return node;
  }
  const node = createBlankCardNode(n.id);
  node.title = title;
  const size = defaultCardSize("card");
  node.width = size.width;
  node.height = size.height;
  return node;
}

function edgeToRelation(e: ParsedEdge): MermaidCanvasImport["relations"][number] {
  const parsed = parseRelationLabel(e.label);
  if (parsed.type === "untyped" && !parsed.label) {
    if (e.style === "cross") parsed.type = "blocks";
    else if (e.style === "thick") parsed.type = "assigns";
    else if (e.style === "dotted") parsed.type = "informs";
  }
  return { sourceId: e.source, targetId: e.target, ...parsed };
}

function parseRelationLabel(raw: string): Pick<TaskRelation, "type" | "label"> {
  const text = raw.trim();
  if (!text) return { type: "untyped" };
  for (const [type, label] of Object.entries(TASK_RELATION_TYPE_LABELS) as Array<
    [TaskRelationType, string]
  >) {
    if (type === "untyped") continue;
    if (text === label) return { type };
    if (text.startsWith(`${label}:`)) {
      const rest = text.slice(label.length + 1).trim();
      return rest ? { type, label: rest } : { type };
    }
  }
  return { type: "untyped", label: text };
}

function emitNodeLine(id: string, node: TaskNode, flowchartish: boolean): string {
  const label = mermaidLabel(nodeDisplayTitle(node));
  if (isNoteNode(node)) return `${id}(["${label}"])`;
  if (isSymbolNode(node) && node.symbolType) {
    switch (node.symbolType) {
      case "decision":
        return `${id}{"${label}"}`;
      case "terminator":
        return `${id}(["${label}"])`;
      case "useCase":
        return `${id}(("${label}"))`;
      case "document":
        return `${id}[/"${label}"/]`;
      case "actor":
        return `${id}(["${label}"])`;
      case "systemBoundary":
        return `${id}[["${label}"]]`;
      default:
        return `${id}["${label}"]`;
    }
  }
  if (flowchartish) return `${id}["${label}"]`;
  return `${id}["${label}"]`;
}

function emitEdge(rel: TaskRelation): string {
  const custom = rel.label?.trim();
  if (rel.type === "untyped") return custom ? `-->|${mermaidLabel(custom)}|` : "-->";
  const typeLabel = TASK_RELATION_TYPE_LABELS[rel.type];
  const text = custom ? `${typeLabel}: ${custom}` : typeLabel;
  if (rel.type === "blocks") return `--x|${mermaidLabel(text)}|`;
  if (rel.type === "assigns") return `==>|${mermaidLabel(text)}|`;
  if (rel.type === "informs" || rel.type === "supports") return `-.->|${mermaidLabel(text)}|`;
  return `-->|${mermaidLabel(text)}|`;
}

function classForNode(node: TaskNode): string {
  if (isNoteNode(node)) return "et2-note";
  if (isSymbolNode(node) && node.symbolType) {
    return `et2-symbol-${node.symbolType.toLowerCase()}`;
  }
  return "et2-card";
}

function mermaidIdMap(nodes: readonly TaskNode[]): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();
  nodes.forEach((n, i) => {
    let id = `n${i + 1}`;
    let k = 2;
    while (used.has(id)) {
      id = `n${i + 1}_${k}`;
      k += 1;
    }
    used.add(id);
    map.set(n.id, id);
  });
  return map;
}

function inferDirection(nodes: readonly TaskNode[]): MermaidDirection {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const x = n.x ?? 0;
    const y = n.y ?? 0;
    const w = n.width ?? 160;
    const h = n.height ?? 80;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  if (!Number.isFinite(minX)) return "TD";
  return maxX - minX >= (maxY - minY) * 1.15 ? "LR" : "TD";
}

function mermaidLabel(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "#quot;")
    .replace(/\n/g, "<br/>");
}

function decodeMermaidLabel(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/#quot;/g, '"')
    .replace(/#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\"/g, '"')
    .trim();
}

function stripShapeQuotes(inner: string): string {
  const t = inner.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function readQuoted(s: string, start: number): { value: string; next: number } | null {
  if (s[start] !== '"') return null;
  let i = start + 1;
  let value = "";
  while (i < s.length) {
    if (s[i] === "\\" && i + 1 < s.length) {
      value += s[i + 1]!;
      i += 2;
      continue;
    }
    if (s[i] === '"') return { value, next: i + 1 };
    value += s[i]!;
    i += 1;
  }
  return null;
}

function skipWs(s: string, set: (n: number) => void, i: number): void {
  while (i < s.length && /\s/.test(s[i]!)) i += 1;
  set(i);
}
