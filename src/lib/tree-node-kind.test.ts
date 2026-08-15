import { describe, expect, it } from "vitest";

import {
  createBlankNoteNode,
  createBlankSymbolNode,
  isCardNode,
  isNoteNode,
  isSymbolNode,
  nodeDisplayTitle,
  normalizeNoteMarkdown,
  noteMarkdownPreview,
} from "./tree-node-kind";

describe("tree-node-kind", () => {
  it("erkennt Notizen an kind", () => {
    expect(isNoteNode(createBlankNoteNode("n-1"))).toBe(true);
    expect(isNoteNode({ kind: "card" } as never)).toBe(false);
  });

  it("erkennt Symbole und Karten getrennt", () => {
    const sym = createBlankSymbolNode("s-1", "process");
    expect(isSymbolNode(sym)).toBe(true);
    expect(isCardNode(sym)).toBe(false);
    expect(isNoteNode(sym)).toBe(false);
    expect(isCardNode({ kind: "card" } as never)).toBe(true);
  });

  it("leitet Anzeigetitel aus Markdown ab", () => {
    const note = createBlankNoteNode("n-1");
    note.markdown = "# Einführung\n\nText";
    expect(nodeDisplayTitle(note)).toBe("# Einführung");
    expect(noteMarkdownPreview(note.markdown)).toContain("Einführung");
  });

  it("normalisiert Zeilenumbrüche", () => {
    expect(normalizeNoteMarkdown("a\r\nb")).toBe("a\nb");
  });
});
