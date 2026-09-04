import { beforeEach, describe, expect, it } from "vitest";

import {
  BOARD_PANE_IDS,
  DEFAULT_PANE_CONTEXTS,
  normalizePaneContexts,
  otherBoardPane,
  parseContextPanePrefixedId,
  recoverContextAfterRemoval,
  stripContextPanePrefix,
  withContextPanePrefix,
} from "@/lib/board-pane";
import {
  clearBoardHistory,
  runWithoutBoardHistory,
  useTaskTreeStore,
} from "@/store/task-tree-store";

describe("board-pane ids", () => {
  it("prefixes and strips pane ids", () => {
    expect(withContextPanePrefix("left", "context-gap:__root__|0")).toBe(
      "pane:left:context-gap:__root__|0",
    );
    expect(parseContextPanePrefixedId("pane:right:context-nest:abc")).toEqual({
      pane: "right",
      bareId: "context-nest:abc",
    });
    expect(stripContextPanePrefix("pane:left:x")).toBe("x");
    expect(stripContextPanePrefix("plain")).toBe("plain");
  });

  it("normalizes missing contexts to null", () => {
    const roots = [
      {
        id: "a",
        title: "A",
        link: "",
        description: "",
        tags: [],
        dueDate: null,
        reminderDate: null,
        effort: 0,
        children: [],
      },
    ];
    expect(
      normalizePaneContexts(roots, { left: "a", right: "gone" }),
    ).toEqual({ left: "a", right: null });
  });

  it("toggles the other pane", () => {
    expect(otherBoardPane("left")).toBe("right");
    expect(otherBoardPane("right")).toBe("left");
  });

  it("recovers context to the remaining parent instead of the board root", () => {
    const previous = [
      {
        id: "p",
        title: "P",
        link: "",
        description: "",
        tags: [],
        dueDate: null,
        reminderDate: null,
        effort: 0,
        children: [
          {
            id: "b",
            title: "B",
            link: "",
            description: "",
            tags: [],
            dueDate: null,
            reminderDate: null,
            effort: 0,
            children: [],
          },
        ],
      },
    ];
    const next = [
      {
        id: "p",
        title: "P",
        link: "",
        description: "",
        tags: [],
        dueDate: null,
        reminderDate: null,
        effort: 0,
        children: [],
      },
    ];
    expect(recoverContextAfterRemoval(previous, next, "b")).toBe("p");
    expect(normalizePaneContexts(next, { left: "b", right: "b" }, previous)).toEqual({
      left: "p",
      right: "p",
    });
  });
});

describe("dual pane store navigation", () => {
  beforeEach(() => {
    runWithoutBoardHistory(() => {
      useTaskTreeStore.getState().replaceBoardFromImport({
        roots: [],
        pathIds: [],
        collapsedIds: [],
        columnTitleOverrides: {},
        clipboardRoots: [],
      });
      useTaskTreeStore.getState().setLightModeEnabled(false);
    });
  });

  it("defaults to split off and independent pane contexts", () => {
    const s = useTaskTreeStore.getState();
    expect(s.splitViewEnabled).toBe(false);
    expect(s.activePane).toBe("left");
    expect(s.contextByPane).toEqual(DEFAULT_PANE_CONTEXTS);
    expect(BOARD_PANE_IDS).toEqual(["left", "right"]);
  });

  it("keeps left and right contexts independent", () => {
    const parentL = useTaskTreeStore.getState().addCardAfter(null);
    useTaskTreeStore.getState().updateCard(parentL, { title: "LeftParent" });
    const parentR = useTaskTreeStore.getState().addCardAfter(null);
    useTaskTreeStore.getState().updateCard(parentR, { title: "RightParent" });
    clearBoardHistory();

    useTaskTreeStore.getState().setActivePane("left");
    useTaskTreeStore.getState().drillIntoNode(parentL);
    useTaskTreeStore.getState().setActivePane("right");
    useTaskTreeStore.getState().drillIntoNode(parentR);

    const s = useTaskTreeStore.getState();
    expect(s.contextByPane.left).toBe(parentL);
    expect(s.contextByPane.right).toBe(parentR);
    expect(s.contextNodeId).toBe(parentR);
    expect(s.activePane).toBe("right");

    useTaskTreeStore.getState().setActivePane("left");
    expect(useTaskTreeStore.getState().contextNodeId).toBe(parentL);
  });

  it("recovers pane context to the parent when a drilled folder is removed", () => {
    const parent = useTaskTreeStore.getState().addCardAfter(null);
    useTaskTreeStore.getState().updateCard(parent, { title: "P" });
    const child = useTaskTreeStore.getState().addCardAfter(parent);
    useTaskTreeStore.getState().updateCard(child, { title: "B" });
    useTaskTreeStore.getState().setContextNodeId(child, "right");
    useTaskTreeStore.getState().setContextNodeId(parent, "left");
    useTaskTreeStore.getState().removeCard(child);

    const s = useTaskTreeStore.getState();
    expect(s.contextByPane.right).toBe(parent);
    expect(s.contextByPane.left).toBe(parent);
  });

  it("normalizes both panes when a context node is removed", () => {
    const parent = useTaskTreeStore.getState().addCardAfter(null);
    useTaskTreeStore.getState().updateCard(parent, { title: "P" });
    useTaskTreeStore.getState().setContextNodeId(parent, "left");
    useTaskTreeStore.getState().setContextNodeId(parent, "right");
    useTaskTreeStore.getState().removeCard(parent);

    const s = useTaskTreeStore.getState();
    expect(s.contextByPane).toEqual({ left: null, right: null });
    expect(s.contextNodeId).toBeNull();
  });

  it("copies and moves between pane contexts", () => {
    const left = useTaskTreeStore.getState().addCardAfter(null);
    useTaskTreeStore.getState().updateCard(left, { title: "LeftFolder" });
    const right = useTaskTreeStore.getState().addCardAfter(null);
    useTaskTreeStore.getState().updateCard(right, { title: "RightFolder" });
    const item = useTaskTreeStore.getState().addCardAfter(left);
    useTaskTreeStore.getState().updateCard(item, { title: "Item" });
    clearBoardHistory();

    const copied = useTaskTreeStore.getState().copyNodeToPaneContext(item, right);
    expect(copied).toBeTruthy();
    expect(copied).not.toBe(item);
    const afterCopy = useTaskTreeStore.getState();
    expect(afterCopy.roots.find((n) => n.id === right)?.children.map((n) => n.title)).toContain(
      "Item",
    );
    expect(afterCopy.roots.find((n) => n.id === left)?.children.map((n) => n.id)).toContain(item);

    expect(useTaskTreeStore.getState().moveNodeToPaneContext(item, right)).toBe(true);
    const afterMove = useTaskTreeStore.getState();
    expect(afterMove.roots.find((n) => n.id === left)?.children.map((n) => n.id)).not.toContain(
      item,
    );
    expect(afterMove.roots.find((n) => n.id === right)?.children.map((n) => n.id)).toContain(item);
  });

  it("toggles split without changing contexts", () => {
    const id = useTaskTreeStore.getState().addCardAfter(null);
    useTaskTreeStore.getState().drillIntoNode(id, "left");
    useTaskTreeStore.getState().setSplitViewEnabled(false);
    expect(useTaskTreeStore.getState().splitViewEnabled).toBe(false);
    expect(useTaskTreeStore.getState().contextByPane.left).toBe(id);
    useTaskTreeStore.getState().setSplitViewEnabled(true);
    expect(useTaskTreeStore.getState().splitViewEnabled).toBe(true);
  });

  it("toggles light mode independently of split", () => {
    expect(useTaskTreeStore.getState().lightModeEnabled).toBe(false);
    useTaskTreeStore.getState().setLightModeEnabled(true);
    expect(useTaskTreeStore.getState().lightModeEnabled).toBe(true);
    useTaskTreeStore.getState().setLightModeEnabled(true);
    expect(useTaskTreeStore.getState().lightModeEnabled).toBe(true);
    useTaskTreeStore.getState().setLightModeEnabled(false);
    expect(useTaskTreeStore.getState().lightModeEnabled).toBe(false);
  });
});
