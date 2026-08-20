import { describe, expect, it } from "vitest";

import { duplicateCanvasNodes } from "./canvas-duplicate";
import type { TaskNode } from "@/types/task-node";
import type { TaskRelation } from "@/types/task-relation";

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
    width: 100,
    height: 50,
  };
}

describe("duplicateCanvasNodes", () => {
  it("clones siblings with new ids and offset positions", () => {
    const roots = [card("a", 10, 20), card("b", 200, 20)];
    const result = duplicateCanvasNodes(roots, [], ["a"]);
    expect(result).not.toBeNull();
    expect(result!.roots).toHaveLength(3);
    expect(result!.newIds).toHaveLength(1);
    const copy = result!.roots.find((n) => n.id === result!.newIds[0]);
    expect(copy?.title).toBe("a");
    expect(copy?.id).not.toBe("a");
    expect(copy?.x).toBe(34);
    expect(copy?.y).toBe(44);
    expect(result!.roots.map((n) => n.title)).toEqual(["a", "a", "b"]);
  });

  it("copies relations that stay inside the selection", () => {
    const roots = [card("a", 0, 0), card("b", 40, 0), card("c", 80, 0)];
    const relations: TaskRelation[] = [
      { id: "r1", sourceId: "a", targetId: "b", type: "precedes" },
      { id: "r2", sourceId: "b", targetId: "c", type: "blocks" },
    ];
    const result = duplicateCanvasNodes(roots, relations, ["a", "b"]);
    expect(result!.relations).toHaveLength(3);
    const copied = result!.relations.find((r) => r.id !== "r1" && r.id !== "r2")!;
    expect(copied.type).toBe("precedes");
    expect(result!.newIds).toContain(copied.sourceId);
    expect(result!.newIds).toContain(copied.targetId);
    expect(copied.sourceId).not.toBe("a");
    expect(copied.targetId).not.toBe("b");
  });

  it("remaps nested children", () => {
    const roots = [card("p", 0, 0, [card("child", 0, 0)])];
    const result = duplicateCanvasNodes(roots, [], ["p"]);
    const copy = result!.roots[1]!;
    expect(copy.children).toHaveLength(1);
    expect(copy.children[0]!.id).not.toBe("child");
    expect(copy.children[0]!.title).toBe("child");
  });
});
