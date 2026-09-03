import { describe, expect, it } from "vitest";

import {
  exportCanvasAsMermaid,
  looksLikeMermaid,
  parseMermaidToCanvas,
  remapMermaidImport,
} from "./canvas-mermaid";
import { isNoteNode, isSymbolNode } from "./tree-node-kind";
import type { TaskNode } from "@/types/task-node";
import type { TaskRelation } from "@/types/task-relation";

const card = (id: string, title: string, extras?: Partial<TaskNode>): TaskNode => ({
  id,
  title,
  link: "",
  description: "",
  tags: [],
  dueDate: null,
  reminderDate: null,
  effort: 0,
  children: [],
  x: 0,
  y: 0,
  width: 220,
  height: 120,
  ...extras,
});

describe("looksLikeMermaid", () => {
  it("detects fenced and bare flowcharts", () => {
    expect(looksLikeMermaid("flowchart TD\n  A --> B")).toBe(true);
    expect(looksLikeMermaid("```mermaid\ngraph LR\nA-->B\n```")).toBe(true);
    expect(looksLikeMermaid("mindmap\n  Root")).toBe(true);
    expect(looksLikeMermaid("{ \"roots\": [] }")).toBe(false);
  });
});

describe("parseMermaidToCanvas", () => {
  it("imports a labeled flowchart with shapes", () => {
    const src = `
flowchart TD
  start([Start]) --> decide{Weiter?}
  decide -->|ja| work[Arbeit]
  decide -->|nein| done([Ende])
`;
    const imp = parseMermaidToCanvas(src);
    expect(imp.kind).toBe("flowchart");
    expect(imp.nodes.map((n) => n.title).sort()).toEqual(["Arbeit", "Ende", "Start", "Weiter?"]);
    const decide = imp.nodes.find((n) => n.title === "Weiter?");
    expect(isSymbolNode(decide!)).toBe(true);
    expect(decide?.symbolType).toBe("decision");
    const start = imp.nodes.find((n) => n.title === "Start");
    expect(start?.symbolType).toBe("terminator");
    expect(imp.relations).toHaveLength(3);
  });

  it("maps edge styles and German type labels", () => {
    const src = `
flowchart LR
  a[A] -->|geht voraus| b[B]
  b --x|blockiert| c[C]
  a -.->|informiert| c
`;
    const imp = parseMermaidToCanvas(src);
    const by = (from: string, to: string) =>
      imp.relations.find((r) => {
        const s = imp.nodes.find((n) => n.id === r.sourceId)?.title;
        const t = imp.nodes.find((n) => n.id === r.targetId)?.title;
        return s === from && t === to;
      });
    expect(by("A", "B")?.type).toBe("precedes");
    expect(by("B", "C")?.type).toBe("blocks");
    expect(by("A", "C")?.type).toBe("informs");
  });

  it("imports subgraphs as groups", () => {
    const src = `
flowchart LR
  subgraph sprint [Sprint 1]
    a[Alpha]
    b[Beta]
  end
  a --> b
`;
    const imp = parseMermaidToCanvas(src);
    expect(imp.groups).toHaveLength(1);
    expect(imp.groups[0]?.label).toBe("Sprint 1");
    expect(imp.groups[0]?.memberIds).toHaveLength(2);
  });

  it("roundtrips cards, notes, symbols, relations and classes", () => {
    const nodes: TaskNode[] = [
      card("c1", "Karte A", { kind: "card", x: 0, y: 0 }),
      card("n1", "Memo", { kind: "note", markdown: "Hi", x: 300, y: 0, width: 240, height: 160 }),
      card("d1", "OK?", { kind: "symbol", symbolType: "decision", x: 150, y: 180, width: 120, height: 120 }),
    ];
    const relations: TaskRelation[] = [
      { id: "r1", sourceId: "c1", targetId: "d1", type: "precedes" },
      { id: "r2", sourceId: "d1", targetId: "n1", type: "untyped", label: "weiter" },
    ];
    const mermaid = exportCanvasAsMermaid(nodes, relations);
    expect(mermaid).toContain("flowchart");
    expect(mermaid).toContain("et2-card");
    expect(mermaid).toContain("et2-note");
    expect(mermaid).toContain("et2-symbol-decision");
    const back = parseMermaidToCanvas(mermaid);
    expect(back.nodes).toHaveLength(3);
    expect(back.nodes.filter((n) => n.kind === "card" || !n.kind).some((n) => n.title === "Karte A")).toBe(true);
    expect(back.nodes.some((n) => isNoteNode(n) && n.title === "Memo")).toBe(true);
    expect(back.nodes.some((n) => n.symbolType === "decision" && n.title === "OK?")).toBe(true);
    expect(back.relations.some((r) => r.type === "precedes")).toBe(true);
    expect(back.relations.some((r) => r.label === "weiter")).toBe(true);
  });

  it("roundtrips ERM entity class", () => {
    const nodes: TaskNode[] = [
      card("e1", "Kunde", { kind: "symbol", symbolType: "entity", x: 0, y: 0, width: 200, height: 140 }),
    ];
    const mermaid = exportCanvasAsMermaid(nodes, []);
    expect(mermaid).toContain("et2-symbol-entity");
    const back = parseMermaidToCanvas(mermaid);
    expect(back.nodes[0]?.symbolType).toBe("entity");
    expect(back.nodes[0]?.title).toBe("Kunde");
  });

  it("imports a mindmap as nested cards", () => {
    const src = `
mindmap
  Root
    Child
      Grand
    Sibling
`;
    const imp = parseMermaidToCanvas(src);
    expect(imp.kind).toBe("mindmap");
    expect(imp.nodes).toHaveLength(1);
    expect(imp.nodes[0]?.title).toBe("Root");
    expect(imp.nodes[0]?.children.map((c) => c.title)).toEqual(["Child", "Sibling"]);
    expect(imp.nodes[0]?.children[0]?.children[0]?.title).toBe("Grand");
  });

  it("rejects unknown text", () => {
    expect(() => parseMermaidToCanvas("hello")).toThrow(/Flowchart oder -Mindmap/);
  });
});

describe("remapMermaidImport", () => {
  it("replaces mermaid ids with fresh ones", () => {
    const imp = parseMermaidToCanvas("flowchart TD\n  A[A] --> B[B]");
    const remapped = remapMermaidImport(imp, new Set(["A"]));
    expect(remapped.nodes.every((n) => n.id !== "A" && n.id !== "B")).toBe(true);
    const titles = new Map(remapped.nodes.map((n) => [n.title, n.id]));
    expect(remapped.relations[0]?.sourceId).toBe(titles.get("A"));
    expect(remapped.relations[0]?.targetId).toBe(titles.get("B"));
  });
});
