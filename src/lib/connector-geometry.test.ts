import { describe, expect, it } from "vitest";

import {
  diamondEdgePoint,
  ellipseEdgePoint,
  findCardAtWorldPoint,
  relationAnchors,
} from "@/lib/connector-geometry";
import type { TaskNode } from "@/types/task-node";

function card(
  id: string,
  opts: Partial<Pick<TaskNode, "x" | "y" | "width" | "height" | "kind" | "symbolType" | "zIndex">> = {},
): TaskNode {
  return {
    id,
    title: id,
    link: "",
    description: "",
    tags: [],
    dueDate: null,
    reminderDate: null,
    effort: 0,
    children: [],
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    width: opts.width ?? 200,
    height: opts.height ?? 100,
    ...(opts.kind ? { kind: opts.kind } : {}),
    ...(opts.symbolType ? { symbolType: opts.symbolType } : {}),
    ...(opts.zIndex !== undefined ? { zIndex: opts.zIndex } : {}),
  };
}

describe("findCardAtWorldPoint", () => {
  it("returns the top-most card under the point", () => {
    const a = card("a", { x: 0, y: 0 });
    const b = card("b", { x: 50, y: 50 });
    expect(findCardAtWorldPoint([a, b], 60, 60)?.id).toBe("b");
    expect(findCardAtWorldPoint([a, b], 10, 10)?.id).toBe("a");
  });

  it("respects exclude ids", () => {
    const a = card("a", { x: 0, y: 0 });
    expect(findCardAtWorldPoint([a], 10, 10, ["a"])).toBeNull();
  });

  it("prefers symbols inside a system boundary over the boundary", () => {
    const boundary = card("bound", {
      kind: "symbol",
      symbolType: "systemBoundary",
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      zIndex: 0,
    });
    const inner = card("uc", {
      kind: "symbol",
      symbolType: "useCase",
      x: 100,
      y: 100,
      width: 160,
      height: 80,
      zIndex: 10,
    });
    expect(findCardAtWorldPoint([boundary, inner], 120, 120)?.id).toBe("uc");
    expect(findCardAtWorldPoint([inner, boundary], 120, 120)?.id).toBe("uc");
    expect(findCardAtWorldPoint([boundary, inner], 10, 10)?.id).toBe("bound");
  });
});

describe("relationAnchors", () => {
  it("places endpoints on card edges", () => {
    const a = card("a", { x: 0, y: 0, width: 100, height: 100 });
    const b = card("b", { x: 200, y: 0, width: 100, height: 100 });
    const { start, end } = relationAnchors(a, b);
    expect(start.x).toBeCloseTo(100);
    expect(start.y).toBeCloseTo(50);
    expect(end.x).toBeCloseTo(200);
    expect(end.y).toBeCloseTo(50);
  });

  it("anchors to ellipse and diamond edges for symbols", () => {
    const ellipse = card("uc", {
      kind: "symbol",
      symbolType: "useCase",
      x: 0,
      y: 0,
      width: 160,
      height: 80,
    });
    const diamond = card("dec", {
      kind: "symbol",
      symbolType: "decision",
      x: 300,
      y: -20,
      width: 120,
      height: 120,
    });
    const { start, end } = relationAnchors(ellipse, diamond);
    // Centers aligned on y=40 → right tip of ellipse / left tip of diamond
    expect(start.x).toBeCloseTo(160, 0);
    expect(start.y).toBeCloseTo(40, 0);
    expect(end.x).toBeCloseTo(300, 0);
    expect(end.y).toBeCloseTo(40, 0);
  });
});

describe("ellipseEdgePoint / diamondEdgePoint", () => {
  it("hits the right tip of a diamond", () => {
    const p = diamondEdgePoint({ x: 0, y: 0, w: 100, h: 100 }, { x: 200, y: 50 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
  });

  it("hits the right tip of an ellipse", () => {
    const p = ellipseEdgePoint({ x: 0, y: 0, w: 100, h: 50 }, { x: 200, y: 25 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(25);
  });
});
