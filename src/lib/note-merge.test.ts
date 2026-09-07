import { describe, expect, it } from "vitest";

import { applyContextListDrop } from "@/lib/context-list-dnd";
import {
  appendMarkdownBlocks,
  applyMergeIntoNote,
  convertCardNodeToNote,
  convertCardToNoteInForest,
  mergeExternalNodeIntoNote,
  sourceContributionMarkdown,
} from "@/lib/note-merge";
import { createBlankNoteNode } from "@/lib/tree-node-kind";
import type { TaskNode } from "@/types/task-node";

function card(id: string, title: string, description = "", children: TaskNode[] = []): TaskNode {
  return {
    id,
    kind: "card",
    title,
    link: "",
    description,
    tags: ["x"],
    dueDate: null,
    reminderDate: null,
    effort: 0,
    children,
  };
}

function note(id: string, title: string, markdown: string, children: TaskNode[] = []): TaskNode {
  const n = createBlankNoteNode(id);
  n.title = title;
  n.markdown = markdown;
  n.children = children;
  return n;
}

describe("note-merge", () => {
  it("wandelt Karte in Notiz um (Beschreibung → Markdown)", () => {
    const converted = convertCardNodeToNote(card("c1", "Titel", "Hallo\nWelt"));
    expect(converted.kind).toBe("note");
    expect(converted.title).toBe("Titel");
    expect(converted.markdown).toContain("Hallo");
    expect(converted.tags).toEqual([]);
    expect(converted.description).toBe("");
  });

  it("nimmt den Karten-Link beim Umwandeln als Listen-Eintrag auf", () => {
    const withLink = card("c1", "Docs", "Kurz");
    withLink.link = "https://example.org/docs";
    const converted = convertCardNodeToNote(withLink);
    expect(converted.link).toBe("");
    expect(converted.markdown).toContain("- [Docs](https://example.org/docs)");
    expect(converted.markdown).toContain("Kurz");
  });

  it("ersetzt Karte im Wald", () => {
    const roots = [card("a", "A", "Text"), card("b", "B")];
    const next = convertCardToNoteInForest(roots, "a");
    expect(next[0].kind).toBe("note");
    expect(next[0].markdown).toContain("Text");
    expect(next[1].kind).toBe("card");
  });

  it("hängt Markdown-Blöcke an", () => {
    expect(appendMarkdownBlocks("Eins", "Zwei")).toBe("Eins\n\nZwei\n");
    expect(appendMarkdownBlocks("", "Nur")).toBe("Nur\n");
  });

  it("baut Beitrags-Markdown mit Titel", () => {
    expect(sourceContributionMarkdown(card("c", "Thema", "Inhalt"))).toBe(
      "## Thema\n\nInhalt",
    );
  });

  it("baut Link-Karten als Markdown-Liste", () => {
    const linked = card("c", "Docs", "");
    linked.link = "https://example.org/docs";
    expect(sourceContributionMarkdown(linked)).toBe("- [Docs](https://example.org/docs)");
  });

  it("löst Kind-Karten mit Links als verschachtelte Liste auf", () => {
    const childA = card("a", "Alpha");
    childA.link = "https://a.example";
    const childB = card("b", "Beta");
    childB.link = "https://b.example";
    const parent = card("p", "Sammlung", "", [childA, childB]);
    parent.link = "https://index.example";
    expect(sourceContributionMarkdown(parent)).toBe(
      [
        "- [Sammlung](https://index.example/)",
        "  - [Alpha](https://a.example/)",
        "  - [Beta](https://b.example/)",
      ].join("\n"),
    );
  });

  it("merged Quelle in Notiz, löst Kinder in Markdown auf und entfernt Quelle", () => {
    const child = card("c1a", "Kind");
    child.link = "https://child.example";
    const roots = [note("n1", "Notiz", "Bestehend\n"), card("c1", "Karte", "Neu", [child])];
    const next = applyMergeIntoNote(roots, "c1", "n1");
    expect(next).not.toBeNull();
    expect(next!.map((n) => n.id)).toEqual(["n1"]);
    expect(next![0].children).toEqual([]);
    expect(next![0].markdown).toContain("Bestehend");
    expect(next![0].markdown).toContain("## Karte");
    expect(next![0].markdown).toContain("Neu");
    expect(next![0].markdown).toContain("- [Kind](https://child.example/)");
    expect(next!.some((n) => n.id === "c1")).toBe(false);
  });

  it("nimmt einen Link der gedraggten Karte als Notiz-Liste auf", () => {
    const linked = card("c1", "Handbuch");
    linked.link = "https://docs.example/guide";
    const roots = [note("n1", "Links", "Schon da\n"), linked];
    const next = applyMergeIntoNote(roots, "c1", "n1");
    expect(next![0].children).toEqual([]);
    expect(next![0].markdown).toContain("Schon da");
    expect(next![0].markdown).toContain("- [Handbuch](https://docs.example/guide)");
  });

  it("merged Notiz in Notiz", () => {
    const roots = [note("a", "A", "Eins\n"), note("b", "B", "Zwei\n")];
    const next = applyMergeIntoNote(roots, "b", "a");
    expect(next!.map((n) => n.id)).toEqual(["a"]);
    expect(next![0].markdown).toContain("Eins");
    expect(next![0].markdown).toContain("## B");
    expect(next![0].markdown).toContain("Zwei");
  });

  it("gibt null zurück wenn Ziel keine Notiz ist", () => {
    const roots = [card("a", "A"), card("b", "B")];
    expect(applyMergeIntoNote(roots, "b", "a")).toBeNull();
  });

  it("merged externe Karte mit Link in Notiz ohne Kinder zu übernehmen", () => {
    const insert = card("x", "API", "", [card("x1", "Nested")]);
    insert.link = "https://api.example";
    const roots = [note("n", "N", "Base\n")];
    const next = mergeExternalNodeIntoNote(roots, insert, "n");
    expect(next![0].children).toEqual([]);
    expect(next![0].markdown).toContain("- [API](https://api.example/)");
    expect(next![0].markdown).toContain("Nested");
  });
});

describe("context nest onto note merges", () => {
  it("nest auf Notiz merged statt einzunisten", () => {
    const roots = [note("n", "N", "Base\n"), card("c", "C", "Body")];
    const next = applyContextListDrop(roots, null, "c", { kind: "nest", targetId: "n" });
    expect(next.map((n) => n.id)).toEqual(["n"]);
    expect(next[0].children).toEqual([]);
    expect(next[0].markdown).toContain("Base");
    expect(next[0].markdown).toContain("Body");
  });

  it("nest auf Karte bleibt Nest", () => {
    const roots = [card("a", "A"), card("b", "B")];
    const next = applyContextListDrop(roots, null, "b", { kind: "nest", targetId: "a" });
    expect(next.map((n) => n.id)).toEqual(["a"]);
    expect(next[0].children.map((c) => c.id)).toEqual(["b"]);
  });
});
