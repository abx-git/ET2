"use client";

import type { ForwardedRef } from "react";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ChangeCodeMirrorLanguage,
  CodeMirrorEditor,
  CodeToggle,
  ConditionalContents,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertCodeBlock,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type MDXEditorMethods,
  type MDXEditorProps,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

/**
 * Sprachen für eingefügte/erzeugte Code-Blöcke.
 * `""` und `txt` müssen existieren: HTML-Paste (`<pre>`) und Markdown-Fences ohne Sprache
 * erzeugen sonst `No CodeBlockEditor registered for language= meta=`.
 */
const NOTE_CODE_BLOCK_LANGUAGES: Record<string, string> = {
  txt: "Text",
  "": "Text",
  js: "JavaScript",
  ts: "TypeScript",
  tsx: "TypeScript (React)",
  jsx: "JavaScript (React)",
  json: "JSON",
  css: "CSS",
  html: "HTML",
  md: "Markdown",
  bash: "Bash",
  sh: "Shell",
  python: "Python",
};

const noteMdxPlugins = [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  tablePlugin(),
  codeBlockPlugin({
    defaultCodeBlockLanguage: "txt",
    // Catch-all: unbekannte Sprache + meta (z. B. aus HTML-Paste) darf den Editor nicht crashen.
    codeBlockEditorDescriptors: [{ priority: -10, match: () => true, Editor: CodeMirrorEditor }],
  }),
  codeMirrorPlugin({ codeBlockLanguages: NOTE_CODE_BLOCK_LANGUAGES }),
  markdownShortcutPlugin(),
  diffSourcePlugin({ viewMode: "rich-text" }),
  toolbarPlugin({
    toolbarContents: () => (
      <DiffSourceToggleWrapper>
        <ConditionalContents
          options={[
            {
              when: (editor) => editor?.editorType === "codeblock",
              contents: () => <ChangeCodeMirrorLanguage />,
            },
            {
              fallback: () => (
                <>
                  <UndoRedo />
                  <BlockTypeSelect />
                  <BoldItalicUnderlineToggles />
                  <CodeToggle />
                  <ListsToggle />
                  <CreateLink />
                  <InsertCodeBlock />
                </>
              ),
            },
          ]}
        />
      </DiffSourceToggleWrapper>
    ),
  }),
];

/**
 * Client-only MDXEditor mit Toolbar + Quelltext-Umschalter.
 * Wird über dynamic(ssr:false) geladen — nicht direkt aus Server-Komponenten importieren.
 */
export default function InitializedNoteMdxEditor({
  editorRef,
  ...props
}: { editorRef: ForwardedRef<MDXEditorMethods> | null } & MDXEditorProps) {
  return <MDXEditor plugins={noteMdxPlugins} {...props} ref={editorRef} />;
}
