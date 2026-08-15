import { describe, expect, it } from "vitest";

import { findCardAtWorldPoint, relationAnchors } from "@/lib/connector-geometry";
import type { TaskNode } from "@/types/task-node";

function card(
  id: string,
  opts: Partial<Pick<TaskNode, "x" | "y" | "width" | "height">> = {},
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
});
