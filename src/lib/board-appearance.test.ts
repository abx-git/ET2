import { describe, expect, it } from "vitest";

import {
  APPEARANCE_PRESETS,
  appearanceToCssVars,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
} from "@/lib/board-appearance";

describe("normalizeAppearance", () => {
  it("falls back to the default scheme", () => {
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance({ canvas: "red" })).toEqual(DEFAULT_APPEARANCE);
  });

  it("keeps valid hex colors", () => {
    expect(normalizeAppearance({ canvas: "#112233", sidebar: "#aabbcc" })).toEqual({
      canvas: "#112233",
      sidebar: "#aabbcc",
    });
  });
});

describe("appearanceToCssVars", () => {
  it("derives list tokens for the light default", () => {
    const vars = appearanceToCssVars(DEFAULT_APPEARANCE);
    expect(vars["--list-bg"]).toBe(DEFAULT_APPEARANCE.canvas);
    expect(vars["--list-text"]).toBe("#1a2330");
    expect(vars["--list-card"]).toMatch(/^#[0-9a-f]{6}$/i);
    expect(vars["--list-border"]).toContain("rgba");
    expect(vars["--list-focus"]).toMatch(/^#/);
    expect(vars["--list-target"]).toMatch(/^#/);
  });

  it("uses light text on dark list backgrounds", () => {
    const midnight = APPEARANCE_PRESETS.find((p) => p.id === "midnight")!.appearance;
    const vars = appearanceToCssVars(midnight);
    expect(vars["--list-bg"]).toBe(midnight.canvas);
    expect(vars["--list-text"]).toBe("#e8eef4");
    expect(vars["color-scheme"]).toBe("dark");
  });

  it("elevates list cards above the canvas without relying on a border", () => {
    const light = appearanceToCssVars(DEFAULT_APPEARANCE);
    expect(light["--list-card"].toLowerCase()).not.toBe(DEFAULT_APPEARANCE.canvas.toLowerCase());
    const midnight = APPEARANCE_PRESETS.find((p) => p.id === "midnight")!.appearance;
    const dark = appearanceToCssVars(midnight);
    expect(dark["--list-card"].toLowerCase()).not.toBe(midnight.canvas.toLowerCase());
  });
});
