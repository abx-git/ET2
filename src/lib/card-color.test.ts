import { describe, expect, it } from "vitest";

import { listSchemeFromAppearance } from "@/lib/board-appearance";
import { cardColorClass, cardColorCssVars } from "@/lib/card-color";

describe("cardColorClass", () => {
  it("uses pastel surfaces in the light scheme", () => {
    expect(cardColorClass("rose")).toContain("bg-rose-100");
    expect(cardColorClass("rose", "light")).toContain("bg-rose-100");
  });

  it("uses dark surfaces in the dark scheme", () => {
    expect(cardColorClass("rose", "dark")).toContain("bg-rose-950");
  });
});

describe("cardColorCssVars", () => {
  it("sets dark ink on a light rose card", () => {
    const vars = cardColorCssVars("rose", "light")!;
    expect(vars["--list-text"]).toBe("#4c0519");
  });

  it("sets light ink on a dark rose card", () => {
    const vars = cardColorCssVars("rose", "dark")!;
    expect(vars["--list-text"]).toBe("#fff1f2");
  });
});

describe("listSchemeFromAppearance", () => {
  it("treats workshop as light and midnight as dark", () => {
    expect(listSchemeFromAppearance({ canvas: "#e8ecf1", sidebar: "#f4f6f8" })).toBe("light");
    expect(listSchemeFromAppearance({ canvas: "#0b1020", sidebar: "#121826" })).toBe("dark");
  });
});
