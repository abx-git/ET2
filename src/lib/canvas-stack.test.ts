import { describe, expect, it } from "vitest";

import {
  compareCanvasStackOrder,
  computeCanvasZIndexPatches,
  resolveCanvasZIndex,
} from "@/lib/canvas-stack";
import { createBlankSymbolNode } from "@/lib/tree-node-kind";
import type { TaskNode } from "@/types/task-node";

function card(id: string, zIndex?: number): TaskNode {
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
    ...(zIndex !== undefined ? { zIndex } : {}),
  };
}

describe("canvas-stack", () => {
  it("defaults systemBoundary behind other symbols", () => {
    const boundary = createBlankSymbolNode("b", "systemBoundary");
    const process = createBlankSymbolNode("p", "process");
    expect(resolveCanvasZIndex(boundary)).toBeLessThan(resolveCanvasZIndex(process));
  });

  it("bring to front sets above max sibling", () => {
    const siblings = [
      createBlankSymbolNode("a", "process"),
      createBlankSymbolNode("b", "decision"),
      createBlankSymbolNode("c", "systemBoundary"),
    ];
    siblings[0]!.zIndex = 10;
    siblings[1]!.zIndex = 12;
    siblings[2]!.zIndex = 0;
    expect(computeCanvasZIndexPatches(siblings, "c", "front")).toEqual([{ id: "c", zIndex: 13 }]);
  });

  it("forward swaps with next higher sibling", () => {
    const siblings = [card("a", 1), card("b", 2), card("c", 3)];
    expect(computeCanvasZIndexPatches(siblings, "a", "forward")).toEqual([
      { id: "a", zIndex: 2 },
      { id: "b", zIndex: 1 },
    ]);
  });

  it("sorts by zIndex then id", () => {
    const a = card("a", 5);
    const b = card("b", 1);
    expect([a, b].sort(compareCanvasStackOrder).map((n) => n.id)).toEqual(["b", "a"]);
  });
});
