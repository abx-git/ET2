import { describe, expect, it } from "vitest";

import { exportCanvasAsPrompt, exportTreeAsPrompt } from "./prompt-export";
import type { TaskNode } from "@/types/task-node";
import type { TaskRelation } from "@/types/task-relation";

const card = (id: string, title: string, extras?: Partial<TaskNode>): TaskNode => ({
  id,
  title,
  link: "",
  description: "",
  tags: [],
  dueDate: null,
  reminderDate: null,
  effort: 0,
  children: [],
  ...extras,
});

describe("exportCanvasAsPrompt", () => {
  it("exports cards with titles", () => {
    const nodes = [card("1", "Task A"), card("2", "Task B")];
    const result = exportCanvasAsPrompt(nodes, []);
    expect(result).toContain("### Task A");
    expect(result).toContain("### Task B");
    expect(result).toContain("Karten (2)");
  });

  it("includes links", () => {
    const nodes = [card("1", "With Link", { link: "https://example.com" })];
    const result = exportCanvasAsPrompt(nodes, []);
    expect(result).toContain("Link: https://example.com");
  });

  it("includes tags", () => {
    const nodes = [card("1", "Tagged", { tags: ["urgent", "frontend"] })];
    const result = exportCanvasAsPrompt(nodes, []);
    expect(result).toContain("Tags: urgent, frontend");
  });

  it("includes relations", () => {
    const nodes = [card("1", "Source"), card("2", "Target")];
    const relations: TaskRelation[] = [
      { id: "r1", sourceId: "1", targetId: "2", type: "temporal" },
    ];
    const result = exportCanvasAsPrompt(nodes, relations);
    expect(result).toContain("Verbindungen (1)");
    expect(result).toContain("Source → Target");
    expect(result).toContain("Zeitlich");
  });

  it("renders notes with markdown", () => {
    const nodes = [card("1", "My Note", { kind: "note", markdown: "# Hello\n- item" })];
    const result = exportCanvasAsPrompt(nodes, []);
    expect(result).toContain("[Notiz] My Note");
    expect(result).toContain("# Hello");
  });

  it("includes child count", () => {
    const nodes = [card("1", "Parent", { children: [card("c1", "Child 1"), card("c2", "Child 2")] })];
    const result = exportCanvasAsPrompt(nodes, []);
    expect(result).toContain("Unterkarten: 2");
    expect(result).toContain("- Child 1");
    expect(result).toContain("- Child 2");
  });
});

describe("exportTreeAsPrompt", () => {
  it("renders tree hierarchy", () => {
    const nodes = [
      card("1", "Root", {
        children: [card("c1", "Child"), card("c2", "Another child")],
      }),
    ];
    const result = exportTreeAsPrompt(nodes, []);
    expect(result).toContain("- Root");
    expect(result).toContain("  - Child");
    expect(result).toContain("  - Another child");
  });
});
