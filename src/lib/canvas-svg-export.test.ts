import { describe, expect, it } from "vitest";

import { buildCanvasSvg, extractDrawioMxfileFromSvg } from "./canvas-svg-export";
import type { CanvasGroup } from "./canvas-group";
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
  x: 80,
  y: 80,
  width: 220,
  height: 120,
  ...extras,
});

describe("buildCanvasSvg", () => {
  it("emits SVG primitives instead of HTML foreignObject", () => {
    const svg = buildCanvasSvg({ nodes: [card("a", "Alpha")] });
    expect(svg.startsWith("<?xml")).toBe(true);
    expect(svg).toContain("<svg ");
    expect(svg).toContain("<rect ");
    expect(svg).toContain("<text ");
    expect(svg).not.toContain("foreignObject");
    expect(svg).not.toContain("http://www.w3.org/1999/xhtml");
  });

  it("keeps ET2 world coordinates for cards", () => {
    const svg = buildCanvasSvg({
      nodes: [card("a", "Alpha", { x: 120, y: 40, width: 220, height: 120 })],
    });
    expect(svg).toContain('data-et2-id="a"');
    expect(svg).toContain('data-et2-kind="card"');
    expect(svg).toMatch(/<rect x="120" y="40" width="220" height="120"/);
    expect(svg).toContain(">Alpha</text>");
  });

  it("draws connectors on the same edge anchors as the canvas", () => {
    const nodes = [
      card("a", "A", { x: 0, y: 0, width: 100, height: 50 }),
      card("b", "B", { x: 200, y: 0, width: 100, height: 50 }),
    ];
    const relations: TaskRelation[] = [{ id: "r1", sourceId: "a", targetId: "b", type: "precedes" }];
    const svg = buildCanvasSvg({ nodes, relations });
    expect(svg).toContain('data-et2-kind="relation"');
    expect(svg).toMatch(/<line x1="100" y1="25" x2="200" y2="25"/);
    expect(svg).toContain("#0f766e");
  });

  it("renders flowchart and use-case symbols as paths/ellipses", () => {
    const nodes = [
      card("u", "Login", { kind: "symbol", symbolType: "useCase", x: 10, y: 10, width: 160, height: 80 }),
      card("d", "OK?", { kind: "symbol", symbolType: "decision", x: 200, y: 10, width: 120, height: 120 }),
    ];
    const svg = buildCanvasSvg({ nodes });
    expect(svg).toContain('data-et2-symbol="useCase"');
    expect(svg).toContain("<ellipse ");
    expect(svg).toContain('data-et2-symbol="decision"');
    expect(svg).toContain("<polygon ");
  });

  it("includes groups behind cards", () => {
    const groups: CanvasGroup[] = [
      { id: "g1", label: "Sprint", x: 20, y: 20, width: 400, height: 300, color: "bg-sky-50/60 border-sky-300" },
    ];
    const svg = buildCanvasSvg({ nodes: [card("a", "Alpha")], groups });
    const groupAt = svg.indexOf('data-et2-kind="group"');
    const cardAt = svg.indexOf('data-et2-kind="card"');
    expect(groupAt).toBeGreaterThan(-1);
    expect(cardAt).toBeGreaterThan(groupAt);
    expect(svg).toContain(">Sprint</text>");
  });

  it("escapes XML in titles", () => {
    const svg = buildCanvasSvg({ nodes: [card("a", `A <B> & "C"`)] });
    expect(svg).toContain("A &lt;B&gt; &amp; &quot;C&quot;");
    expect(svg).not.toContain("A <B>");
  });

  it("embeds a draw.io mxfile with matching geometry", () => {
    const nodes = [
      card("a", "Alpha", { x: 80, y: 90, width: 220, height: 120 }),
      card("b", "Beta", { x: 400, y: 90, width: 220, height: 120 }),
    ];
    const relations: TaskRelation[] = [{ id: "r1", sourceId: "a", targetId: "b", type: "blocks" }];
    const svg = buildCanvasSvg({ nodes, relations });
    const mxfile = extractDrawioMxfileFromSvg(svg);
    expect(mxfile).toBeTruthy();
    expect(mxfile).toContain("<mxfile ");
    expect(mxfile).toContain("<mxGraphModel ");
    expect(mxfile).toContain('x="80" y="90" width="220" height="120"');
    expect(mxfile).toContain('x="400" y="90" width="220" height="120"');
    expect(mxfile).toContain('source="n_a"');
    expect(mxfile).toContain('target="n_b"');
    expect(mxfile).toContain("strokeColor=#be123c");
    expect(mxfile).toContain("exitX=");
    expect(mxfile).toContain("entryX=");
  });

  it("applies rotation around the card center", () => {
    const svg = buildCanvasSvg({
      nodes: [card("a", "Tilt", { x: 0, y: 0, width: 100, height: 50, rotation: 15 })],
    });
    expect(svg).toContain('transform="rotate(15 50 25)"');
  });
});
