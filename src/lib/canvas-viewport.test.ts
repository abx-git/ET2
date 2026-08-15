import { describe, expect, it } from "vitest";

import {
  DEFAULT_CANVAS_VIEWPORT,
  FIT_VIEW_PADDING,
  MAX_ZOOM,
  MIN_ZOOM,
  fitViewportToBounds,
  unionWorldBounds,
} from "./canvas-viewport";

describe("unionWorldBounds", () => {
  it("returns null for empty input", () => {
    expect(unionWorldBounds([])).toBeNull();
  });

  it("unions rectangles", () => {
    expect(
      unionWorldBounds([
        { x: 0, y: 0, w: 100, h: 50 },
        { x: 200, y: 80, w: 100, h: 40 },
      ]),
    ).toEqual({ minX: 0, minY: 0, maxX: 300, maxY: 120 });
  });
});

describe("fitViewportToBounds", () => {
  it("falls back when viewport size is invalid", () => {
    expect(fitViewportToBounds({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 0, 400)).toEqual(
      DEFAULT_CANVAS_VIEWPORT,
    );
  });

  it("fits content with padding and clamps zoom", () => {
    const bounds = { minX: 0, minY: 0, maxX: 400, maxY: 200 };
    const vp = fitViewportToBounds(bounds, 800, 600, FIT_VIEW_PADDING);
    expect(vp.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
    expect(vp.zoom).toBeLessThanOrEqual(MAX_ZOOM);

    const screenMinX = bounds.minX * vp.zoom + vp.x;
    const screenMaxX = bounds.maxX * vp.zoom + vp.x;
    const screenMinY = bounds.minY * vp.zoom + vp.y;
    const screenMaxY = bounds.maxY * vp.zoom + vp.y;

    expect(screenMinX).toBeGreaterThanOrEqual(FIT_VIEW_PADDING - 0.5);
    expect(screenMaxX).toBeLessThanOrEqual(800 - FIT_VIEW_PADDING + 0.5);
    expect(screenMinY).toBeGreaterThanOrEqual(0);
    expect(screenMaxY).toBeLessThanOrEqual(600);
  });

  it("centers a single small card without exceeding max zoom", () => {
    const bounds = { minX: 100, minY: 100, maxX: 140, maxY: 130 };
    const vp = fitViewportToBounds(bounds, 1000, 800);
    expect(vp.zoom).toBe(MAX_ZOOM);
    const cx = ((bounds.minX + bounds.maxX) / 2) * vp.zoom + vp.x;
    const cy = ((bounds.minY + bounds.maxY) / 2) * vp.zoom + vp.y;
    expect(cx).toBeCloseTo(500, 5);
    expect(cy).toBeCloseTo(400, 5);
  });
});
