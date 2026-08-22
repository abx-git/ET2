"use client";

import type { ClipboardEvent, ForwardedRef } from "react";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ChangeCodeMirrorLanguage,
  CodeToggle,
  ConditionalContents,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertCodeBlock,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  appendCodeBlockEditorDescriptor$,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  realmPlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  useCodeBlockEditorContext,
  type CodeBlockEditorDescriptor,
  type CodeBlockEditorProps,
  type MDXEditorMethods,
  type MDXEditorProps,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

import { htmlWouldCreateUnlanguagedCodeBlock } from "@/lib/note-paste-html";

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

/** Immer verfügbarer Editor — unabhängig von CodeMirror/Gurx-Zellen. */
function FallbackCodeBlockEditor({ code }: CodeBlockEditorProps) {
  const cb = useCodeBlockEditorContext();
  return (
    <div
      className="note-mdx-codeblock-fallback"
      onKeyDown={(e) => e.nativeEvent.stopImmediatePropagation()}
    >
      <textarea
        className="note-mdx-codeblock-fallback-input"
        defaultValue={code}
        spellCheck={false}
        onChange={(e) => cb.setCode(e.target.value)}
      />
    </div>
  );
}

const emptyLanguageDescriptor: CodeBlockEditorDescriptor = {
  priority: 100,
  match: (language) => !language,
  Editor: FallbackCodeBlockEditor,
};

const catchAllDescriptor: CodeBlockEditorDescriptor = {
  priority: -10,
  match: () => true,
  Editor: FallbackCodeBlockEditor,
};

/** Hängt Fallback-Editoren zuletzt an, falls codeBlockPlugin die Liste überschreibt. */
const ensureCodeBlockFallbackPlugin = realmPlugin({
  init(realm) {
    realm.pub(appendCodeBlockEditorDescriptor$, [emptyLanguageDescriptor, catchAllDescriptor]);
  },
});

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
    codeBlockEditorDescriptors: [emptyLanguageDescriptor, catchAllDescriptor],
  }),
  codeMirrorPlugin({ codeBlockLanguages: NOTE_CODE_BLOCK_LANGUAGES }),
  ensureCodeBlockFallbackPlugin(),
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

function insertPlainClipboardText(
  editorRef: ForwardedRef<MDXEditorMethods> | null,
  plain: string,
) {
  if (!plain) return;
  const methods = editorRef && typeof editorRef !== "function" ? editorRef.current : null;
  methods?.insertMarkdown(plain);
}

/**
 * Client-only MDXEditor mit Toolbar + Quelltext-Umschalter.
 * Wird über dynamic(ssr:false) geladen — nicht direkt aus Server-Komponenten importieren.
 */
export default function InitializedNoteMdxEditor({
  editorRef,
  ...props
}: { editorRef: ForwardedRef<MDXEditorMethods> | null } & MDXEditorProps) {
  const onPasteCapture = (e: ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData?.getData("text/html") ?? "";
    if (!htmlWouldCreateUnlanguagedCodeBlock(html)) return;
    const plain = e.clipboardData?.getData("text/plain") ?? "";
    if (!plain) return;
    e.preventDefault();
    e.stopPropagation();
    insertPlainClipboardText(editorRef, plain);
  };

  return (
    <div className="note-mdx-editor-host" onPasteCapture={onPasteCapture}>
      <MDXEditor {...props} plugins={noteMdxPlugins} ref={editorRef} />
    </div>
  );
}
