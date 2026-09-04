import { describe, expect, it } from "vitest";

import {
  copyNodeToContext,
  moveNodeToContext,
  splitTransferBlockReason,
} from "@/lib/split-pane-transfer";
import { findDirectParentId, findNodeById } from "@/lib/tree-utils";
import type { TaskNode } from "@/types/task-node";

function node(id: string, title: string, children: TaskNode[] = []): TaskNode {
  return {
    id,
    title,
    link: "",
    description: "",
    tags: [],
    dueDate: null,
    reminderDate: null,
    effort: 0,
    children,
  };
}

describe("splitTransferBlockReason", () => {
  const roots = [node("a", "A", [node("a1", "A1")]), node("b", "B")];

  it("blocks move into own subtree", () => {
    expect(splitTransferBlockReason(roots, "a", "a1", "move")).toBe("into-self");
    expect(splitTransferBlockReason(roots, "a", "a", "move")).toBe("into-self");
  });

  it("allows copy into own subtree", () => {
    expect(splitTransferBlockReason(roots, "a", "a1", "copy")).toBeNull();
    expect(splitTransferBlockReason(roots, "a", "a", "copy")).toBeNull();
  });

  it("blocks move when already in the target folder", () => {
    expect(splitTransferBlockReason(roots, "b", null, "move")).toBe("already-there");
    expect(splitTransferBlockReason(roots, "a1", "a", "move")).toBe("already-there");
  });
});

describe("copyNodeToContext", () => {
  it("inserts a remapped clone under the target folder", () => {
    const roots = [node("a", "A", [node("a1", "A1")]), node("b", "B")];
    const result = copyNodeToContext(roots, [], "a", "b");
    expect(result).not.toBeNull();
    const b = findNodeById(result!.roots, "b");
    expect(b?.children).toHaveLength(1);
    expect(b?.children[0]?.title).toBe("A");
    expect(b?.children[0]?.id).not.toBe("a");
    expect(b?.children[0]?.children[0]?.title).toBe("A1");
    expect(findNodeById(result!.roots, "a")).not.toBeNull();
  });
});

describe("moveNodeToContext", () => {
  it("relocates the node under the target folder", () => {
    const roots = [node("a", "A", [node("a1", "A1")]), node("b", "B")];
    const result = moveNodeToContext(roots, "a1", "b");
    expect(result).not.toBeNull();
    expect(findDirectParentId(result!.roots, "a1")).toBe("b");
    expect(findNodeById(result!.roots, "a")?.children).toEqual([]);
  });

  it("refuses a cyclic move", () => {
    const roots = [node("a", "A", [node("a1", "A1")])];
    expect(moveNodeToContext(roots, "a", "a1")).toBeNull();
  });
});
