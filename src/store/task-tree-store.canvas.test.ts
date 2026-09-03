import { beforeEach, describe, expect, it } from "vitest";

import {
  runWithoutBoardHistory,
  useTaskTreeStore,
} from "@/store/task-tree-store";
import type { TaskNode } from "@/types/task-node";

function placedCard(id: string, x: number, y: number, width = 100, height = 50): TaskNode {
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
    x,
    y,
    width,
    height,
  };
}

describe("canvas align / duplicate / group move", () => {
  beforeEach(() => {
    runWithoutBoardHistory(() => {
      useTaskTreeStore.getState().replaceBoardFromImport({
        roots: [placedCard("a", 10, 20), placedCard("b", 80, 90, 60, 80)],
        pathIds: [],
        collapsedIds: [],
        columnTitleOverrides: {},
        clipboardRoots: [],
      });
    });
  });

  it("aligns selected cards to the left", () => {
    useTaskTreeStore.setState({ selectedCanvasNodeIds: ["a", "b"], selectedCanvasNodeId: "a" });
    useTaskTreeStore.getState().alignCanvasSelection("left");
    expect(useTaskTreeStore.getState().roots[0]?.x).toBe(10);
    expect(useTaskTreeStore.getState().roots[1]?.x).toBe(10);
  });

  it("duplicates the selection with offset and new ids", () => {
    useTaskTreeStore.setState({ selectedCanvasNodeId: "a", selectedCanvasNodeIds: [] });
    const newIds = useTaskTreeStore.getState().duplicateCanvasSelection();
    expect(newIds).toHaveLength(1);
    const roots = useTaskTreeStore.getState().roots;
    expect(roots).toHaveLength(3);
    const copy = roots.find((n) => n.id === newIds[0]);
    expect(copy?.title).toBe("a");
    expect(copy?.x).toBe(34);
    expect(copy?.y).toBe(44);
  });

  it("moves a group together with captured members", () => {
    useTaskTreeStore.getState().addCanvasGroup({
      id: "g1",
      label: "G",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    useTaskTreeStore.getState().moveCanvasGroupBy("g1", 15, 5, ["a"]);
    const s = useTaskTreeStore.getState();
    expect(s.canvasGroups.__root__?.[0]?.x).toBe(15);
    expect(s.canvasGroups.__root__?.[0]?.y).toBe(5);
    expect(s.canvasGroups.__root__?.[0]?.color).toBe("sky");
    expect(s.roots.find((n) => n.id === "a")?.x).toBe(25);
    expect(s.roots.find((n) => n.id === "a")?.y).toBe(25);
    expect(s.roots.find((n) => n.id === "b")?.x).toBe(80);
  });

  it("loads canvas groups from a board import", () => {
    runWithoutBoardHistory(() => {
      useTaskTreeStore.getState().replaceBoardFromImport({
        roots: [placedCard("a", 10, 20)],
        pathIds: [],
        columnTitleOverrides: {},
        canvasGroups: {
          __root__: [{ id: "g1", label: "Sprint", x: 0, y: 0, width: 200, height: 150, color: "emerald" }],
        },
      });
    });
    expect(useTaskTreeStore.getState().canvasGroups.__root__?.[0]).toMatchObject({
      id: "g1",
      color: "emerald",
    });
  });

  it("does not rewrite roots when the snapped position is unchanged", () => {
    useTaskTreeStore.getState().moveCanvasNode("a", 20, 20);
    const afterSnap = useTaskTreeStore.getState().roots;
    expect(afterSnap[0]?.x).toBe(20);
    expect(afterSnap[0]?.y).toBe(20);
    const roots = useTaskTreeStore.getState().roots;
    useTaskTreeStore.getState().moveCanvasNode("a", 24, 26);
    expect(useTaskTreeStore.getState().roots).toBe(roots);
  });

  it("keeps sibling identity when moving one card", () => {
    useTaskTreeStore.getState().moveCanvasNode("a", 40, 40);
    const sibling = useTaskTreeStore.getState().roots[1];
    useTaskTreeStore.getState().moveCanvasNode("a", 80, 60);
    expect(useTaskTreeStore.getState().roots[1]).toBe(sibling);
  });

  it("coalesces a canvas drag gesture into one undo step", () => {
    useTaskTreeStore.getState().moveCanvasNode("a", 20, 20);
    useTaskTreeStore.temporal.getState().clear();
    const startX = useTaskTreeStore.getState().roots[0]?.x;
    useTaskTreeStore.getState().beginCanvasGeometryGesture();
    useTaskTreeStore.getState().moveCanvasNode("a", 40, 60);
    useTaskTreeStore.getState().moveCanvasNode("a", 80, 100);
    useTaskTreeStore.getState().moveCanvasNode("a", 120, 140);
    expect(useTaskTreeStore.temporal.getState().pastStates).toHaveLength(1);
    useTaskTreeStore.getState().endCanvasGeometryGesture();
    expect(useTaskTreeStore.getState().canvasGeometryGesture).toBe(false);
    expect(useTaskTreeStore.getState().roots[0]?.x).toBe(120);
    expect(useTaskTreeStore.temporal.getState().pastStates).toHaveLength(1);

    useTaskTreeStore.temporal.getState().undo();
    expect(useTaskTreeStore.getState().roots[0]?.x).toBe(startX);
  });

  it("imports a mermaid flowchart onto the current canvas", () => {
    const result = useTaskTreeStore.getState().importCanvasMermaid(`
flowchart TD
  Start[Los] --> Ende[Fertig]
`);
    expect(result.kind).toBe("flowchart");
    expect(result.nodeIds).toHaveLength(2);
    expect(result.relationCount).toBe(1);
    const roots = useTaskTreeStore.getState().roots;
    expect(roots.map((n) => n.title)).toEqual(expect.arrayContaining(["a", "b", "Los", "Fertig"]));
    expect(useTaskTreeStore.getState().relations).toHaveLength(1);
    expect(useTaskTreeStore.getState().selectedCanvasNodeIds).toEqual(result.nodeIds);
    const imported = roots.filter((n) => n.title === "Los" || n.title === "Fertig");
    expect(imported.every((n) => (n.x ?? 0) >= 180)).toBe(true);
  });

  it("imports a mermaid mindmap as nested cards", () => {
    const result = useTaskTreeStore.getState().importCanvasMermaid(`
mindmap
  Thema
    Kind
`);
    expect(result.kind).toBe("mindmap");
    expect(result.nodeIds).toHaveLength(1);
    const root = useTaskTreeStore.getState().roots.find((n) => n.title === "Thema");
    expect(root?.children.map((c) => c.title)).toEqual(["Kind"]);
  });
});
