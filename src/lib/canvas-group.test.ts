import { describe, expect, it } from "vitest";

import { containedNodeIds, isNodeInsideGroup, type CanvasGroup } from "./canvas-group";
import type { TaskNode } from "@/types/task-node";

const group: CanvasGroup = { id: "g", label: "G", x: 0, y: 0, width: 200, height: 150 };

describe("isNodeInsideGroup", () => {
  it("requires full containment", () => {
    expect(isNodeInsideGroup(10, 10, 80, 40, group)).toBe(true);
    expect(isNodeInsideGroup(10, 10, 220, 40, group)).toBe(false);
    expect(isNodeInsideGroup(-5, 10, 80, 40, group)).toBe(false);
  });
});

describe("containedNodeIds", () => {
  it("returns ids of fully enclosed cards", () => {
    const nodes: TaskNode[] = [
      {
        id: "in",
        title: "in",
        link: "",
        description: "",
        tags: [],
        dueDate: null,
        reminderDate: null,
        effort: 0,
        children: [],
        x: 10,
        y: 10,
        width: 80,
        height: 40,
      },
      {
        id: "out",
        title: "out",
        link: "",
        description: "",
        tags: [],
        dueDate: null,
        reminderDate: null,
        effort: 0,
        children: [],
        x: 180,
        y: 10,
        width: 80,
        height: 40,
      },
    ];
    expect(containedNodeIds(nodes, group)).toEqual(["in"]);
  });
});
