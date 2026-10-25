import { normalizeAppearance, type BoardAppearance } from "@/lib/board-appearance";
import type { CanvasGroup } from "@/lib/canvas-group";
import { normalizeEntityAttributes } from "@/lib/entity-attribute";
import { parseCardColor, type CardColorId } from "@/lib/card-color";
import { parseCardIcon, type CardIconId } from "@/lib/card-icon";
import { isSymbolType, type SymbolType } from "@/lib/diagram-symbol";
import { parseEffortSource, parseEffortUnit } from "@/lib/task-effort";
import { normalizeTaskCommand } from "@/lib/task-command";
import { normalizeTaskLink } from "@/lib/task-link";
import { uniqNonEmptyTags } from "@/lib/task-tags";
import { normalizeNoteMarkdown } from "@/lib/tree-node-kind";
import type { TaskNode } from "@/types/task-node";
import {
  normalizeTaskRelationType,
  type TaskRelation,
  type TaskRelationType,
} from "@/types/task-relation";
import type { BoardImportPayload } from "@/lib/task-tree-json";
import { sanitizeRelations } from "@/lib/task-relations";
import { generateUniqueTaskIdFromTaken } from "@/lib/task-id";

import { ET2V_FORMAT, ET2V_MAGIC, ET2V_ROOT_PARENT } from "@/lib/et2v/constants";
import { parseCell, splitRow } from "@/lib/et2v/text";

export type Et2vScope = "board" | "context" | "subtree";

export interface Et2vDecodeResult {
  scope: Et2vScope;
  title: string;
  pathIds: string[];
  /** Board import payload (board scope) or context children + meta. */
  payload: BoardImportPayload;
  /** Single root for subtree scope (first root of forest). */
  subtreeRoot?: TaskNode;
}

interface NodeDraft {
  id: string;
  kind: "card" | "note" | "symbol";
  symbolType?: SymbolType;
  title: string;
  parentAlias: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
  description?: string;
  markdown?: string;
  tags?: string[];
  link?: string;
  command?: string;
  dueDate?: Date | null;
  reminderDate?: Date | null;
  effort?: number;
  effortUnit?: "hours" | "minutes" | "workdays";
  effortSource?: "manual" | "calculated";
  cardColor?: CardColorId;
  cardIcon?: CardIconId;
  entityAttributes?: ReturnType<typeof normalizeEntityAttributes>;
}

function num(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function parseKind(raw: string, symbolCol: string): Pick<NodeDraft, "kind" | "symbolType"> {
  const k = raw.trim().toLowerCase();
  if (k === "note") return { kind: "note" };
  if (k === "symbol") {
    const st = symbolCol.trim();
    if (isSymbolType(st)) return { kind: "symbol", symbolType: st };
    return { kind: "symbol", symbolType: "process" };
  }
  return { kind: "card" };
}

function parseEffCell(raw: string): Pick<NodeDraft, "effort" | "effortUnit" | "effortSource"> {
  const t = raw.trim();
  if (!t) return {};
  const calc = t.endsWith(":calc");
  const body = calc ? t.slice(0, -5) : t;
  const m = body.match(/^(\d+(?:\.\d+)?)(h|m|d)?$/i);
  if (!m) return {};
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return {};
  const unitChar = (m[2] ?? "h").toLowerCase();
  const unit = unitChar === "m" ? "minutes" : unitChar === "d" ? "workdays" : "hours";
  return {
    effort: value,
    effortUnit: parseEffortUnit(unit) ?? "hours",
    ...(calc ? { effortSource: "calculated" as const } : {}),
  };
}

function parseAttrCell(raw: string): ReturnType<typeof normalizeEntityAttributes> {
  const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
  const attrs = parts.map((p) => {
    const segs = p.split(":");
    const name = segs[0] ?? "";
    const type = segs[1]?.trim() || undefined;
    const keyRaw = segs[2]?.trim();
    const key = keyRaw === "pk" || keyRaw === "fk" ? keyRaw : undefined;
    return { name, ...(type ? { type } : {}), ...(key ? { key } : {}) };
  });
  return normalizeEntityAttributes(attrs);
}

export function isEt2vText(text: string): boolean {
  const first = text.trimStart().split(/\r?\n/, 1)[0]?.trim() ?? "";
  return first === ET2V_MAGIC || first.startsWith("# et2v/");
}

function resolveId(alias: string, idMap: Map<string, string>, taken: Set<string>): string {
  const key = alias.trim();
  const mapped = idMap.get(key) ?? key;
  if (mapped && !taken.has(mapped)) {
    taken.add(mapped);
    return mapped;
  }
  const fresh = generateUniqueTaskIdFromTaken(taken);
  taken.add(fresh);
  if (key) idMap.set(key, fresh);
  return fresh;
}

function draftToTaskNode(d: NodeDraft, children: TaskNode[]): TaskNode {
  const layout = {
    ...(d.x !== undefined ? { x: d.x } : {}),
    ...(d.y !== undefined ? { y: d.y } : {}),
    ...(d.width !== undefined ? { width: d.width } : {}),
    ...(d.height !== undefined ? { height: d.height } : {}),
    ...(d.zIndex !== undefined ? { zIndex: d.zIndex } : {}),
  };
  if (d.kind === "note") {
    return {
      id: d.id,
      kind: "note",
      title: d.title,
      markdown: normalizeNoteMarkdown(d.markdown ?? ""),
      link: "",
      description: "",
      tags: [],
      dueDate: null,
      reminderDate: null,
      effort: 0,
      ...layout,
      children,
    };
  }
  if (d.kind === "symbol" && d.symbolType) {
    return {
      id: d.id,
      kind: "symbol",
      symbolType: d.symbolType,
      title: d.title,
      ...(d.symbolType === "entity" && d.entityAttributes?.length
        ? { entityAttributes: d.entityAttributes }
        : {}),
      link: "",
      description: "",
      tags: [],
      dueDate: null,
      reminderDate: null,
      effort: 0,
      ...layout,
      children,
    };
  }
  return {
    id: d.id,
    kind: "card",
    title: d.title,
    link: d.link ?? "",
    ...(d.command ? { command: d.command } : {}),
    description: d.description ?? "",
    tags: d.tags ?? [],
    dueDate: d.dueDate ?? null,
    reminderDate: d.reminderDate ?? null,
    effort: d.effort ?? 0,
    ...(d.effortUnit ? { effortUnit: d.effortUnit } : {}),
    ...(d.effortSource === "calculated" ? { effortSource: "calculated" } : {}),
    ...(d.cardColor ? { cardColor: d.cardColor } : {}),
    ...(d.cardIcon ? { cardIcon: d.cardIcon } : {}),
    ...layout,
    children,
  };
}

function assignAliasIds(
  drafts: NodeDraft[],
  idMap: Map<string, string>,
  taken: Set<string>,
): Map<string, string> {
  const aliasToReal = new Map<string, string>();
  for (const d of drafts) {
    aliasToReal.set(d.id, resolveId(d.id, idMap, taken));
  }
  return aliasToReal;
}

function buildForest(drafts: NodeDraft[], aliasToReal: Map<string, string>, idMap: Map<string, string>): TaskNode[] {
  const childrenOf = new Map<string, NodeDraft[]>();
  const rootDrafts: NodeDraft[] = [];
  for (const d of drafts) {
    const realId = aliasToReal.get(d.id)!;
    const resolved: NodeDraft = { ...d, id: realId };
    const parent = d.parentAlias.trim();
    if (!parent || parent === ET2V_ROOT_PARENT) {
      rootDrafts.push(resolved);
      continue;
    }
    const parentReal = aliasToReal.get(parent) ?? idMap.get(parent) ?? parent;
    const list = childrenOf.get(parentReal) ?? [];
    list.push(resolved);
    childrenOf.set(parentReal, list);
  }

  function build(d: NodeDraft): TaskNode {
    const kids = (childrenOf.get(d.id) ?? []).map(build);
    return draftToTaskNode(d, kids);
  }
  return rootDrafts.map(build);
}

function remapRelationEndpoints(
  relations: TaskRelation[],
  aliasToReal: Map<string, string>,
  idMap: Map<string, string>,
): TaskRelation[] {
  const resolve = (alias: string) => aliasToReal.get(alias) ?? idMap.get(alias) ?? alias;
  return relations.map((r) => ({
    ...r,
    sourceId: resolve(r.sourceId),
    targetId: resolve(r.targetId),
  }));
}

export function decodeEt2vText(text: string): Et2vDecodeResult | null {
  if (!isEt2vText(text)) return null;
  let scope: Et2vScope = "board";
  let title = "ET2 Board";
  const pathIds: string[] = [];
  const idMap = new Map<string, string>();
  const drafts: NodeDraft[] = [];
  const relations: TaskRelation[] = [];
  const canvasGroups: Record<string, CanvasGroup[]> = {};
  let cgCtx = "__root__";
  let appearance: BoardAppearance = normalizeAppearance(undefined);
  const columnTitleOverrides: Record<number, string> = {};
  const collapsedIds: string[] = [];
  const cardCollapsedIds: string[] = [];
  const taken = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed === "@end") break;

    const cols = splitRow(trimmed);
    const tag = cols[0]?.trim();
    if (!tag) continue;

    if (tag === "@format" && cols[1] !== ET2V_FORMAT) return null;
    if (tag === "@scope") {
      const s = cols[1]?.trim();
      if (s === "board" || s === "context" || s === "subtree") scope = s;
      continue;
    }
    if (tag === "@title") {
      title = parseCell(cols[1] ?? "") || title;
      continue;
    }
    if (tag === "@path") {
      pathIds.length = 0;
      for (let i = 1; i < cols.length; i++) {
        const id = cols[i]?.trim();
        if (id) pathIds.push(id);
      }
      continue;
    }
    if (tag === "@pathTitle") continue;
    if (tag === "@id" && cols.length >= 3) {
      idMap.set(cols[1]!.trim(), cols[2]!.trim());
      continue;
    }
    if (tag === "@appearance") {
      try {
        appearance = normalizeAppearance(JSON.parse(cols.slice(1).join("\t")));
      } catch {
        /* ignore */
      }
      continue;
    }
    if (tag === "@col" && cols.length >= 3) {
      const idx = Number(cols[1]);
      if (Number.isFinite(idx)) columnTitleOverrides[idx] = parseCell(cols[2] ?? "");
      continue;
    }
    if (tag === "@collapsed") {
      for (let i = 1; i < cols.length; i++) {
        const id = cols[i]?.trim();
        if (id) collapsedIds.push(id);
      }
      continue;
    }
    if (tag === "@cardcollapsed") {
      for (let i = 1; i < cols.length; i++) {
        const id = cols[i]?.trim();
        if (id) cardCollapsedIds.push(id);
      }
      continue;
    }
    if (tag === "@cgctx") {
      cgCtx = cols[1]?.trim() || "__root__";
      continue;
    }
    if (tag === "@desc" && cols.length >= 3) {
      const id = cols[1]!.trim();
      const d = drafts.find((x) => x.id === id);
      const desc = parseCell(cols.slice(2).join("\t"));
      if (d) d.description = desc;
      continue;
    }
    if (tag === "@md" && cols.length >= 3) {
      const id = cols[1]!.trim();
      const d = drafts.find((x) => x.id === id);
      if (d) d.markdown = parseCell(cols.slice(2).join("\t"));
      continue;
    }
    if (tag === "@tags" && cols.length >= 3) {
      const id = cols[1]!.trim();
      const d = drafts.find((x) => x.id === id);
      if (d) d.tags = uniqNonEmptyTags(parseCell(cols[2] ?? "").split(","));
      continue;
    }
    if (tag === "@link" && cols.length >= 3) {
      const d = drafts.find((x) => x.id === cols[1]!.trim());
      if (d) d.link = normalizeTaskLink(parseCell(cols[2] ?? ""));
      continue;
    }
    if (tag === "@cmd" && cols.length >= 3) {
      const d = drafts.find((x) => x.id === cols[1]!.trim());
      if (d) d.command = normalizeTaskCommand(parseCell(cols[2] ?? ""));
      continue;
    }
    if (tag === "@due" && cols.length >= 3) {
      const d = drafts.find((x) => x.id === cols[1]!.trim());
      const raw = parseCell(cols[2] ?? "");
      if (d) d.dueDate = raw ? new Date(raw) : null;
      continue;
    }
    if (tag === "@rem" && cols.length >= 3) {
      const d = drafts.find((x) => x.id === cols[1]!.trim());
      const raw = parseCell(cols[2] ?? "");
      if (d) d.reminderDate = raw ? new Date(raw) : null;
      continue;
    }
    if (tag === "@eff" && cols.length >= 3) {
      const d = drafts.find((x) => x.id === cols[1]!.trim());
      if (d) Object.assign(d, parseEffCell(parseCell(cols[2] ?? "")));
      continue;
    }
    if (tag === "@color" && cols.length >= 3) {
      const d = drafts.find((x) => x.id === cols[1]!.trim());
      const c = parseCardColor(parseCell(cols[2] ?? ""));
      if (d && c) d.cardColor = c;
      continue;
    }
    if (tag === "@icon" && cols.length >= 3) {
      const d = drafts.find((x) => x.id === cols[1]!.trim());
      const ic = parseCardIcon(parseCell(cols[2] ?? ""));
      if (d && ic) d.cardIcon = ic;
      continue;
    }
    if (tag === "@attr" && cols.length >= 3) {
      const d = drafts.find((x) => x.id === cols[1]!.trim());
      if (d) d.entityAttributes = parseAttrCell(parseCell(cols.slice(2).join("\t")));
      continue;
    }

    if (tag === "n" && cols.length >= 6) {
      const kindInfo = parseKind(cols[2] ?? "", cols[3] ?? "");
      const title = parseCell(cols[4] ?? "");
      const parentAlias = cols[5] ?? ET2V_ROOT_PARENT;
      drafts.push({
        id: cols[1]!.trim(),
        ...kindInfo,
        title,
        parentAlias,
        x: num(cols[6] ?? ""),
        y: num(cols[7] ?? ""),
        width: num(cols[8] ?? ""),
        height: num(cols[9] ?? ""),
        zIndex: num(cols[10] ?? ""),
      });
      continue;
    }

    if (tag === "r") {
      let relId = "";
      let type: TaskRelationType = "untyped";
      let source = "";
      let target = "";
      let label = "";
      if (cols.length >= 4 && !normalizeTaskRelationType(cols[2] ?? "")) {
        source = cols[1]!.trim();
        target = cols[2]!.trim();
        relId = generateUniqueTaskIdFromTaken(taken);
      } else if (cols.length >= 5) {
        relId = cols[1]!.trim() || generateUniqueTaskIdFromTaken(taken);
        type = normalizeTaskRelationType(cols[2] ?? "") ?? "untyped";
        source = cols[3]!.trim();
        target = cols[4]!.trim();
        label = parseCell(cols[5] ?? "");
      } else {
        continue;
      }
      const resolveEndpoint = (alias: string) => idMap.get(alias) ?? alias;
      relations.push({
        id: relId,
        type,
        sourceId: resolveEndpoint(source),
        targetId: resolveEndpoint(target),
        ...(label ? { label } : {}),
      });
      continue;
    }

    if (tag === "cg" && cols.length >= 7) {
      const g: CanvasGroup = {
        id: cols[1]!.trim(),
        label: parseCell(cols[2] ?? ""),
        x: num(cols[3] ?? "") ?? 0,
        y: num(cols[4] ?? "") ?? 0,
        width: num(cols[5] ?? "") ?? 100,
        height: num(cols[6] ?? "") ?? 80,
        ...(cols[7]?.trim() ? { color: cols[7].trim() } : {}),
      };
      const list = canvasGroups[cgCtx] ?? [];
      list.push(g);
      canvasGroups[cgCtx] = list;
    }
  }

  const aliasToReal = assignAliasIds(drafts, idMap, taken);
  const roots = buildForest(drafts, aliasToReal, idMap);
  if (!roots.length && scope !== "board") return null;

  const remappedRelations = remapRelationEndpoints(relations, aliasToReal, idMap);
  const safeRelations = sanitizeRelations(roots, remappedRelations);

  if (scope === "subtree") {
    const subtreeRoot = roots[0];
    if (!subtreeRoot) return null;
    return {
      scope,
      title,
      pathIds,
      subtreeRoot,
      payload: {
        roots: [],
        pathIds: [],
        columnTitleOverrides: {},
        relations: [],
      },
    };
  }

  if (scope === "context") {
    return {
      scope,
      title,
      pathIds,
      payload: {
        roots,
        pathIds,
        columnTitleOverrides: {},
        relations: safeRelations,
        canvasGroups,
      },
    };
  }

  const payload: BoardImportPayload = {
    roots,
    pathIds,
    columnTitleOverrides,
    relations: safeRelations,
    appearance,
    canvasGroups,
    ...(collapsedIds.length ? { collapsedIds } : {}),
    ...(cardCollapsedIds.length ? { cardCollapsedIds } : {}),
  };

  return { scope: "board", title, pathIds, payload };
}

export function boardImportPayloadFromEt2vText(text: string): BoardImportPayload | null {
  const decoded = decodeEt2vText(text);
  if (!decoded || decoded.scope !== "board") return null;
  return decoded.payload;
}
