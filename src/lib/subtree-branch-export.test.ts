import { describe, expect, it } from "vitest";

import {
  branchExportFilename,
  DEFAULT_SUBTREE_EXPORT_ATTRIBUTES,
  exportSubtreeBranch,
  taskSubtreeToBranchJson,
  taskSubtreeToHeadingMarkdown,
  taskSubtreeToMarkdownFiles,
  uniqueMarkdownExportSlug,
} from "@/lib/subtree-branch-export";
import { DEFAULT_COMPLETED_TAG } from "@/lib/task-tags";
import { parseExportedDocument, isSubtreeSnapshot } from "@/lib/task-tree-json";
import type { TaskNode } from "@/types/task-node";

function node(
  partial: Partial<TaskNode> & Pick<TaskNode, "id" | "title">,
  children: TaskNode[] = [],
): TaskNode {
  return {
    link: "",
    description: "",
    tags: [],
    dueDate: null,
    reminderDate: null,
    effort: 0,
    children,
    ...partial,
  };
}

const baseOpts = {
  format: "markdown" as const,
  attributes: { ...DEFAULT_SUBTREE_EXPORT_ATTRIBUTES },
  completedTag: DEFAULT_COMPLETED_TAG,
  effortOnTasksEnabled: true,
};

describe("taskSubtreeToHeadingMarkdown", () => {
  it("uses heading levels for hierarchy", () => {
    const root = node(
      { id: "p", title: "Parent", link: "https://example.org/p" },
      [node({ id: "c", title: "Child", description: "Notiz" })],
    );
    const md = taskSubtreeToHeadingMarkdown(root, baseOpts);
    expect(md).toMatch(/^# \[Parent\]\(https:\/\/example\.org\/p\)/m);
    expect(md).toContain("## Child");
    expect(md).toContain("\t> Notiz");
    expect(md).not.toContain("\t-");
  });

  it("emits root notes as unindented blockquote", () => {
    const root = node({ id: "r", title: "Root", description: "Zeile 1\nZeile 2" });
    const md = taskSubtreeToHeadingMarkdown(root, baseOpts);
    expect(md).toContain("> Zeile 1");
    expect(md).toContain("> Zeile 2");
    expect(md).not.toContain("\t> Zeile");
  });

  it("omits unchecked attributes", () => {
    const root = node({ id: "x", title: "Nur Titel", description: "hidden", tags: ["A"] });
    const md = taskSubtreeToHeadingMarkdown(root, {
      ...baseOpts,
      attributes: { ...DEFAULT_SUBTREE_EXPORT_ATTRIBUTES, description: false, tags: false },
    });
    expect(md).toContain("# Nur Titel");
    expect(md).not.toContain("> hidden");
    expect(md).not.toContain("**Tags:**");
  });

  it("includes markdown note content as indented block", () => {
    const root = node(
      { id: "p", title: "Parent" },
      [
        node({
          id: "n",
          title: "Meine Notiz",
          kind: "note",
          markdown: "# Intro\nZweite Zeile",
        }),
      ],
    );
    const md = taskSubtreeToHeadingMarkdown(root, baseOpts);
    expect(md).toContain("## Meine Notiz");
    expect(md).toContain("- **Typ:** Notiz");
    expect(md).toContain("\t> # Intro");
    expect(md).toContain("\t> Zweite Zeile");
  });

  it("exports note markdown when description attribute is on", () => {
    const root = node({
      id: "n",
      title: "",
      kind: "note",
      markdown: "Nur Inhalt",
    });
    const md = taskSubtreeToHeadingMarkdown(root, baseOpts);
    expect(md).toContain("# Nur Inhalt");
    expect(md).toContain("> Nur Inhalt");
  });

  it("omits note markdown when description attribute is off", () => {
    const root = node({
      id: "n",
      title: "T",
      kind: "note",
      markdown: "Geheim",
    });
    const md = taskSubtreeToHeadingMarkdown(root, {
      ...baseOpts,
      attributes: { ...DEFAULT_SUBTREE_EXPORT_ATTRIBUTES, description: false },
    });
    expect(md).toContain("# T");
    expect(md).not.toContain("Geheim");
  });
});

describe("taskSubtreeToBranchJson", () => {
  it("exports filtered branch JSON", () => {
    const root = node({ id: "a", title: "A", link: "https://a.test", tags: ["X"] });
    const text = taskSubtreeToBranchJson(root, {
      format: "json",
      attributes: { ...DEFAULT_SUBTREE_EXPORT_ATTRIBUTES, id: true, description: false },
      completedTag: DEFAULT_COMPLETED_TAG,
    });
    const parsed = JSON.parse(text) as { root: { title: string; id: string; description?: string } };
    expect(parsed.root.title).toBe("A");
    expect(parsed.root.id).toBe("a");
    expect(parsed.root.description).toBeUndefined();
  });

  it("includes description in filtered branch JSON when enabled", () => {
    const root = node({ id: "a", title: "A", description: "Meine Notiz" });
    const text = taskSubtreeToBranchJson(root, {
      format: "json",
      attributes: DEFAULT_SUBTREE_EXPORT_ATTRIBUTES,
      completedTag: DEFAULT_COMPLETED_TAG,
    });
    const parsed = JSON.parse(text) as { root: { description?: string } };
    expect(parsed.root.description).toBe("Meine Notiz");
  });

  it("includes note kind and markdown in filtered branch JSON", () => {
    const root = node({
      id: "n",
      title: "N",
      kind: "note",
      markdown: "# Hello\nWorld",
    });
    const text = taskSubtreeToBranchJson(root, {
      format: "json",
      attributes: DEFAULT_SUBTREE_EXPORT_ATTRIBUTES,
      completedTag: DEFAULT_COMPLETED_TAG,
    });
    const parsed = JSON.parse(text) as {
      root: { kind?: string; markdown?: string; description?: string };
    };
    expect(parsed.root.kind).toBe("note");
    expect(parsed.root.markdown).toBe("# Hello\nWorld");
    expect(parsed.root.description).toBeUndefined();
  });

  it("supports import-compatible subtree snapshot with notes", () => {
    const root = node({ id: "r", title: "Root" }, [
      node({ id: "n", title: "N", kind: "note", markdown: "Body" }),
    ]);
    const text = taskSubtreeToBranchJson(root, {
      format: "json",
      attributes: DEFAULT_SUBTREE_EXPORT_ATTRIBUTES,
      completedTag: DEFAULT_COMPLETED_TAG,
      jsonImportCompatible: true,
    });
    const doc = parseExportedDocument(text);
    expect(isSubtreeSnapshot(doc)).toBe(true);
    if (isSubtreeSnapshot(doc)) {
      expect(doc.root.children[0]?.kind).toBe("note");
      expect(doc.root.children[0]?.markdown).toBe("Body");
    }
  });
});

describe("exportSubtreeBranch", () => {
  it("dispatches by format", () => {
    const root = node({ id: "1", title: "One" });
    const md = exportSubtreeBranch(root, { ...baseOpts, format: "markdown" });
    expect(md.startsWith("<!--")).toBe(true);
    const json = exportSubtreeBranch(root, { ...baseOpts, format: "json" });
    expect(json.trimStart().startsWith("{")).toBe(true);
  });

  it("scope card omits children", () => {
    const root = node({ id: "p", title: "Parent" }, [node({ id: "c", title: "Child" })]);
    const md = exportSubtreeBranch(root, { ...baseOpts, format: "markdown", scope: "card" });
    expect(md).toContain("# Parent");
    expect(md).not.toContain("Child");
  });

  it("scope subtree includes children", () => {
    const root = node({ id: "p", title: "Parent" }, [node({ id: "c", title: "Child" })]);
    const md = exportSubtreeBranch(root, { ...baseOpts, format: "markdown", scope: "subtree" });
    expect(md).toContain("## Child");
  });
});

describe("branchExportFilename", () => {
  it("reflects format and scope", () => {
    const root = node({ id: "1", title: "Mein Projekt" });
    expect(branchExportFilename(root, "markdown", "card")).toMatch(/karte\.md$/);
    expect(branchExportFilename(root, "json", "subtree")).toMatch(/zweig\.json$/);
  });
});

describe("uniqueMarkdownExportSlug", () => {
  it("appends id suffix on collision", () => {
    const used = new Set<string>();
    expect(uniqueMarkdownExportSlug("Same", "aaaa1111", used)).toBe("same");
    expect(uniqueMarkdownExportSlug("Same", "bbbb2222", used)).toBe("same-2222");
  });
});

describe("taskSubtreeToMarkdownFiles", () => {
  it("creates Obsidian-style nested paths", () => {
    const root = node({ id: "p", title: "Projekt" }, [
      node({ id: "c1", title: "Phase 1" }, [node({ id: "t", title: "Task A" })]),
      node({ id: "c2", title: "Phase 2" }),
    ]);
    const files = taskSubtreeToMarkdownFiles(root, baseOpts);
    const paths = files.map((f) => f.relativePath).sort();
    expect(paths).toEqual([
      "projekt.md",
      "projekt/phase-1.md",
      "projekt/phase-1/task-a.md",
      "projekt/phase-2.md",
    ]);
    expect(files.find((f) => f.relativePath === "projekt.md")?.content).toContain("# Projekt");
    expect(files.find((f) => f.relativePath === "projekt.md")?.content).not.toContain("Phase 1");
  });

  it("omits unchecked attributes in file content", () => {
    const root = node({ id: "x", title: "Nur Titel", description: "hidden", tags: ["A"] });
    const files = taskSubtreeToMarkdownFiles(root, {
      ...baseOpts,
      attributes: { ...DEFAULT_SUBTREE_EXPORT_ATTRIBUTES, description: false, tags: false },
    });
    expect(files).toHaveLength(1);
    expect(files[0]!.content).toContain("# Nur Titel");
    expect(files[0]!.content).not.toContain("hidden");
    expect(files[0]!.content).not.toContain("**Tags:**");
  });

  it("scope card exports only the root file", () => {
    const root = node({ id: "p", title: "Parent" }, [node({ id: "c", title: "Child" })]);
    const files = taskSubtreeToMarkdownFiles(root, { ...baseOpts, scope: "card" });
    expect(files.map((f) => f.relativePath)).toEqual(["parent.md"]);
  });

  it("skips symbol nodes", () => {
    const root = node({ id: "p", title: "Parent" }, [
      node({ id: "s", title: "Raute", kind: "symbol", symbolType: "decision" }),
      node({ id: "c", title: "Child" }),
    ]);
    const files = taskSubtreeToMarkdownFiles(root, baseOpts);
    const paths = files.map((f) => f.relativePath);
    expect(paths).toEqual(["parent.md", "parent/child.md"]);
    expect(paths.join(" ")).not.toContain("raute");
  });

  it("disambiguates sibling name collisions", () => {
    const root = node({ id: "p", title: "Parent" }, [
      node({ id: "id-aaaa", title: "Twin" }),
      node({ id: "id-bbbb", title: "Twin" }),
    ]);
    const files = taskSubtreeToMarkdownFiles(root, baseOpts);
    const paths = files.map((f) => f.relativePath).sort();
    expect(paths).toContain("parent.md");
    expect(paths).toContain("parent/twin.md");
    expect(paths.some((p) => p.startsWith("parent/twin-") && p.endsWith(".md"))).toBe(true);
  });
});
