import { describe, expect, it } from "vitest";

import { ensureForestCanvasLayout, nodeHasCanvasPosition } from "@/lib/canvas-layout";
import { applyBoardPayloadToStore, boardJsonFromStoreState } from "@/lib/file-board-reconcile";
import {
  boardExportTextsEquivalent,
  boardImportPayloadFromExportText,
  isBoardSnapshot,
  parseExportedDocument,
  stringifyExportedDocument,
} from "@/lib/task-tree-json";
import { setTemplatesCacheForTests } from "@/lib/templates";
import { useTaskTreeStore } from "@/store/task-tree-store";

/** Minimal T2-shaped board (no appearance, relations, or canvas layout). */
function t2BoardJson(overrides?: {
  collapsedIds?: string[];
  cardCollapsedIds?: string[];
  omitCardCollapsedIds?: boolean;
  omitDescription?: boolean;
  omitEffort?: boolean;
}): string {
  const card: Record<string, unknown> = {
    id: "ROOTCARD1",
    title: "Root",
    tags: [],
    dueDate: null,
    reminderDate: null,
    children: [
      {
        id: "CHILD0001",
        title: "Child",
        description: "d",
        tags: [],
        dueDate: null,
        reminderDate: null,
        effort: 0,
        children: [],
      },
    ],
  };
  if (!overrides?.omitDescription) card.description = "";
  if (!overrides?.omitEffort) card.effort = 0;

  const doc: Record<string, unknown> = {
    format: "hierarchical-task-manager",
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    scope: "board",
    roots: [card],
    pathIds: [],
    columnTitleOverrides: {},
    showFullTree: false,
    cardFieldVisibility: {
      completedCheck: true,
      id: true,
      description: true,
      link: true,
      command: true,
      tags: true,
      effort: true,
      dueDate: true,
      reminderDate: true,
    },
  };
  if (overrides?.collapsedIds !== undefined) doc.collapsedIds = overrides.collapsedIds;
  if (!overrides?.omitCardCollapsedIds) {
    doc.cardCollapsedIds = overrides?.cardCollapsedIds ?? [];
  }
  return stringifyExportedDocument(doc as never);
}

describe("T2 board compatibility", () => {
  it("parses T2 board without appearance/relations/layout", () => {
    const text = t2BoardJson();
    const doc = parseExportedDocument(text);
    expect(isBoardSnapshot(doc)).toBe(true);
    if (!isBoardSnapshot(doc)) return;
    expect(doc.appearance).toBeUndefined();
    expect(doc.relations).toBeUndefined();
    expect(doc.roots[0]?.x).toBeUndefined();

    const payload = boardImportPayloadFromExportText(text);
    expect(payload).not.toBeNull();
    expect(payload!.relations).toEqual([]);
    expect(payload!.appearance?.canvas).toBeTruthy();
  });

  it("keeps empty cardCollapsedIds instead of inventing defaults", () => {
    const text = t2BoardJson({ collapsedIds: [], cardCollapsedIds: [] });
    const payload = boardImportPayloadFromExportText(text)!;
    expect(payload.collapsedIds).toEqual([]);
    expect(payload.cardCollapsedIds).toEqual([]);

    applyBoardPayloadToStore(payload);
    const s = useTaskTreeStore.getState();
    expect(s.collapsedIds).toEqual([]);
    expect(s.cardCollapsedIds).toEqual([]);
  });

  it("accepts cards missing description/effort (T2-tolerant)", () => {
    const text = t2BoardJson({ omitDescription: true, omitEffort: true });
    const doc = parseExportedDocument(text);
    expect(isBoardSnapshot(doc)).toBe(true);
    if (!isBoardSnapshot(doc)) return;
    expect(doc.roots[0]?.description).toBe("");
    expect(doc.roots[0]?.effort).toBe(0);
  });

  it("round-trips T2 board through store without false inequivalence", () => {
    setTemplatesCacheForTests([]);
    const text = t2BoardJson({ collapsedIds: [], cardCollapsedIds: [] });
    const payload = boardImportPayloadFromExportText(text)!;
    applyBoardPayloadToStore(payload);
    const fromStore = boardJsonFromStoreState();
    expect(boardExportTextsEquivalent(text, fromStore)).toBe(true);
  });

  it("ensureForestCanvasLayout fills missing positions on every level", () => {
    const payload = boardImportPayloadFromExportText(t2BoardJson())!;
    const laid = ensureForestCanvasLayout(payload.roots);
    expect(nodeHasCanvasPosition(laid[0]!)).toBe(true);
    expect(nodeHasCanvasPosition(laid[0]!.children[0]!)).toBe(true);
  });
});
