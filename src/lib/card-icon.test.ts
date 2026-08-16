import { describe, expect, it } from "vitest";

import { parseCardIcon, CARD_ICON_IDS } from "@/lib/card-icon";
import { taskNodeFromJson, taskNodeToJson } from "@/lib/task-tree-json";
import type { TaskNode } from "@/types/task-node";

describe("parseCardIcon", () => {
  it("accepts known ids", () => {
    for (const id of CARD_ICON_IDS) {
      expect(parseCardIcon(id)).toBe(id);
    }
  });

  it("rejects invalid values", () => {
    expect(parseCardIcon("nope")).toBeUndefined();
    expect(parseCardIcon(1)).toBeUndefined();
    expect(parseCardIcon(null)).toBeUndefined();
  });
});

describe("cardIcon JSON roundtrip", () => {
  it("preserves valid cardIcon", () => {
    const n: TaskNode = {
      id: "c1",
      kind: "card",
      title: "Info",
      link: "",
      description: "",
      tags: [],
      dueDate: null,
      reminderDate: null,
      effort: 0,
      cardIcon: "info",
      children: [],
    };
    const back = taskNodeFromJson(taskNodeToJson(n));
    expect(back.cardIcon).toBe("info");
  });

  it("omits missing cardIcon", () => {
    const n: TaskNode = {
      id: "c2",
      kind: "card",
      title: "Plain",
      link: "",
      description: "",
      tags: [],
      dueDate: null,
      reminderDate: null,
      effort: 0,
      children: [],
    };
    const json = taskNodeToJson(n);
    expect(json.cardIcon).toBeUndefined();
    expect(taskNodeFromJson(json).cardIcon).toBeUndefined();
  });

  it("drops invalid cardIcon on lenient fromJson", () => {
    const back = taskNodeFromJson({
      id: "c3",
      title: "X",
      description: "",
      dueDate: null,
      reminderDate: null,
      effort: 0,
      cardIcon: "not-a-real-icon" as never,
      children: [],
    });
    expect(back.cardIcon).toBeUndefined();
  });
});
