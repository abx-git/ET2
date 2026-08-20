import { describe, expect, it } from "vitest";

import { defaultCanvasPngFilename, defaultCanvasSvgFilename } from "./canvas-image-export";

describe("canvas image filenames", () => {
  it("uses et2-canvas prefix and timestamp", () => {
    const stamp = new Date("2026-08-20T09:05:00");
    expect(defaultCanvasPngFilename(stamp)).toBe("et2-canvas-20260820-0905.png");
    expect(defaultCanvasSvgFilename(stamp)).toBe("et2-canvas-20260820-0905.svg");
  });
});
