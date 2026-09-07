import { describe, expect, it } from "vitest";

import {
  activeHelpSectionIds,
  applyHeldModifierKey,
  cardActionHelpSections,
  commandModifierHeld,
  EMPTY_HELD_CARD_MODIFIERS,
  isApplePlatform,
  type HeldCardModifiers,
} from "@/lib/card-modifier-hints";

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
});

describe("cardActionHelpSections", () => {
  it("listet Shift-Aktionen und blendet Split-Kürzel ohne Split aus", () => {
    const sections = cardActionHelpSections({ commandLabel: "⌘", split: false });
    const shift = sections.find((s) => s.id === "shift");
    expect(shift?.rows.map((r) => r.id)).toEqual([
      "move-up",
      "move-down",
      "move-left",
      "move-right",
      "add-sibling-note",
      "add-child-note",
    ]);
    expect(sections.find((s) => s.id === "fn")?.rows.map((r) => r.id)).toEqual(["edit-details"]);
  });

  it("zeigt Split-Aktionen für Command und Fn", () => {
    const sections = cardActionHelpSections({ commandLabel: "Strg", split: true });
    expect(sections.find((s) => s.id === "command")?.rows.map((r) => r.id)).toEqual([
      "paste-link",
      "add-child-card-split",
      "add-child-note-split",
    ]);
    expect(sections.find((s) => s.id === "fn")?.rows.map((r) => r.id)).toEqual([
      "edit-details",
      "copy-pane",
      "move-pane",
    ]);
    expect(sections.find((s) => s.id === "shift")?.rows.some((r) => r.id === "add-child-note")).toBe(
      false,
    );
  });

  it("hebt den passenden Abschnitt bei gehaltener Taste hervor", () => {
    expect(activeHelpSectionIds({ ...EMPTY_HELD_CARD_MODIFIERS, shift: true }, true)).toEqual([
      "shift",
    ]);
    expect(activeHelpSectionIds({ ...EMPTY_HELD_CARD_MODIFIERS, meta: true }, true)).toEqual([
      "command",
    ]);
    expect(activeHelpSectionIds({ ...EMPTY_HELD_CARD_MODIFIERS, meta: true }, false)).toEqual([]);
  });
});
