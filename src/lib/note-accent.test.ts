import { describe, expect, it } from "vitest";

import {
  DEFAULT_NOTE_ACCENT,
  noteAccentClasses,
  noteAccentCssVars,
  noteAccentPalette,
  parseNoteAccent,
} from "@/lib/note-accent";

describe("note-accent", () => {
  it("defaults to steel (dunkles Blaugrau)", () => {
    expect(DEFAULT_NOTE_ACCENT).toBe("steel");
    expect(parseNoteAccent(undefined)).toBe("steel");
    expect(parseNoteAccent("nope")).toBe("steel");
    expect(noteAccentClasses("steel").label).toBe("Blaugrau");
  });

  it("parses known accents", () => {
    expect(parseNoteAccent("violet")).toBe("violet");
    expect(noteAccentClasses("sky").icon).toContain("sky");
  });

  it("uses solid paper fills without decorative borders", () => {
    const steel = noteAccentClasses("steel", "light");
    expect(steel.cardClass).toBe("bg-slate-50");
    expect(steel.cardClass).not.toContain("border-");
    expect(noteAccentClasses("sky", "light").cardClass).toBe("bg-sky-100");
  });

  it("switches to dark surfaces with light ink", () => {
    const sky = noteAccentClasses("sky", "dark");
    expect(sky.cardClass).toBe("bg-sky-950");
    const vars = noteAccentCssVars("sky", "dark");
    expect(vars["--list-text"]).toBe("#f0f9ff");
    expect(vars["--list-muted"]).toBe("#bae6fd");
  });

  it("keeps dark ink on light note paper", () => {
    const vars = noteAccentCssVars("steel", "light");
    expect(vars["--list-text"]).toBe("#0f172a");
    expect(vars["--list-muted"]).toBe("#334155");
    expect(vars["--list-card"]).toBe("#f8fafc");
  });

  it("exports an opaque light palette for SVG", () => {
    const pal = noteAccentPalette("amber");
    expect(pal.fill).toMatch(/^#[0-9a-f]{6}$/i);
    expect(pal.text).toBe("#78350f");
    expect(pal.accent).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
