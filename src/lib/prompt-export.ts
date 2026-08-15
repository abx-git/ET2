import type { TaskNode } from "@/types/task-node";
import type { TaskRelation } from "@/types/task-relation";
import { relationArrowLabel, TASK_RELATION_TYPE_LABELS } from "@/types/task-relation";
import { isNoteNode } from "@/lib/tree-node-kind";
import { taskLinkHref } from "@/lib/task-link";

function formatRelationLine(srcTitle: string, tgtTitle: string, rel: TaskRelation): string {
  const arrow = `${srcTitle} → ${tgtTitle}`;
  const label = relationArrowLabel(rel);
  if (!label) return `- ${arrow}`;
  if (rel.label?.trim() && rel.type !== "untyped") {
    return `- ${arrow} [${TASK_RELATION_TYPE_LABELS[rel.type]}: ${rel.label.trim()}]`;
  }
  return `- ${arrow} [${label}]`;
}

/**
 * Exportiert alle Karten einer Canvas-Ansicht als strukturierten Text-Prompt.
 * Berücksichtigt Eigenschaften (Tags, Links, Due Dates, Effort) und Verbinder (Relations).
 */
export function exportCanvasAsPrompt(
  nodes: TaskNode[],
  relations: TaskRelation[],
  options?: { includePositions?: boolean; contextTitle?: string },
): string {
  const lines: string[] = [];
  const { includePositions = false, contextTitle } = options ?? {};

  if (contextTitle) {
    lines.push(`# Kontext: ${contextTitle}`);
    lines.push("");
  }

  lines.push(`## Karten (${nodes.length})`);
  lines.push("");

  for (const node of nodes) {
    if (isNoteNode(node)) {
      lines.push(`### [Notiz] ${node.title || "(Ohne Titel)"}`);
      if (node.markdown?.trim()) {
        lines.push("");
        lines.push(node.markdown.trim());
      }
    } else {
      lines.push(`### ${node.title || "(Ohne Titel)"}`);
      if (node.description?.trim()) {
        lines.push(`Beschreibung: ${node.description.trim()}`);
      }
      const href = taskLinkHref(node.link);
      if (href) {
        lines.push(`Link: ${href}`);
      }
      if (node.tags.length > 0) {
        lines.push(`Tags: ${node.tags.join(", ")}`);
      }
      if (node.dueDate) {
        lines.push(`Fällig: ${node.dueDate instanceof Date ? node.dueDate.toISOString().slice(0, 10) : String(node.dueDate)}`);
      }
      if (node.effort > 0) {
        const unit = node.effortUnit === "minutes" ? "min" : node.effortUnit === "workdays" ? "Tage" : "h";
        lines.push(`Aufwand: ${node.effort} ${unit}`);
      }
      if (node.children.length > 0) {
        lines.push(`Unterkarten: ${node.children.length}`);
        for (const child of node.children) {
          if (isNoteNode(child)) {
            const title = child.title || child.markdown?.split("\n")[0]?.replace(/^#+\s*/, "") || "Notiz";
            lines.push(`  - [Notiz] ${title}`);
          } else {
            lines.push(`  - ${child.title || "(Ohne Titel)"}`);
          }
        }
      }
    }
    if (includePositions && node.x != null && node.y != null) {
      lines.push(`Position: (${Math.round(node.x)}, ${Math.round(node.y)})`);
    }
    lines.push("");
  }

  // Relations / Connections
  if (relations.length > 0) {
    lines.push(`## Verbindungen (${relations.length})`);
    lines.push("");
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const rel of relations) {
      const src = nodeMap.get(rel.sourceId);
      const tgt = nodeMap.get(rel.targetId);
      if (!src || !tgt) continue;
      const srcLabel = src.title || "(Ohne Titel)";
      const tgtLabel = tgt.title || "(Ohne Titel)";
      lines.push(formatRelationLine(srcLabel, tgtLabel, rel));
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Exportiert den gesamten Baum unter einem Kontext rekursiv als Prompt.
 */
export function exportTreeAsPrompt(
  nodes: TaskNode[],
  relations: TaskRelation[],
  options?: { contextTitle?: string; maxDepth?: number },
): string {
  const lines: string[] = [];
  const { contextTitle, maxDepth = 10 } = options ?? {};

  if (contextTitle) {
    lines.push(`# ${contextTitle}`);
    lines.push("");
  }

  const renderNode = (node: TaskNode, depth: number, prefix: string) => {
    if (depth > maxDepth) return;
    const indent = "  ".repeat(depth);

    if (isNoteNode(node)) {
      lines.push(`${indent}${prefix}[Notiz] ${node.title || node.markdown?.split("\n")[0]?.replace(/^#+\s*/, "") || "Notiz"}`);
      if (node.markdown?.trim()) {
        for (const line of node.markdown.trim().split("\n").slice(0, 5)) {
          lines.push(`${indent}  ${line}`);
        }
      }
    } else {
      lines.push(`${indent}${prefix}${node.title || "(Ohne Titel)"}`);
      const meta: string[] = [];
      const href = taskLinkHref(node.link);
      if (href) meta.push(`Link: ${href}`);
      if (node.tags.length > 0) meta.push(`Tags: ${node.tags.join(", ")}`);
      if (node.description?.trim()) meta.push(`Beschreibung: ${node.description.trim().replace(/\n/g, " | ")}`);
      if (meta.length > 0) {
        lines.push(`${indent}  ${meta.join(" | ")}`);
      }
    }

    for (const child of node.children) {
      renderNode(child, depth + 1, "- ");
    }
  };

  for (const node of nodes) {
    renderNode(node, 0, "- ");
  }

  if (relations.length > 0) {
    lines.push("");
    lines.push("## Verbindungen");
    const nodeMap = new Map<string, TaskNode>();
    const addToMap = (n: TaskNode) => { nodeMap.set(n.id, n); n.children.forEach(addToMap); };
    nodes.forEach(addToMap);
    for (const rel of relations) {
      const src = nodeMap.get(rel.sourceId);
      const tgt = nodeMap.get(rel.targetId);
      if (!src || !tgt) continue;
      const typeLabel = relationArrowLabel(rel) || TASK_RELATION_TYPE_LABELS[rel.type];
      lines.push(
        typeLabel
          ? `- ${src.title || "?"} → ${tgt.title || "?"} [${typeLabel}]`
          : `- ${src.title || "?"} → ${tgt.title || "?"}`,
      );
    }
  }

  return lines.join("\n");
}
