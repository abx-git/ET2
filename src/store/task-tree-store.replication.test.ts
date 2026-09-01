import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_CANVAS_VIEWPORT } from "@/lib/canvas-viewport";
import {
  runWithoutBoardHistory,
  useTaskTreeStore,
} from "@/store/task-tree-store";
import type { TaskNode } from "@/types/task-node";

function card(id: string, title: string, children: TaskNode[] = []): TaskNode {
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
    x: 10,
    y: 20,
    width: 100,
    height: 50,
  };
}

describe("patchBoardFromReplication", () => {
  beforeEach(() => {
    runWithoutBoardHistory(() => {
      useTaskTreeStore.getState().replaceBoardFromImport({
        roots: [card("parent", "Parent", [card("child", "Child")])],
        pathIds: ["parent"],
        collapsedIds: [],
        columnTitleOverrides: {},
        clipboardRoots: [],
      });
    });
    useTaskTreeStore.getState().setContextNodeId("parent");
    useTaskTreeStore.getState().setCanvasViewport({ x: 40, y: -12, zoom: 1.25 });
    useTaskTreeStore.setState({
      selectedCanvasNodeId: "child",
      selectedCanvasNodeIds: ["child"],
      canvasGroups: {
        parent: [{ id: "g1", label: "G", x: 0, y: 0, width: 80, height: 80 }],
        gone: [{ id: "g2", label: "Old", x: 1, y: 1, width: 10, height: 10 }],
      },
    });
  });

  it("updates board content without resetting drill, viewport, or selection", () => {
    runWithoutBoardHistory(() => {
      useTaskTreeStore.getState().patchBoardFromReplication({
        roots: [
          card("parent", "Parent renamed", [card("child", "Child renamed")]),
        ],
        pathIds: [],
        collapsedIds: [],
        columnTitleOverrides: {},
        clipboardRoots: [],
      });
    });

    const s = useTaskTreeStore.getState();
    expect(s.roots[0]?.title).toBe("Parent renamed");
    expect(s.roots[0]?.children[0]?.title).toBe("Child renamed");
    expect(s.contextNodeId).toBe("parent");
    expect(s.contextByPane.left).toBe("parent");
    expect(s.canvasViewport).toEqual({ x: 40, y: -12, zoom: 1.25 });
    expect(s.selectedCanvasNodeId).toBe("child");
    expect(s.selectedCanvasNodeIds).toEqual(["child"]);
    expect(s.canvasGroups.parent?.[0]?.id).toBe("g1");
    expect(s.canvasGroups.gone).toBeUndefined();
  });

  it("drops drill context and selection when those nodes disappeared", () => {
    runWithoutBoardHistory(() => {
      useTaskTreeStore.getState().patchBoardFromReplication({
        roots: [card("other", "Other")],
        pathIds: ["other"],
        collapsedIds: [],
        columnTitleOverrides: {},
        clipboardRoots: [],
      });
    });

    const s = useTaskTreeStore.getState();
    expect(s.contextNodeId).toBeNull();
    expect(s.selectedCanvasNodeId).toBeNull();
    expect(s.selectedCanvasNodeIds).toEqual([]);
    expect(s.canvasGroups.parent).toBeUndefined();
    expect(s.canvasViewport).toEqual({ x: 40, y: -12, zoom: 1.25 });
    expect(s.pathIds).toEqual(["other"]);
  });

  it("replaceBoardFromImport still resets the view", () => {
    runWithoutBoardHistory(() => {
      useTaskTreeStore.getState().replaceBoardFromImport({
        roots: [card("parent", "Opened")],
        pathIds: [],
        collapsedIds: [],
        columnTitleOverrides: {},
      });
    });
    const s = useTaskTreeStore.getState();
    expect(s.contextNodeId).toBeNull();
    expect(s.selectedCanvasNodeId).toBeNull();
    expect(s.canvasGroups).toEqual({});
    expect(s.canvasViewport).toEqual({ x: 40, y: -12, zoom: 1.25 });
  });
});

describe("replaceBoardFromImport viewport", () => {
  it("does not touch the session canvas viewport", () => {
    useTaskTreeStore.setState({ canvasViewport: { ...DEFAULT_CANVAS_VIEWPORT } });
    useTaskTreeStore.getState().setCanvasViewport({ x: 1, y: 2, zoom: 3 });
    runWithoutBoardHistory(() => {
      useTaskTreeStore.getState().replaceBoardFromImport({
        roots: [],
        pathIds: [],
        columnTitleOverrides: {},
      });
    });
    expect(useTaskTreeStore.getState().canvasViewport).toEqual({ x: 1, y: 2, zoom: 3 });
  });
});
