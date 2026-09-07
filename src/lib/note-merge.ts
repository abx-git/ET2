/**
 * Karte ↔ Notiz: Umwandeln und Markdown beim Drop auf eine Notiz zusammenführen.
 * Drop löst die Quelle auf: Titel, Links, Text und Nachkommen werden Notiz-Markdown.
 */

import { markdownLinkListItem } from "@/lib/task-link";
import { isNoteNode, normalizeNoteMarkdown } from "@/lib/tree-node-kind";
import {
  detachNodeById,
  findNodeById,
  subtreeContainsId,
} from "@/lib/tree-utils";
import type { TaskNode } from "@/types/task-node";

/** Körper einer Karte/Notiz als Markdown-Block (ohne äußeren Titel). */
export function nodeBodyAsMarkdown(node: TaskNode): string {
  if (isNoteNode(node)) {
    return normalizeNoteMarkdown(node.markdown ?? "").trim();
  }
  return (node.description ?? "").replace(/\r\n/g, "\n").trim();
}

function indentMarkdown(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line.length === 0 ? "" : `${pad}${line}`))
    .join("\n");
}

function joinMarkdownParts(parts: string[]): string {
  return parts
    .map((p) => p.replace(/\s+$/, ""))
    .filter((p) => p.trim().length > 0)
    .join("\n\n");
}

function joinSiblingContributions(parts: string[]): string {
  const allList = parts.every((p) => p.trimStart().startsWith("- "));
  return parts.join(allList ? "\n" : "\n\n");
}

type OwnBlocks = { lead: string; isList: boolean; rest: string };

function nodeOwnBlocks(node: TaskNode, asList: boolean): OwnBlocks {
  const body = nodeBodyAsMarkdown(node);
  const title = node.title.trim();
  const linkLine = isNoteNode(node) ? null : markdownLinkListItem(node.title, node.link);

  if (linkLine) {
    return { lead: linkLine, isList: true, rest: body };
  }

  if (asList) {
    if (!title) return { lead: "", isList: false, rest: body };
    return { lead: `- ${title}`, isList: true, rest: body };
  }

  if (title && body) return { lead: `## ${title}`, isList: false, rest: body };
  if (title) return { lead: `## ${title}`, isList: false, rest: "" };
  return { lead: "", isList: false, rest: body };
}

/**
 * Markdown-Beitrag einer Quelle inkl. Nachkommen.
 * Karten mit Link werden zur Link-Liste (`- [Titel](url)`), Kinder darunter eingerückt.
 */
export function sourceContributionMarkdown(source: TaskNode, asList = false): string {
  const { lead, isList, rest } = nodeOwnBlocks(source, asList);
  const childAsList = isList || asList;
  const childParts = source.children
    .map((child) => sourceContributionMarkdown(child, childAsList))
    .filter((block) => block.trim().length > 0);

  const ownParts: string[] = [];
  if (lead) ownParts.push(lead);
  if (rest) ownParts.push(isList ? indentMarkdown(rest, 2) : rest);
  const own = joinMarkdownParts(ownParts);

  if (childParts.length === 0) return own;
  const childrenMd = joinSiblingContributions(childParts);
  if (!own) return childrenMd;
  if (isList) return `${own}\n${indentMarkdown(childrenMd, 2)}`;
  return `${own}\n\n${childrenMd}`;
}

export function appendMarkdownBlocks(existing: string, incoming: string): string {
  const a = normalizeNoteMarkdown(existing).trimEnd();
  const b = normalizeNoteMarkdown(incoming).trim();
  if (!b) return normalizeNoteMarkdown(existing);
  if (!a.trim()) return `${b}\n`;
  return `${a}\n\n${b}\n`;
}

/** Karte → Notiz (gleiche ID/Kinder); Beschreibung und Link werden Markdown. */
export function convertCardNodeToNote(node: TaskNode): TaskNode {
  if (isNoteNode(node)) return node;
  const linkItem = markdownLinkListItem(node.title, node.link);
  const body = nodeBodyAsMarkdown(node);
  const markdown = joinMarkdownParts([linkItem ?? "", body]);
  return {
    id: node.id,
    kind: "note",
    title: node.title,
    markdown: markdown ? `${markdown}\n` : "",
    link: "",
    command: "",
    description: "",
    tags: [],
    dueDate: null,
    reminderDate: null,
    effort: 0,
    children: node.children,
  };
}

export function convertCardToNoteInForest(roots: TaskNode[], nodeId: string): TaskNode[] {
  let found = false;
  function mapNodes(nodes: TaskNode[]): TaskNode[] {
    return nodes.map((n) => {
      if (n.id === nodeId) {
        found = true;
        if (isNoteNode(n)) return n;
        return convertCardNodeToNote(n);
      }
      if (n.children.length === 0) return n;
      return { ...n, children: mapNodes(n.children) };
    });
  }
  const next = mapNodes(roots);
  return found ? next : roots;
}

function replaceNoteMarkdown(roots: TaskNode[], targetNoteId: string, markdown: string): TaskNode[] {
  let replaced = false;
  function mapNodes(nodes: TaskNode[]): TaskNode[] {
    return nodes.map((n) => {
      if (n.id === targetNoteId) {
        replaced = true;
        return {
          ...n,
          kind: "note" as const,
          markdown,
          children: n.children,
        };
      }
      if (n.children.length === 0) return n;
      return { ...n, children: mapNodes(n.children) };
    });
  }
  const next = mapNodes(roots);
  return replaced ? next : roots;
}

/**
 * Quelle in Ziel-Notiz mergen: Inhalt als Markdown anhängen, Quelle inkl. Kinder auflösen.
 * `null` = Ziel ist keine Notiz (Caller soll nesten).
 * Unveränderte `roots` = ungültiger Drop.
 */
export function applyMergeIntoNote(
  roots: TaskNode[],
  sourceId: string,
  targetNoteId: string,
): TaskNode[] | null {
  const target = findNodeById(roots, targetNoteId);
  if (!target || !isNoteNode(target)) return null;

  const source = findNodeById(roots, sourceId);
  if (!source) return roots;
  if (sourceId === targetNoteId || subtreeContainsId(source, targetNoteId)) return roots;

  const nextMarkdown = appendMarkdownBlocks(target.markdown ?? "", sourceContributionMarkdown(source));
  const { next: withoutSource, detached } = detachNodeById(roots, sourceId);
  if (!detached) return roots;

  return replaceNoteMarkdown(withoutSource, targetNoteId, nextMarkdown);
}

/**
 * Externen Knoten (z. B. Zwischenablage) in eine Notiz mergen.
 * `null` = Ziel ist keine Notiz.
 */
export function mergeExternalNodeIntoNote(
  roots: TaskNode[],
  insert: TaskNode,
  targetNoteId: string,
): TaskNode[] | null {
  const target = findNodeById(roots, targetNoteId);
  if (!target || !isNoteNode(target)) return null;
  if (insert.id === targetNoteId || subtreeContainsId(insert, targetNoteId)) return roots;

  const nextMarkdown = appendMarkdownBlocks(target.markdown ?? "", sourceContributionMarkdown(insert));
  return replaceNoteMarkdown(roots, targetNoteId, nextMarkdown);
}
