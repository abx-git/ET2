import { describe, expect, it } from "vitest";

import { boardSnapshotToReplacePayload, buildBoardSnapshot } from "@/lib/task-tree-json";
import {
  boardImportPayloadFromEt2vText,
  buildEt2vClipboardPackage,
  decodeEt2vText,
  encodeEt2vFromPayload,
  extractEt2vFromClipboardText,
  isEt2vText,
} from "@/lib/et2v";
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
    x: 10,
    y: 20,
    width: 180,
    height: 90,
    children,
  };
}

describe("et2v codec", () => {
  const roots = [
    card("a", "Alpha", [card("b", "Beta")]),
    card("c", "Gamma"),
  ];
  const payload = boardSnapshotToReplacePayload(
    buildBoardSnapshot(roots, [], {}, { completedCheck: true, id: false, description: true, link: true, command: true, tags: true, effort: true, dueDate: true, reminderDate: true }, false, true),
  );
  payload.relations = [
    { id: "r1", type: "precedes", sourceId: "a", targetId: "c" },
  ];
  payload.canvasGroups = {
    __root__: [{ id: "g1", label: "Sprint", x: 0, y: 0, width: 400, height: 300, color: "sky" }],
  };

  it("detects ET2V magic", () => {
    const text = encodeEt2vFromPayload(payload, { scope: "board", title: "Test" });
    expect(isEt2vText(text)).toBe(true);
    expect(text).toContain("# et2v/1");
  });

  it("round-trips board scope", () => {
    const text = encodeEt2vFromPayload(payload, { scope: "board", title: "Test" });
    const back = boardImportPayloadFromEt2vText(text);
    expect(back?.roots).toHaveLength(2);
    expect(back?.roots[0]?.children[0]?.title).toBe("Beta");
    expect(back?.relations?.[0]?.type).toBe("precedes");
    expect(back?.canvasGroups?.__root__?.[0]?.label).toBe("Sprint");
    expect(back?.roots[0]?.x).toBe(10);
  });

  it("round-trips context scope", () => {
    const text = encodeEt2vFromPayload(payload, {
      scope: "context",
      pathIds: [],
      title: "Ctx",
    });
    const decoded = decodeEt2vText(text);
    expect(decoded?.scope).toBe("context");
    expect(decoded?.payload.roots).toHaveLength(2);
  });

  it("extracts data from LLM package", () => {
    const pack = buildEt2vClipboardPackage(payload, { scope: "board", title: "Pkg" });
    expect(pack).toContain("## data");
    const data = extractEt2vFromClipboardText(pack);
    expect(decodeEt2vText(data)?.payload.roots).toHaveLength(2);
  });
});
