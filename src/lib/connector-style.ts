/** Hit-test width in world units so relations stay easy to click when zoomed out. */
export function connectorHitStrokeWidth(zoom: number): number {
  const z = zoom > 0 ? zoom : 1;
  return Math.max(16, 18 / z);
}

/** Endpoint handle radius in world units (visible only when relation is selected). */
export function connectorEndpointHandleRadius(selected: boolean): number {
  return selected ? 8 : 0;
}
