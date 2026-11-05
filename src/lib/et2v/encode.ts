import { normalizeAppearance, type BoardAppearance } from "@/lib/board-appearance";
import type { CanvasGroup } from "@/lib/canvas-group";
import { getEffortSource, getEffortUnit } from "@/lib/task-effort";
import { isNoteNode, isSymbolNode } from "@/lib/tree-node-kind";
import type { TaskNode } from "@/types/task-node";
import type { TaskRelation } from "@/types/task-relation";
import type { BoardImportPayload } from "@/lib/task-tree-json";
import { contextPathNodes } from "@/lib/board-context";
import { nodeDisplayTitle } from "@/lib/tree-node-kind";

import { AliasMap } from "@/lib/et2v/alias-map";
import { ET2V_FORMAT, ET2V_MAGIC, ET2V_ROOT_PARENT, ET2V_VERSION } from "@/lib/et2v/constants";
import { cell, row } from "@/lib/et2v/text";

export type Et2vEncodeScope = "board" | "context" | "subtree";

export interface EncodeEt2vOptions {
  scope?: Et2vEncodeScope;
  exportedAt?: string;
  title?: string;
  /** Drill path for \`context\` scope (ids from root to context node). */
  pathIds?: string[];
}

function finite(n: number | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? String(n) : "";
}

function nodeKindCells(node: TaskNode): [string, string] {
  if (isNoteNode(node)) return ["note", ""];
  if (isSymbolNode(node) && node.symbolType) return ["symbol", node.symbolType];
  return ["card", ""];
}

function pushNodeExtras(node: TaskNode, alias: string, out: string[]): void {
  const desc = (node.description ?? "").trim();
  if (desc) out.push(row(["@desc", alias, cell(desc)]));
  if (isNoteNode(node)) {
    const md = (node.markdown ?? "").trim();
    if (md) out.push(row(["@md", alias, cell(md)]));
  }
  if (isSymbolNode(node) && node.symbolType === "entity" && node.entityAttributes?.length) {
    const parts = node.entityAttributes.map((a) => {
      const type = a.type?.trim() ? `:${a.type.trim()}` : "";
      const key = a.key ? `:${a.key}` : "";
      return `${a.name}${type}${key}`;
    });
    out.push(row(["@attr", alias, parts.join("|")]));
  }
  if (!isNoteNode(node) && !isSymbolNode(node)) {
    if (node.tags.length) out.push(row(["@tags", alias, node.tags.join(",")]));
    const link = (node.link ?? "").trim();
    if (link) out.push(row(["@link", alias, cell(link)]));
    const cmd = (node.command ?? "").trim();
    if (cmd) out.push(row(["@cmd", alias, cell(cmd)]));
    if (node.dueDate) out.push(row(["@due", alias, node.dueDate.toISOString()]));
    if (node.reminderDate) out.push(row(["@rem", alias, node.reminderDate.toISOString()]));
    if (node.effort > 0 || getEffortUnit(node) !== "hours" || getEffortSource(node) === "calculated") {
      const unit = getEffortUnit(node);
      const suffix = unit === "minutes" ? "m" : unit === "workdays" ? "d" : "h";
      const calc = getEffortSource(node) === "calculated" ? ":calc" : "";
      out.push(row(["@eff", alias, `${node.effort}${suffix}${calc}`]));
    }
    if (node.cardColor) out.push(row(["@color", alias, node.cardColor]));
    if (node.cardIcon) out.push(row(["@icon", alias, node.cardIcon]));
  }
}

function walkFlatten(
  nodes: TaskNode[],
  parentAlias: string,
  nMap: AliasMap,
  out: string[],
): void {
  for (const node of nodes) {
    const alias = nMap.alias(node.id);
    const [kind, symbolType] = nodeKindCells(node);
    out.push(
      row([
        "n",
        alias,
        kind,
        symbolType,
        node.title,
        parentAlias,
        finite(node.x),
        finite(node.y),
        finite(node.width),
        finite(node.height),
        finite(node.zIndex),
      ]),
    );
    pushNodeExtras(node, alias, out);
    walkFlatten(node.children, alias, nMap, out);
  }
}

function pushIdLines(out: string[], maps: AliasMap[]): void {
  for (const m of maps) {
    for (const [alias, real] of m.entries()) {
      out.push(row(["@id", alias, real]));
    }
  }
}

function pushRelations(
  relations: TaskRelation[],
  nMap: AliasMap,
  rMap: AliasMap,
  out: string[],
): void {
  for (const rel of relations) {
    out.push(
      row([
        "r",
        rMap.alias(rel.id),
        rel.type,
        nMap.alias(rel.sourceId),
        nMap.alias(rel.targetId),
        rel.label ?? "",
      ]),
    );
  }
}

function pushCanvasGroups(
  groups: CanvasGroup[],
  gMap: AliasMap,
  out: string[],
): void {
  for (const g of groups) {
    out.push(
      row([
        "cg",
        gMap.alias(g.id),
        g.label,
        g.x,
        g.y,
        g.width,
        g.height,
        g.color ?? "",
      ]),
    );
  }
}

function pushBoardUi(payload: BoardImportPayload, out: string[]): void {
  if (payload.pathIds.length) {
    out.push(row(["@path", ...payload.pathIds]));
  }
  const appearance = normalizeAppearance(payload.appearance);
  if (JSON.stringify(appearance) !== JSON.stringify(normalizeAppearance(undefined))) {
    out.push(`@appearance ${JSON.stringify(appearance)}`);
  }
  for (const [k, v] of Object.entries(payload.columnTitleOverrides)) {
    if (typeof v === "string" && v.trim()) out.push(row(["@col", k, v.trim()]));
  }
  if (payload.collapsedIds?.length) {
    out.push(row(["@collapsed", ...payload.collapsedIds]));
  }
  if (payload.cardCollapsedIds?.length) {
    out.push(row(["@cardcollapsed", ...payload.cardCollapsedIds]));
  }
}

function encodeForest(
  roots: TaskNode[],
  relations: TaskRelation[],
  canvasGroups: Record<string, CanvasGroup[]>,
  out: string[],
): void {
  const nMap = new AliasMap("n");
  const rMap = new AliasMap("r");
  const gMap = new AliasMap("g");
  for (const root of roots) nMap.alias(root.id);
  walkFlatten(roots, ET2V_ROOT_PARENT, nMap, out);
  pushIdLines(out, [nMap, rMap, gMap]);
  pushRelations(relations, nMap, rMap, out);
  const keys = Object.keys(canvasGroups).sort();
  for (const key of keys) {
    const groups = canvasGroups[key];
    if (!groups?.length) continue;
    out.push(row(["@cgctx", key]));
    pushCanvasGroups(groups, gMap, out);
  }
}

export function encodeEt2vFromPayload(
  payload: BoardImportPayload,
  options?: EncodeEt2vOptions,
): string {
  const scope = options?.scope ?? "board";
  const out: string[] = [];
  out.push(ET2V_MAGIC);
  out.push(row(["@format", ET2V_FORMAT]));
  out.push(row(["@version", ET2V_VERSION]));
  out.push(row(["@scope", scope]));
  out.push(row(["@exported", options?.exportedAt ?? new Date().toISOString()]));
  out.push(row(["@title", options?.title ?? "ET2 Board"]));

  if (scope === "board") {
    pushBoardUi(payload, out);
    encodeForest(payload.roots, payload.relations ?? [], payload.canvasGroups ?? {}, out);
  } else if (scope === "context") {
    const pathIds = options?.pathIds ?? payload.pathIds ?? [];
    const contextId = pathIds.length ? pathIds[pathIds.length - 1]! : null;
    let subtreeRoots = payload.roots;
    if (contextId) {
      const findSubtree = (nodes: TaskNode[]): TaskNode[] | null => {
        for (const n of nodes) {
          if (n.id === contextId) return n.children;
          const inner = findSubtree(n.children);
          if (inner) return inner;
        }
        return null;
      };
      subtreeRoots = findSubtree(payload.roots) ?? [];
    }
    const pathNodes = contextPathNodes(payload.roots, contextId);
    if (pathNodes.length) {
      out.push(row(["@path", ...pathIds]));
      out.push(row(["@pathTitle", pathNodes.map((n) => nodeDisplayTitle(n)).join(" › ")]));
    }
    const ctxKey = contextId ?? "__root__";
    const groups = payload.canvasGroups?.[ctxKey] ?? [];
    const nMap = new AliasMap("n");
    const rMap = new AliasMap("r");
    const gMap = new AliasMap("g");
    for (const root of subtreeRoots) nMap.alias(root.id);
    walkFlatten(subtreeRoots, ET2V_ROOT_PARENT, nMap, out);
    pushIdLines(out, [nMap, rMap, gMap]);
    const siblingIds = new Set(subtreeRoots.map((n) => n.id));
    const rels = (payload.relations ?? []).filter(
      (r) => siblingIds.has(r.sourceId) && siblingIds.has(r.targetId),
    );
    pushRelations(rels, nMap, rMap, out);
    if (groups.length) {
      out.push(row(["@cgctx", ctxKey]));
      pushCanvasGroups(groups, gMap, out);
    }
  } else {
    const root = payload.roots[0];
    if (!root) {
      out.push("@end");
      return `${out.join("\n")}\n`;
    }
    const nMap = new AliasMap("n");
    nMap.alias(root.id);
    walkFlatten([root], ET2V_ROOT_PARENT, nMap, out);
    pushIdLines(out, [nMap]);
  }

  out.push("@end");
  return `${out.join("\n")}\n`;
}
