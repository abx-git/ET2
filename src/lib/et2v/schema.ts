import { ET2V_FORMAT, ET2V_VERSION } from "@/lib/et2v/constants";

export const ET2V_SCHEMA_DOCUMENT = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://abx-git.github.io/ET2/schemas/et2v-v1.schema.json",
  title: "ET2 Board Compact (ET2V)",
  description:
    "Line-oriented, layout-preserving export for ET2 boards, drill contexts, or subtrees.",
  type: "object",
  properties: {
    format: { const: ET2V_FORMAT },
    version: { const: ET2V_VERSION },
    magicFirstLine: { const: "# et2v/1" },
  },
  required: ["format", "version"],
  et2vGrammar: {
    header: [
      "# et2v/1",
      "@format",
      "@version",
      "@scope board|context|subtree",
      "@exported ISO-8601",
      "@title",
    ],
    contextMeta: ["@path id…", "@pathTitle breadcrumb"],
    records: {
      n: "node: id kind symbolType title parent [x y w h z]",
      r: "relation: id type source target [label]",
      cg: "canvas group: id label x y w h [color]",
    },
    extensions: [
      "@id alias realId",
      "@desc nodeId text",
      "@md nodeId markdown",
      "@tags nodeId comma-separated",
      "@link @cmd @due @rem @eff @color @icon nodeId …",
      "@attr entityId name:type[:pk|fk]|…",
      "@cgctx contextKey",
      "@col index title",
      "@appearance JSON",
      "@collapsed id…",
      "@cardcollapsed id…",
    ],
    footer: ["@end"],
  },
} as const;

export function stringifyEt2vSchema(): string {
  return JSON.stringify(ET2V_SCHEMA_DOCUMENT, null, 2);
}

export const ET2V_ENGLISH_LLM_PROMPT = `You are editing a hierarchical task board in the ET2 app (outline + canvas).

## Your task
- Produce or modify **ET2V** (\`# et2v/1\`) text that round-trips into ET2 **with explicit layout** (x, y, width, height, z-index on canvas).
- Do **not** auto-layout unless coordinates are missing and the user asks for a new board.
- Prefer **tab-separated** rows. JSON-quoted strings for titles with spaces or tabs.
- Build the **tree** with \`n\` rows: \`parent\` is \`-\` for top-level nodes in the scope (board roots, or children of the drill context).
- **Relations** (\`r\`) only between **sibling** cards that share the same parent in the tree.

## Wire format
- First line: \`# et2v/1\`
- \`@format hierarchical-task-manager-et2v\`, \`@version 1\`
- \`@scope board\` (full board), \`context\` (one drill level + subtree), or \`subtree\` (single importable tree)
- \`@path\` optional: drill path as node ids (empty at board roots)

## Core rows
- \`n <id> <kind> <symbolType> <title> <parent> [x y w h z]\`
  - kind: \`card\`, \`note\`, or \`symbol\` (symbolType required for symbol, else empty)
- \`r <id> <type> <source> <target> [label]\` — shorthand \`r <source> <target>\` → untyped
- \`cg <id> <label> <x> <y> <w> <h> [color]\` — canvas frame (not a tree parent)
- \`@md <nodeId> <markdown>\`, \`@desc <nodeId> <text>\`, \`@tags <nodeId> t1,t2\`

## Relation types
untyped, precedes, requires, blocks, informs, assigns, supports

## Output
Return only the \`## data\` fence when asked for data alone; otherwise use package sections \`## prompt\`, \`## schema\`, \`## data\`.
Paste into ET2: Daten → ET2V or Canvas → Export → ET2V einfügen.
`;
