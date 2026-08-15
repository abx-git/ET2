import { describe, expect, it } from "vitest";

import { ensureCanvasLayout, nodeHasCanvasPosition } from "@/lib/canvas-layout";
import {
  canConnectSiblings,
  parseTaskRelations,
  sanitizeRelations,
} from "@/lib/task-relations";
import {
  buildBoardSnapshot,
  parseExportedDocument,
  taskNodeFromJson,
  type BoardSnapshotV1,
} from "@/lib/task-tree-json";
import { DEFAULT_CARD_FIELD_VISIBILITY } from "@/lib/card-field-visibility";
import type { TaskNode } from "@/types/task-node";
import type { TaskRelation } from "@/types/task-relation";

function card(id: string, title: string, children: TaskNode[] = []): TaskNode {
  return {
    id,
    title,
    link: "",
    description: "",
    tags: [],
    dueDate: null,
    reminderDate: null,
    effort: 0,
    children,
  };
}

describe("canvas layout", () => {
  it("assigns positions to nodes without x/y", () => {
    const nodes = [card("a", "A"), card("b", "B")];
    const laid = ensureCanvasLayout(nodes);
    expect(nodeHasCanvasPosition(laid[0]!)).toBe(true);
    expect(nodeHasCanvasPosition(laid[1]!)).toBe(true);
    expect(laid[0]!.x).not.toBe(laid[1]!.x);
  });

  it("keeps existing positions", () => {
    const nodes = [{ ...card("a", "A"), x: 10, y: 20 }];
    const laid = ensureCanvasLayout(nodes);
    expect(laid).toBe(nodes);
  });
});

describe("task relations", () => {
  it("keeps only sibling edges", () => {
    const roots = [
      card("p", "Parent", [card("c1", "C1"), card("c2", "C2")]),
      card("r2", "Root2"),
    ];
    const relations: TaskRelation[] = [
      { id: "rel1", sourceId: "c1", targetId: "c2", type: "precedes" },
      { id: "rel2", sourceId: "c1", targetId: "r2", type: "untyped" },
      { id: "rel3", sourceId: "missing", targetId: "c2", type: "untyped" },
    ];
    const clean = sanitizeRelations(roots, relations);
    expect(clean.map((r) => r.id)).toEqual(["rel1"]);
    expect(canConnectSiblings(roots, "c1", "c2")).toBe(true);
    expect(canConnectSiblings(roots, "c1", "r2")).toBe(false);
  });

  it("roundtrips relations and canvas layout in board JSON", () => {
    const roots: TaskNode[] = [
      { ...card("a", "Alpha"), x: 100, y: 80, width: 220, height: 120 },
      { ...card("b", "Beta"), x: 400, y: 80 },
    ];
    const relations: TaskRelation[] = [
      { id: "r1", sourceId: "a", targetId: "b", type: "assigns", label: "meldet" },
    ];
    const snap = buildBoardSnapshot(
      roots,
      [],
      {},
      DEFAULT_CARD_FIELD_VISIBILITY,
      false,
      true,
      [],
      "Erledigt",
      [],
      [],
      [],
      [],
      [],
      [],
      "expand",
      "and",
      "steel",
      [],
      relations,
    );
    expect(snap.relations?.length).toBe(1);
    expect(snap.roots[0]?.x).toBe(100);

    const text = JSON.stringify(snap);
    const doc = parseExportedDocument(text) as BoardSnapshotV1;
    expect(doc.relations?.[0]?.type).toBe("assigns");
    const restored = doc.roots.map(taskNodeFromJson);
    expect(restored[0]?.x).toBe(100);
    expect(restored[1]?.y).toBe(80);
  });

  it("parses relation arrays defensively and migrates legacy types", () => {
    expect(parseTaskRelations([{ id: "1", sourceId: "a", targetId: "b", type: "precedes" }])).toHaveLength(1);
    expect(parseTaskRelations([{ id: "1", sourceId: "a", targetId: "b", type: "temporal" }])[0]?.type).toBe(
      "precedes",
    );
    expect(parseTaskRelations([{ id: "1", sourceId: "a", targetId: "b", type: "organizational" }])[0]?.type).toBe(
      "assigns",
    );
    expect(parseTaskRelations([{ id: "1", sourceId: "a", targetId: "b", type: "other" }])[0]?.type).toBe(
      "untyped",
    );
    expect(parseTaskRelations([{ id: "1" }])).toHaveLength(0);
    expect(parseTaskRelations("nope")).toHaveLength(0);
  });
});
