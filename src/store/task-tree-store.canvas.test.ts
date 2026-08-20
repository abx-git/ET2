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
    expect(s.roots.find((n) => n.id === "a")?.x).toBe(25);
    expect(s.roots.find((n) => n.id === "a")?.y).toBe(25);
    expect(s.roots.find((n) => n.id === "b")?.x).toBe(80);
  });
});
