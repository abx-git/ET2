import { describe, expect, it } from "vitest";

import { computeAlignPatches } from "./element-align";
import type { TaskNode } from "@/types/task-node";

function card(id: string, x: number, y: number, width = 100, height = 50): TaskNode {
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

describe("computeAlignPatches", () => {
  const pair = [card("a", 10, 20, 100, 40), card("b", 80, 90, 60, 80)];

  it("returns empty for fewer than two nodes", () => {
    expect(computeAlignPatches([card("a", 0, 0)], "left")).toEqual([]);
  });

  it("aligns left and right edges", () => {
    expect(computeAlignPatches(pair, "left")).toEqual([
      { id: "a", x: 10 },
      { id: "b", x: 10 },
    ]);
    expect(computeAlignPatches(pair, "right")).toEqual([
      { id: "a", x: 40 },
      { id: "b", x: 80 },
    ]);
  });

  it("centers horizontally and vertically", () => {
    const xPatches = computeAlignPatches(pair, "centerX");
    expect(xPatches[0]?.x).toBeCloseTo(25);
    expect(xPatches[1]?.x).toBeCloseTo(45);
    const yPatches = computeAlignPatches(pair, "centerY");
    expect(yPatches[0]?.y).toBeCloseTo(75);
    expect(yPatches[1]?.y).toBeCloseTo(55);
  });

  it("distributes with equal gaps", () => {
    const trio = [card("a", 0, 0, 20, 10), card("b", 40, 0, 20, 10), card("c", 100, 0, 20, 10)];
    const patches = computeAlignPatches(trio, "distributeX");
    expect(patches.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(patches[0]?.x).toBe(0);
    expect(patches[1]?.x).toBe(50);
    expect(patches[2]?.x).toBe(100);
  });

  it("matches width/height to the reference node", () => {
    expect(computeAlignPatches(pair, "sameWidth", "b")).toEqual([
      { id: "a", width: 60 },
      { id: "b", width: 60 },
    ]);
    expect(computeAlignPatches(pair, "sameHeight", "a")).toEqual([
      { id: "a", height: 40 },
      { id: "b", height: 40 },
    ]);
  });
});
