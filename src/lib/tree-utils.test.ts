import { describe, expect, it } from "vitest";

import { translateNodesBy, updateNodeFields } from "@/lib/tree-utils";
import type { TaskNode } from "@/types/task-node";

function card(id: string, x: number, y: number, children: TaskNode[] = []): TaskNode {
  return {
    id,
    title: id,
    link: "",
    description: "",
    tags: [],
    dueDate: null,
    reminderDate: null,
    effort: 0,
    children,
    x,
    y,
  };
}

describe("updateNodeFields", () => {
  it("keeps sibling identity when updating another node", () => {
    const b = card("b", 80, 90);
    const roots = [card("a", 10, 20), b];
    const next = updateNodeFields(roots, "a", { x: 40, y: 60 });
    expect(next).not.toBe(roots);
    expect(next[0]?.x).toBe(40);
    expect(next[1]).toBe(b);
  });

  it("returns the same forest when the id is missing", () => {
    const roots = [card("a", 10, 20)];
    expect(updateNodeFields(roots, "missing", { x: 1 })).toBe(roots);
  });
});

describe("translateNodesBy", () => {
  it("moves only matching ids and preserves other node identity", () => {
    const child = card("child", 1, 1);
    const b = card("b", 80, 90);
    const a = card("a", 10, 20, [child]);
    const roots = [a, b];
    const next = translateNodesBy(roots, new Set(["a"]), 5, 7);
    expect(next[0]?.x).toBe(15);
    expect(next[0]?.y).toBe(27);
    expect(next[0]?.children[0]).toBe(child);
    expect(next[1]).toBe(b);
  });

  it("returns the same forest for a zero delta", () => {
    const roots = [card("a", 10, 20)];
    expect(translateNodesBy(roots, new Set(["a"]), 0, 0)).toBe(roots);
  });
});
