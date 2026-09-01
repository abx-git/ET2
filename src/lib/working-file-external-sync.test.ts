import { describe, expect, it } from "vitest";

import { DEFAULT_CARD_FIELD_VISIBILITY } from "@/lib/card-field-visibility";
import { buildBoardSnapshot, stringifyExportedDocument } from "@/lib/task-tree-json";
import type { TaskNode } from "@/types/task-node";
import { boardContentHash } from "@/lib/working-file-write-fence";
import {
  classifyExternalWorkingFile,
  isSelfCausedDiskRevision,
  isTransientUnstableWorkingFileJson,
} from "@/lib/working-file-external-sync";

function node(id: string, title: string, children: TaskNode[] = []): TaskNode {
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
  };
}

function jsonFromRoots(roots: TaskNode[], pathIds: string[] = roots.map((r) => r.id)): string {
  return stringifyExportedDocument(
    buildBoardSnapshot(roots, pathIds, {}, DEFAULT_CARD_FIELD_VISIBILITY, false, true),
  );
}

const nonempty = jsonFromRoots([node("task-1", "Workshop")]);
const other = jsonFromRoots([node("task-1", "Andere Maschine")]);
const emptyBoard = jsonFromRoots([]);

describe("isTransientUnstableWorkingFileJson", () => {
  it("ignores empty files after a nonempty sync", () => {
    expect(isTransientUnstableWorkingFileJson("", true)).toBe(true);
    expect(isTransientUnstableWorkingFileJson("   ", true)).toBe(true);
  });

  it("ignores truncated / partial JSON after a nonempty sync", () => {
    expect(isTransientUnstableWorkingFileJson("{", true)).toBe(true);
    expect(isTransientUnstableWorkingFileJson('{"format":', true)).toBe(true);
  });

  it("does not treat a valid empty board as a sync gap", () => {
    expect(isTransientUnstableWorkingFileJson(emptyBoard, true)).toBe(false);
  });

  it("does not flag empty disk when nothing was synced yet", () => {
    expect(isTransientUnstableWorkingFileJson("", false)).toBe(false);
  });
});

describe("isSelfCausedDiskRevision", () => {
  it("is true when disk still matches the expected baseline", () => {
    const expected = boardContentHash(nonempty);
    expect(isSelfCausedDiskRevision(nonempty, expected, other)).toBe(true);
  });

  it("is true when disk already equals the outgoing payload", () => {
    const expected = boardContentHash(nonempty);
    expect(isSelfCausedDiskRevision(other, expected, other)).toBe(true);
  });

  it("is false when disk is a foreign revision", () => {
    const expected = boardContentHash(nonempty);
    const foreign = jsonFromRoots([node("task-1", "Fremd")]);
    expect(isSelfCausedDiskRevision(foreign, expected, other)).toBe(false);
  });

  it("is false for invalid disk JSON", () => {
    expect(isSelfCausedDiskRevision("{", boardContentHash(nonempty), other)).toBe(false);
  });
});

describe("classifyExternalWorkingFile", () => {
  it("ignores empty disk after a nonempty sync", () => {
    expect(
      classifyExternalWorkingFile({
        diskJson: "",
        localJson: nonempty,
        editorDirty: false,
        lastSyncedHadContent: true,
      }),
    ).toEqual({ action: "ignore" });
  });

  it("ignores invalid JSON and does not treat it as a remote board", () => {
    expect(
      classifyExternalWorkingFile({
        diskJson: '{"format": "hierarchical-task-manager"',
        localJson: nonempty,
        editorDirty: false,
        lastSyncedHadContent: true,
      }),
    ).toEqual({ action: "ignore" });
  });

  it("marks equivalent content even when dirty (exportedAt / mtime only)", () => {
    expect(
      classifyExternalWorkingFile({
        diskJson: nonempty,
        localJson: nonempty,
        editorDirty: true,
        lastSyncedHadContent: true,
      }),
    ).toEqual({ action: "mark_equivalent" });
  });

  it("adopts a valid remote board when the editor is clean", () => {
    expect(
      classifyExternalWorkingFile({
        diskJson: other,
        localJson: nonempty,
        editorDirty: false,
        lastSyncedHadContent: true,
      }),
    ).toEqual({ action: "adopt" });
  });

  it("conflicts when both editor and disk diverged", () => {
    expect(
      classifyExternalWorkingFile({
        diskJson: other,
        localJson: nonempty,
        editorDirty: true,
        lastSyncedHadContent: true,
      }),
    ).toEqual({ action: "conflict" });
  });

  it("adopts a legitimate empty board when the editor is clean", () => {
    expect(
      classifyExternalWorkingFile({
        diskJson: emptyBoard,
        localJson: nonempty,
        editorDirty: false,
        lastSyncedHadContent: true,
      }),
    ).toEqual({ action: "adopt" });
  });

  it("marks equivalent when both sides are empty and nothing was synced", () => {
    expect(
      classifyExternalWorkingFile({
        diskJson: "",
        localJson: emptyBoard,
        editorDirty: false,
        lastSyncedHadContent: false,
      }),
    ).toEqual({ action: "mark_equivalent" });
  });
});
