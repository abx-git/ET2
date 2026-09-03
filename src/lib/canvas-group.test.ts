import { describe, expect, it } from "vitest";

import {
  containedNodeIds,
  defaultGroupColor,
  fitGroupToContents,
  groupRectAroundNodes,
  isNodeInsideGroup,
  parseCanvasGroup,
  parseCanvasGroupsMap,
  parseGroupColor,
  resizedGroupRect,
  type CanvasGroup,
} from "./canvas-group";
import type { TaskNode } from "@/types/task-node";

const group: CanvasGroup = { id: "g", label: "G", x: 0, y: 0, width: 200, height: 150 };

function card(id: string, x: number, y: number, width = 80, height = 40): TaskNode {
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
    x,
    y,
    width,
    height,
  };
}

describe("isNodeInsideGroup", () => {
  it("requires full containment", () => {
    expect(isNodeInsideGroup(10, 10, 80, 40, group)).toBe(true);
    expect(isNodeInsideGroup(10, 10, 220, 40, group)).toBe(false);
    expect(isNodeInsideGroup(-5, 10, 80, 40, group)).toBe(false);
  });
});

describe("containedNodeIds", () => {
  it("returns ids of fully enclosed cards", () => {
    const nodes: TaskNode[] = [card("in", 10, 10), card("out", 180, 10)];
    expect(containedNodeIds(nodes, group)).toEqual(["in"]);
  });
});

describe("parseGroupColor", () => {
  it("accepts palette ids and legacy class strings", () => {
    expect(parseGroupColor("sky")).toBe("sky");
    expect(parseGroupColor("bg-purple-50/60 border-purple-300")).toBe("violet");
    expect(parseGroupColor("nope")).toBeUndefined();
  });
});

describe("defaultGroupColor", () => {
  it("cycles the palette", () => {
    expect(defaultGroupColor(0)).toBe("sky");
    expect(defaultGroupColor(6)).toBe("sky");
  });
});

describe("groupRectAroundNodes / fitGroupToContents", () => {
  it("wraps cards with padding and header space", () => {
    const rect = groupRectAroundNodes([card("a", 40, 60, 100, 50)]);
    expect(rect).toEqual({ x: 20, y: 12, width: 160, height: 118 });
  });

  it("fits only currently contained members", () => {
    const g: CanvasGroup = { id: "g", label: "G", x: 0, y: 0, width: 200, height: 150 };
    const rect = fitGroupToContents(g, [card("in", 10, 40, 80, 40), card("out", 400, 10)]);
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeLessThan(10);
    expect(rect!.y).toBeLessThan(40);
    expect(rect!.x + rect!.width).toBeGreaterThan(90);
  });

  it("returns null for an empty group", () => {
    expect(fitGroupToContents(group, [card("out", 400, 10)])).toBeNull();
  });
});

describe("resizedGroupRect", () => {
  it("grows the east/south edges", () => {
    expect(resizedGroupRect({ x: 10, y: 20, width: 200, height: 150 }, "se", 40, 30)).toEqual({
      x: 10,
      y: 20,
      width: 240,
      height: 180,
    });
  });

  it("anchors the opposite edge when shrinking from north-west", () => {
    const next = resizedGroupRect({ x: 100, y: 100, width: 200, height: 160 }, "nw", 20, 10);
    expect(next.x).toBe(120);
    expect(next.y).toBe(110);
    expect(next.width).toBe(180);
    expect(next.height).toBe(150);
  });

  it("clamps to minimum size", () => {
    const next = resizedGroupRect({ x: 0, y: 0, width: 200, height: 160 }, "nw", 400, 400);
    expect(next.width).toBe(160);
    expect(next.height).toBe(100);
    expect(next.x).toBe(40);
    expect(next.y).toBe(60);
  });
});

describe("parseCanvasGroup / parseCanvasGroupsMap", () => {
  it("normalizes legacy colors and drops invalid entries", () => {
    const g = parseCanvasGroup({
      id: "g1",
      label: "Sprint",
      x: 1,
      y: 2,
      width: 300,
      height: 200,
      color: "bg-sky-50/60 border-sky-300",
    });
    expect(g?.color).toBe("sky");
    expect(parseCanvasGroupsMap({
      __root__: [g, { id: "" }, { id: "g1", x: 0, y: 0, width: 10, height: 10 }],
      gone: "nope",
    }).__root__).toHaveLength(1);
  });
});
