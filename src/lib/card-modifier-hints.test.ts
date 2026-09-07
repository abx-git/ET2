import { describe, expect, it } from "vitest";

import { availableKeyboardMoves } from "@/lib/card-keyboard-nav";
import {
  applyHeldModifierKey,
  cardModifierHints,
  commandModifierHeld,
  EMPTY_HELD_CARD_MODIFIERS,
  isApplePlatform,
  shouldShowCardHints,
  type HeldCardModifiers,
} from "@/lib/card-modifier-hints";
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

const macCmd: Pick<
  Parameters<typeof cardModifierHints>[0],
  "isMac" | "commandLabel" | "isNote" | "hasChildren" | "isCollapsed" | "split" | "moves"
> = {
  isMac: true,
  commandLabel: "⌘",
  isNote: false,
  hasChildren: true,
  isCollapsed: true,
  split: false,
  moves: { up: true, down: true, left: true, right: true },
};

describe("isApplePlatform", () => {
  it("erkennt Mac und iPad", () => {
    expect(isApplePlatform("MacIntel")).toBe(true);
    expect(isApplePlatform("iPad")).toBe(true);
    expect(isApplePlatform("Win32")).toBe(false);
  });
});

describe("applyHeldModifierKey", () => {
  it("setzt und löst Shift", () => {
    const down = applyHeldModifierKey(EMPTY_HELD_CARD_MODIFIERS, { key: "Shift" }, true);
    expect(down.shift).toBe(true);
    const up = applyHeldModifierKey(down, { key: "Shift" }, false);
    expect(up.shift).toBe(false);
  });

  it("hält Space unabhängig von Modifier-State", () => {
    const down = applyHeldModifierKey(EMPTY_HELD_CARD_MODIFIERS, { key: " ", code: "Space" }, true);
    expect(down.space).toBe(true);
  });

  it("behandelt F2 als Function-Lage", () => {
    const down = applyHeldModifierKey(EMPTY_HELD_CARD_MODIFIERS, { key: "F2" }, true);
    expect(down.fn).toBe(true);
    const up = applyHeldModifierKey(down, { key: "F2" }, false);
    expect(up.fn).toBe(false);
  });

  it("synchronisiert Control über getModifierState", () => {
    const next = applyHeldModifierKey(
      EMPTY_HELD_CARD_MODIFIERS,
      { key: "a", getModifierState: (k) => k === "Control" },
      true,
    );
    expect(next.ctrl).toBe(true);
  });
});

describe("commandModifierHeld", () => {
  it("nimmt auf dem Mac Command oder Control", () => {
    const meta: HeldCardModifiers = { ...EMPTY_HELD_CARD_MODIFIERS, meta: true };
    const ctrl: HeldCardModifiers = { ...EMPTY_HELD_CARD_MODIFIERS, ctrl: true };
    expect(commandModifierHeld(meta, true)).toBe(true);
    expect(commandModifierHeld(ctrl, true)).toBe(true);
    expect(commandModifierHeld(meta, false)).toBe(false);
    expect(commandModifierHeld(ctrl, false)).toBe(true);
  });

  it("zeigt unter Windows bei nur Win-Taste keine Hinweise", () => {
    const win: HeldCardModifiers = { ...EMPTY_HELD_CARD_MODIFIERS, meta: true };
    expect(shouldShowCardHints(win, false)).toBe(false);
    expect(shouldShowCardHints(win, true)).toBe(true);
  });
});

describe("availableKeyboardMoves", () => {
  const roots = [
    node("p", "P", [node("a", "A"), node("b", "B", [node("b1", "B1")]), node("c", "C")]),
  ];

  it("erlaubt Verschieben nur wo es möglich ist", () => {
    expect(availableKeyboardMoves(roots, "a")).toEqual({
      up: false,
      down: true,
      left: true,
      right: false,
    });
    expect(availableKeyboardMoves(roots, "b")).toEqual({
      up: true,
      down: true,
      left: true,
      right: true,
    });
    expect(availableKeyboardMoves(roots, "p")).toEqual({
      up: false,
      down: false,
      left: false,
      right: false,
    });
  });
});

describe("cardModifierHints", () => {
  it("zeigt Shift-Verschieben und Notizen", () => {
    const hints = cardModifierHints({
      ...macCmd,
      held: { ...EMPTY_HELD_CARD_MODIFIERS, shift: true },
    });
    expect(hints.map((h) => h.id)).toEqual([
      "move-up",
      "move-down",
      "move-left",
      "move-right",
      "add-sibling-note",
      "add-child-note",
    ]);
    expect(hints.find((h) => h.id === "move-up")?.enabled).toBe(true);
  });

  it("blendet Unternotiz per Tab in der Split-Ansicht aus", () => {
    const hints = cardModifierHints({
      ...macCmd,
      split: true,
      held: { ...EMPTY_HELD_CARD_MODIFIERS, shift: true },
    });
    expect(hints.some((h) => h.id === "add-child-note")).toBe(false);
  });

  it("zeigt Command-Aktionen inkl. Link nur auf Karten", () => {
    const card = cardModifierHints({
      ...macCmd,
      held: { ...EMPTY_HELD_CARD_MODIFIERS, meta: true },
    });
    expect(card.map((h) => h.id)).toContain("paste-link");
    const note = cardModifierHints({
      ...macCmd,
      isNote: true,
      held: { ...EMPTY_HELD_CARD_MODIFIERS, meta: true },
    });
    expect(note.map((h) => h.id)).not.toContain("paste-link");
  });

  it("zeigt Function-Transfer nur im Split", () => {
    const alone = cardModifierHints({
      ...macCmd,
      held: { ...EMPTY_HELD_CARD_MODIFIERS, fn: true },
    });
    expect(alone.map((h) => h.id)).toEqual(["edit-details"]);
    const split = cardModifierHints({
      ...macCmd,
      split: true,
      held: { ...EMPTY_HELD_CARD_MODIFIERS, fn: true },
    });
    expect(split.map((h) => h.id)).toEqual(["edit-details", "copy-pane", "move-pane"]);
  });

  it("zeigt Leertaste nur mit Kindern als aktiv", () => {
    const withKids = cardModifierHints({
      ...macCmd,
      held: { ...EMPTY_HELD_CARD_MODIFIERS, space: true },
    });
    expect(withKids).toEqual([
      expect.objectContaining({ id: "toggle-expand", enabled: true, icon: "unfold" }),
    ]);
    const leaf = cardModifierHints({
      ...macCmd,
      hasChildren: false,
      held: { ...EMPTY_HELD_CARD_MODIFIERS, space: true },
    });
    expect(leaf[0]?.enabled).toBe(false);
  });

  it("zeigt unter Option die Grundaktionen", () => {
    const hints = cardModifierHints({
      ...macCmd,
      held: { ...EMPTY_HELD_CARD_MODIFIERS, alt: true },
    });
    expect(hints.map((h) => h.id)).toEqual([
      "add-sibling-card",
      "add-child-card",
      "edit-details-alt",
      "delete-card",
    ]);
  });
});
