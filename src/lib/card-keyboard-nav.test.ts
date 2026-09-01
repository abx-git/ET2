import { describe, expect, it } from "vitest";

import {
  firstContextCardId,
  focusTargetAfterRemoving,
  isCardVisibleInListContext,
  moveCardWithKeyboard,
  navigateContextCard,
  navigateExpandedCard,
  navigateOutlineTree,
} from "@/lib/card-keyboard-nav";
import { flattenVisibleCards } from "@/lib/card-expand";
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

describe("navigateContextCard", () => {
  const siblings = [
    node("a", "A", [node("a1", "A1")]),
    node("b", "B"),
    node("c", "C"),
  ];

  it("navigiert Geschwister", () => {
    expect(navigateContextCard(siblings, "a", "down").nextId).toBe("b");
    expect(navigateContextCard(siblings, "b", "up").nextId).toBe("a");
    expect(navigateContextCard(siblings, "c", "down").nextId).toBeNull();
  });

  it("drill-in nach rechts, drill-up nach links", () => {
    expect(navigateContextCard(siblings, "a", "right")).toEqual({
      nextId: "a",
      shouldDrillIn: true,
    });
    expect(navigateContextCard(siblings, "b", "right").nextId).toBeNull();
    expect(navigateContextCard(siblings, "a", "left")).toEqual({
      nextId: null,
      shouldDrillUp: true,
    });
  });

  it("firstContextCardId", () => {
    expect(firstContextCardId(siblings)).toBe("a");
    expect(firstContextCardId([])).toBeNull();
  });
});

describe("navigateExpandedCard", () => {
  const roots = [
    node("a", "A", [node("a1", "A1"), node("a2", "A2")]),
    node("b", "B"),
  ];

  it("klappt nach rechts auf und navigiert in Kinder", () => {
    const collapsed = new Set(["a"]);
    const visible = flattenVisibleCards(roots, collapsed);
    expect(navigateExpandedCard(visible, collapsed, "a", "right")).toEqual({
      nextId: "a",
      shouldExpand: true,
    });

    const open = flattenVisibleCards(roots, new Set());
    expect(navigateExpandedCard(open, new Set(), "a", "right").nextId).toBe("a1");
    expect(navigateExpandedCard(open, new Set(), "a1", "down").nextId).toBe("a2");
  });

  it("klappt nach links zu oder geht zum Parent", () => {
    const open = flattenVisibleCards(roots, new Set());
    expect(navigateExpandedCard(open, new Set(), "a", "left")).toEqual({
      nextId: "a",
      shouldCollapse: true,
    });
    expect(navigateExpandedCard(open, new Set(), "a1", "left").nextId).toBe("a");
    expect(navigateExpandedCard(open, new Set(["a"]), "b", "left")).toEqual({
      nextId: null,
      shouldDrillUp: true,
    });
  });
});

describe("navigateOutlineTree", () => {
  const roots = [
    node("a", "A", [node("a1", "A1")]),
    node("b", "B"),
  ];

  it("navigiert sichtbar und klappt auf, ohne Drill-up", () => {
    const open = flattenVisibleCards(roots, new Set());
    expect(navigateOutlineTree(open, new Set(), "a", "down").nextId).toBe("a1");
    expect(navigateOutlineTree(open, new Set(), "a1", "left").nextId).toBe("a");
    expect(navigateOutlineTree(open, new Set(), "a", "left")).toEqual({
      nextId: "a",
      shouldCollapse: true,
    });
    expect(navigateOutlineTree(flattenVisibleCards(roots, new Set(["a"])), new Set(["a"]), "b", "left")).toEqual({
      nextId: null,
    });
  });
});

describe("focusTargetAfterRemoving", () => {
  const roots = [node("a", "A", [node("b", "B"), node("c", "C")])];

  it("bevorzugt vorherige Geschwisterkarte", () => {
    expect(focusTargetAfterRemoving(roots, "c")).toBe("b");
  });

  it("fällt auf Parent zurück ohne Geschwister", () => {
    expect(focusTargetAfterRemoving([node("a", "A", [node("b", "B")])], "b")).toBe("a");
  });
});

describe("moveCardWithKeyboard", () => {
  it("tauscht Geschwister nach oben und unten", () => {
    const roots = [node("a", "A"), node("b", "B"), node("c", "C")];
    expect(moveCardWithKeyboard(roots, "b", "up")?.roots.map((n) => n.id)).toEqual(["b", "a", "c"]);
    expect(moveCardWithKeyboard(roots, "b", "down")?.roots.map((n) => n.id)).toEqual(["a", "c", "b"]);
  });

  it("ändert nichts am Anfang/Ende der Ebene", () => {
    const roots = [node("a", "A"), node("b", "B")];
    expect(moveCardWithKeyboard(roots, "a", "up")).toBeNull();
    expect(moveCardWithKeyboard(roots, "b", "down")).toBeNull();
    expect(moveCardWithKeyboard(roots, "a", "right")).toBeNull();
    expect(moveCardWithKeyboard(roots, "a", "left")).toBeNull();
  });

  it("tauscht auch verschachtelte Geschwister", () => {
    const roots = [node("p", "P", [node("a", "A"), node("b", "B"), node("c", "C")])];
    expect(moveCardWithKeyboard(roots, "c", "up")?.roots[0]?.children.map((n) => n.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("hebt eine Ebene an und setzt die Karte direkt hinter den Parent", () => {
    const roots = [
      node("p", "P", [node("a", "A"), node("b", "B", [node("b1", "B1")]), node("c", "C")]),
      node("q", "Q"),
    ];
    const moved = moveCardWithKeyboard(roots, "b", "left");
    expect(moved?.parentId).toBeNull();
    expect(moved?.roots.map((n) => n.id)).toEqual(["p", "b", "q"]);
    expect(moved?.roots[0]?.children.map((n) => n.id)).toEqual(["a", "c"]);
    expect(moved?.roots[1]?.children.map((n) => n.id)).toEqual(["b1"]);
  });

  it("senkt eine Ebene unter das vorherige Geschwister (ans Ende der Kinder)", () => {
    const roots = [node("a", "A", [node("a1", "A1")]), node("b", "B"), node("c", "C")];
    const moved = moveCardWithKeyboard(roots, "b", "right");
    expect(moved?.parentId).toBe("a");
    expect(moved?.roots.map((n) => n.id)).toEqual(["a", "c"]);
    expect(moved?.roots[0]?.children.map((n) => n.id)).toEqual(["a1", "b"]);
  });
});

describe("isCardVisibleInListContext", () => {
  const roots = [node("a", "A", [node("a1", "A1"), node("a2", "A2")])];

  it("prüft in Navigate nur die Geschwister der Ebene", () => {
    expect(isCardVisibleInListContext(roots, "a1", "a", true)).toBe(true);
    expect(isCardVisibleInListContext(roots, "a1", null, true)).toBe(false);
  });

  it("prüft in Expand den ganzen Unterbaum des Kontexts", () => {
    expect(isCardVisibleInListContext(roots, "a1", "a", false)).toBe(true);
    expect(isCardVisibleInListContext(roots, "a1", null, false)).toBe(true);
    expect(isCardVisibleInListContext(roots, "a2", "a1", false)).toBe(false);
  });
});
