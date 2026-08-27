import { describe, expect, it } from "vitest";

import { DEFAULT_CARD_FIELD_VISIBILITY } from "@/lib/card-field-visibility";
import {
  planFileReconcile,
  type BoardImportPayload,
} from "./file-board-reconcile";
import { buildBoardSnapshot, stringifyExportedDocument } from "./task-tree-json";
import type { TaskNode } from "@/types/task-node";

function emptyPayload(): BoardImportPayload {
  return {
    roots: [],
    pathIds: [],
    columnTitleOverrides: {},
  };
}

function payloadWithRoot(title: string): BoardImportPayload {
  const root: TaskNode = {
    id: "task-aaa",
    title,
    link: "",
    description: "",
    tags: [],
    dueDate: null,
    reminderDate: null,
    effort: 0,
    children: [],
  };
  return {
    roots: [root],
    pathIds: [root.id],
    columnTitleOverrides: {},
  };
}

function jsonFromPayload(payload: BoardImportPayload): string {
  return stringifyExportedDocument(
    buildBoardSnapshot(
      payload.roots,
      payload.pathIds,
      payload.columnTitleOverrides,
      DEFAULT_CARD_FIELD_VISIBILITY,
      false,
      true,
      payload.filterTags ?? [],
      undefined,
      payload.collapsedIds ?? [],
    ),
  );
}

describe("planFileReconcile", () => {
  it("detects in_sync", () => {
    const json = jsonFromPayload(emptyPayload());
    expect(planFileReconcile(json, json)).toEqual({ action: "in_sync" });
  });

  it("applies file when local is empty", () => {
    const local = jsonFromPayload(emptyPayload());
    const file = jsonFromPayload(payloadWithRoot("Aus Datei"));
    expect(planFileReconcile(local, file)).toEqual({ action: "apply_file" });
  });

  it("pushes local when file is empty", () => {
    const local = jsonFromPayload(payloadWithRoot("Lokal"));
    const file = jsonFromPayload(emptyPayload());
    expect(planFileReconcile(local, file)).toEqual({ action: "push_local" });
  });

  it("detects conflict when both differ", () => {
    const local = jsonFromPayload(payloadWithRoot("Lokal"));
    const file = jsonFromPayload(payloadWithRoot("Datei"));
    expect(planFileReconcile(local, file)).toEqual({ action: "conflict" });
  });

  it("treats exports as in_sync when only exportedAt differs", () => {
    const payload = payloadWithRoot("Gleich");
    const a = jsonFromPayload(payload);
    const b = jsonFromPayload(payload);
    expect(planFileReconcile(a, b)).toEqual({ action: "in_sync" });
  });
});

describe("applyBoardJsonToStoreInPlace", () => {
  it("loads remote JSON without resetting drill context", async () => {
    const { useTaskTreeStore } = await import("@/store/task-tree-store");
    const { applyBoardJsonToStore, applyBoardJsonToStoreInPlace } = await import(
      "./file-board-reconcile"
    );

    const parent = payloadWithRoot("Parent");
    parent.roots[0]!.id = "parent-1";
    parent.roots[0]!.children = [
      {
        id: "child-1",
        title: "Child",
        link: "",
        description: "",
        tags: [],
        dueDate: null,
        reminderDate: null,
        effort: 0,
        children: [],
      },
    ];
    parent.pathIds = ["parent-1"];
    applyBoardJsonToStore(jsonFromPayload(parent));
    useTaskTreeStore.getState().setContextNodeId("parent-1");

    const updated = payloadWithRoot("Parent remote");
    updated.roots[0]!.id = "parent-1";
    updated.roots[0]!.children = parent.roots[0]!.children;
    updated.pathIds = [];
    expect(applyBoardJsonToStoreInPlace(jsonFromPayload(updated))).toBe(true);
    expect(useTaskTreeStore.getState().contextNodeId).toBe("parent-1");
    expect(useTaskTreeStore.getState().roots[0]?.title).toBe("Parent remote");
  });
});

describe("boardPersistKeyFromStoreState", () => {
  it("ignores focus-only UI state", async () => {
    const { useTaskTreeStore } = await import("@/store/task-tree-store");
    const { boardPersistKeyFromStoreState } = await import("./file-board-reconcile");

    useTaskTreeStore.getState().replaceBoardFromImport({
      roots: [],
      pathIds: [],
      columnTitleOverrides: {},
    });
    const before = boardPersistKeyFromStoreState();
    useTaskTreeStore.getState().setContextNodeId(null);
    expect(boardPersistKeyFromStoreState()).toBe(before);
  });
});
