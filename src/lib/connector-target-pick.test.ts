import { describe, expect, it } from "vitest";

import { connectorEndpointDragPreview, pickConnectorTargetAt } from "@/lib/connector-target-pick";
import type { TaskNode } from "@/types/task-node";

function card(
  id: string,
  opts: Partial<Pick<TaskNode, "x" | "y" | "width" | "height" | "zIndex">> = {},
): TaskNode {
  return {
    id,
    title: id,
    link: "",
    description: "",
    tags: [],
    dueDate: null,
    reminderDate: null,
    effort: 0,
    children: [],
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    width: opts.width ?? 100,
    height: opts.height ?? 80,
    ...(opts.zIndex !== undefined ? { zIndex: opts.zIndex } : {}),
  };
}

describe("pickConnectorTargetAt", () => {
  it("snaps near a card edge", () => {
    const a = card("a", { x: 0, y: 0, width: 100, height: 100 });
    expect(pickConnectorTargetAt({ x: 105, y: 50 }, [a], undefined, 12)?.id).toBe("a");
  });
});

describe("connectorEndpointDragPreview", () => {
  it("snaps line end to target edge toward fixed center", () => {
    const a = card("a", { x: 0, y: 0, width: 100, height: 100 });
    const b = card("b", { x: 200, y: 0, width: 100, height: 100 });
    const preview = connectorEndpointDragPreview(
      { x: 250, y: 50 },
      { x: 50, y: 50 },
      [a, b],
      ["a"],
      () => true,
    );
    expect(preview.valid).toBe(true);
    expect(preview.lineEnd.x).toBeCloseTo(200);
    expect(preview.lineEnd.y).toBeCloseTo(50);
  });
});
