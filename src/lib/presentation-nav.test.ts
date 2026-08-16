import { describe, expect, it } from "vitest";

import {
  canPresentationDrillIn,
  firstPresentationItemId,
  focusAfterDrillIn,
  navigatePresentation,
} from "@/lib/presentation-nav";
import type { TaskNode } from "@/types/task-node";

function node(
  id: string,
  opts: Partial<Pick<TaskNode, "kind" | "children" | "title" | "symbolType">> = {},
): TaskNode {
  return {
    id,
    title: opts.title ?? id,
    link: "",
    description: "",
    tags: [],
    dueDate: null,
    reminderDate: null,
    effort: 0,
    children: opts.children ?? [],
    ...(opts.kind ? { kind: opts.kind } : {}),
    ...(opts.symbolType ? { symbolType: opts.symbolType } : {}),
  };
}

describe("navigatePresentation", () => {
  const a = node("a");
  const b = node("b", { children: [node("b1")] });
  const note = node("n", { kind: "note" });
  const items = [a, b, note];

  it("moves focus up and down within the page", () => {
    expect(navigatePresentation(items, "b", "up")).toEqual({ nextId: "a" });
    expect(navigatePresentation(items, "b", "down")).toEqual({ nextId: "n" });
    expect(navigatePresentation(items, "a", "up")).toEqual({ nextId: "a" });
    expect(navigatePresentation(items, "n", "down")).toEqual({ nextId: "n" });
  });

  it("drills in only on cards with presentable children", () => {
    expect(navigatePresentation(items, "b", "right")).toEqual({
      nextId: "b",
      shouldDrillIn: true,
    });
    expect(navigatePresentation(items, "a", "right")).toEqual({ nextId: "a" });
    expect(navigatePresentation(items, "n", "right")).toEqual({ nextId: "n" });
  });

  it("does not drill into cards that only have symbols", () => {
    const onlySym = node("s", {
      children: [node("sym", { kind: "symbol", symbolType: "process" })],
    });
    expect(canPresentationDrillIn(onlySym)).toBe(false);
    expect(navigatePresentation([onlySym], "s", "right")).toEqual({ nextId: "s" });
  });

  it("drills up on left", () => {
    expect(navigatePresentation(items, "b", "left")).toEqual({
      nextId: null,
      shouldDrillUp: true,
    });
  });

  it("handles empty page and missing focus", () => {
    expect(navigatePresentation([], null, "left")).toEqual({
      nextId: null,
      shouldDrillUp: true,
    });
    expect(navigatePresentation(items, null, "down")).toEqual({ nextId: "a" });
  });
});

describe("firstPresentationItemId / focusAfterDrillIn", () => {
  it("returns first id", () => {
    const kids = [node("x"), node("y")];
    expect(firstPresentationItemId(kids)).toBe("x");
    expect(focusAfterDrillIn(kids)).toBe("x");
    expect(firstPresentationItemId([])).toBeNull();
  });
});
