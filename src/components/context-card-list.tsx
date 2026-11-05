"use client";

import { Plus } from "lucide-react";
import { useEffect } from "react";

import type { CardFieldVisibility } from "@/lib/card-field-visibility";
import type { CardInteractionMode } from "@/lib/card-expand";
import { visibleChildrenOf } from "@/lib/card-expand";
import type { BoardPaneId } from "@/lib/board-pane";
import { listSchemeFromAppearance } from "@/lib/board-appearance";
import { noteAccentClasses } from "@/lib/note-accent";
import { isNoteNode } from "@/lib/tree-node-kind";
import { useTaskTreeStore } from "@/store/task-tree-store";
import type { TaskNode } from "@/types/task-node";

import { NoteRow } from "./note-row";
import { StripInsertTarget } from "./strip-insert-target";
import { TaskRow, type TaskTitleSaveMeta } from "./task-row";

const STRIP_INDENT_PX = 12;
type CardBranchSharedProps = {
  paneId: BoardPaneId;
  paneActive: boolean;
  fieldVisibility: CardFieldVisibility;
  searchFocusNodeId?: string | null;
  keyboardFocusNodeId?: string | null;
  titleEditNodeId: string | null;
  nestDropTargetId?: string | null;
  cardCollapsedIds: ReadonlySet<string>;
  hideCompleted?: boolean;
  completedTag?: string;
  interactionMode: CardInteractionMode;
  onSelect: (nodeId: string) => void;
  onDrillIn: (nodeId: string) => void;
  onToggleExpand: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
  onOpenDetails: (nodeId: string) => void;
  onTitleSave: (nodeId: string, title: string, meta?: TaskTitleSaveMeta) => void;
  onTitleEditStart: (nodeId: string) => void;
  onTitleEditCancel: (nodeId: string) => void;
  onRequestExport?: (nodeId: string) => void;
  onRequestInsertTemplate?: (nodeId: string) => void;
  onRequestConvertToNote?: (nodeId: string) => void;
  onRequestDelete?: (nodeId: string) => void;
};

type TreeRowSharedProps = Omit<CardBranchSharedProps, "onTitleSave" | "onTitleEditCancel"> & {
  onTitleSave: (nodeId: string, title: string, meta?: TaskTitleSaveMeta) => void;
  onTitleEditCancel: (nodeId: string) => void;
};

function TreeEntryRow({
  node,
  ...shared
}: TreeRowSharedProps & {
  node: TaskNode;
  nestDepth: number;
  isCollapsed: boolean;
}) {
  const {
    paneId,
    paneActive,
    fieldVisibility,
    searchFocusNodeId,
    keyboardFocusNodeId,
    titleEditNodeId,
    nestDropTargetId,
    interactionMode,
    onSelect,
    onDrillIn,
    onToggleExpand,
    onAddChild,
    onOpenDetails,
    onTitleSave,
    onTitleEditStart,
    onTitleEditCancel,
    onRequestExport,
    onRequestInsertTemplate,
    onRequestConvertToNote,
    onRequestDelete,
    nestDepth,
    isCollapsed,
  } = shared;

  const common = {
    paneId,
    nestDepth,
    isCollapsed,
    interactionMode,
    isSearchFocus: searchFocusNodeId === node.id,
    isKeyboardFocus: keyboardFocusNodeId === node.id,
    focusMuted: !paneActive,
    isNestDropTarget: nestDropTargetId === node.id,
    onSelect: () => onSelect(node.id),
    onDrillIn: () => onDrillIn(node.id),
    onToggleExpand: () => onToggleExpand(node.id),
    onAddChild: () => onAddChild(node.id),
    onOpenDetails: () => onOpenDetails(node.id),
    onRequestExport: onRequestExport ? () => onRequestExport(node.id) : undefined,
    onRequestInsertTemplate: onRequestInsertTemplate
      ? () => onRequestInsertTemplate(node.id)
      : undefined,
    onRequestDelete: onRequestDelete ? () => onRequestDelete(node.id) : undefined,
  };

  if (isNoteNode(node)) {
    return <NoteRow node={node} {...common} />;
  }

  return (
    <TaskRow
      node={node}
      fieldVisibility={fieldVisibility}
      isTitleEditing={titleEditNodeId === node.id}
      onTitleSave={(title, meta) => onTitleSave(node.id, title, meta)}
      onTitleEditStart={() => onTitleEditStart(node.id)}
      onTitleEditCancel={() => onTitleEditCancel(node.id)}
      onRequestConvertToNote={
        onRequestConvertToNote ? () => onRequestConvertToNote(node.id) : undefined
      }
      {...common}
    />
  );
}

function NestedCardBranch({
  nodes,
  listParentId,
  depth,
  ...shared
}: CardBranchSharedProps & {
  nodes: TaskNode[];
  listParentId: string;
  depth: number;
}) {
  const {
    paneId,
    fieldVisibility,
    searchFocusNodeId,
    keyboardFocusNodeId,
    titleEditNodeId,
    nestDropTargetId,
    cardCollapsedIds,
    hideCompleted,
    completedTag,
    interactionMode,
    onSelect,
    onDrillIn,
    onToggleExpand,
    onAddChild,
    onOpenDetails,
    onTitleSave,
    onTitleEditStart,
    onTitleEditCancel,
    onRequestExport,
    onRequestInsertTemplate,
    onRequestConvertToNote,
    onRequestDelete,
  } = shared;

  return (
    <div className="space-y-0">
      <StripInsertTarget
        paneId={paneId}
        listParentId={listParentId}
        insertIndex={0}
        indentPx={depth * STRIP_INDENT_PX}
      />
      {nodes.map((node, index) => {
        const collapsed = cardCollapsedIds.has(node.id);
        const kids =
          interactionMode === "expand" && !collapsed
            ? visibleChildrenOf(node, { hideCompleted, completedTag })
            : [];
        return (
          <div key={node.id}>
            <TreeEntryRow
              node={node}
              nestDepth={depth}
              isCollapsed={collapsed}
              {...shared}
            />
            {kids.length > 0 ? (
              <div className="border-l border-[var(--list-border)]">
                <NestedCardBranch
                  nodes={kids}
                  listParentId={node.id}
                  depth={depth + 1}
                  {...shared}
                />
              </div>
            ) : null}
            <StripInsertTarget
              paneId={paneId}
              listParentId={listParentId}
              insertIndex={index + 1}
              indentPx={depth * STRIP_INDENT_PX}
            />
          </div>
        );
      })}
    </div>
  );
}

export interface ContextCardListProps {
  paneId: BoardPaneId;
  paneActive?: boolean;
  nodes: TaskNode[];
  /** Parent der angezeigten Liste (`null` = Board-Wurzeln). */
  contextNodeId: string | null;
  contextLabel: string;
  fieldVisibility: CardFieldVisibility;
  searchFocusNodeId?: string | null;
  keyboardFocusNodeId?: string | null;
  titleEditNodeId: string | null;
  nestDropTargetId?: string | null;
  interactionMode: CardInteractionMode;
  cardCollapsedIds: ReadonlySet<string>;
  hideCompleted?: boolean;
  completedTag?: string;
  splitHints?: boolean;
  onSelect: (nodeId: string) => void;
  onDrillIn: (nodeId: string) => void;
  onToggleExpand: (nodeId: string) => void;
  onInteractionModeChange: (mode: CardInteractionMode) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: () => void;
  onAddNote: () => void;
  onOpenDetails: (nodeId: string) => void;
  onTitleSave: (nodeId: string, title: string, meta?: TaskTitleSaveMeta) => void;
  onTitleEditStart: (nodeId: string) => void;
  onTitleEditCancel: (nodeId: string) => void;
  onRequestExport?: (nodeId: string) => void;
  onRequestInsertTemplate?: (nodeId: string) => void;
  onRequestConvertToNote?: (nodeId: string) => void;
  onRequestDelete?: (nodeId: string) => void;
}

export function ContextCardList({
  paneId,
  paneActive = true,
  nodes,
  contextNodeId,
  contextLabel,
  fieldVisibility,
  searchFocusNodeId,
  keyboardFocusNodeId,
  titleEditNodeId,
  nestDropTargetId,
  interactionMode,
  cardCollapsedIds,
  hideCompleted,
  completedTag,
  splitHints = false,
  onSelect,
  onDrillIn,
  onToggleExpand,
  onInteractionModeChange,
  onAddChild,
  onAddSibling,
  onAddNote,
  onOpenDetails,
  onTitleSave,
  onTitleEditStart,
  onTitleEditCancel,
  onRequestExport,
  onRequestInsertTemplate,
  onRequestConvertToNote,
  onRequestDelete,
}: ContextCardListProps) {
  const noteAccentColor = useTaskTreeStore((s) => s.noteAccentColor);
  const appearance = useTaskTreeStore((s) => s.appearance);
  const accent = noteAccentClasses(noteAccentColor, listSchemeFromAppearance(appearance));
  useEffect(() => {
    if (!keyboardFocusNodeId) return;
    const el = document.querySelector(
      `[data-board-pane="${paneId}"][data-task-card-id="${CSS.escape(keyboardFocusNodeId)}"]`,
    );
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [keyboardFocusNodeId, paneId]);

  const shared: CardBranchSharedProps = {
    paneId,
    paneActive,
    fieldVisibility,
    searchFocusNodeId,
    keyboardFocusNodeId,
    titleEditNodeId,
    nestDropTargetId,
    cardCollapsedIds,
    hideCompleted,
    completedTag,
    interactionMode,
    onSelect,
    onDrillIn,
    onToggleExpand,
    onAddChild,
    onOpenDetails,
    onTitleSave,
    onTitleEditStart,
    onTitleEditCancel,
    onRequestExport,
    onRequestInsertTemplate,
    onRequestConvertToNote,
    onRequestDelete,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--list-text)]">{contextLabel}</h2>
          <div
            className="flex items-center gap-0.5 rounded-lg border border-[var(--list-border)] bg-[var(--list-card-nested)] p-0.5"
            role="group"
            aria-label="Karten-Interaktion"
          >
            <button
              type="button"
              onClick={() => onInteractionModeChange("expand")}
              className={[
                "rounded-md px-2 py-1 text-[11px] font-medium transition",
                interactionMode === "expand"
                  ? "bg-[var(--list-card)] text-[var(--list-text)] shadow-sm"
                  : "text-[var(--list-muted)] hover:text-[var(--list-text)]",
              ].join(" ")}
              aria-pressed={interactionMode === "expand"}
              title="Doppelklick und Icon klappen Äste auf — mehrere gleichzeitig sichtbar"
            >
              Aufklappen
            </button>
            <button
              type="button"
              onClick={() => onInteractionModeChange("navigate")}
              className={[
                "rounded-md px-2 py-1 text-[11px] font-medium transition",
                interactionMode === "navigate"
                  ? "bg-[var(--list-card)] text-[var(--list-text)] shadow-sm"
                  : "text-[var(--list-muted)] hover:text-[var(--list-text)]",
              ].join(" ")}
              aria-pressed={interactionMode === "navigate"}
              title="Doppelklick und Icon springen in den Ast (eine Ebene)"
            >
              Navigieren
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAddSibling}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--list-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--list-text)] shadow-sm hover:bg-[var(--list-hover)]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Karte
          </button>
          <button
            type="button"
            onClick={onAddNote}
            className={["inline-flex items-center gap-1.5 rounded-lg", accent.listButton].join(
              " ",
            )}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Notiz
          </button>
        </div>
      </div>

      <div className="list-strip-rack min-h-0 flex-1 overflow-y-auto pb-4">
        <StripInsertTarget
          paneId={paneId}
          listParentId={contextNodeId}
          insertIndex={0}
          emptyHint={nodes.length === 0}
          splitHints={splitHints}
        />
        {nodes.map((node, index) => {
          const collapsed = cardCollapsedIds.has(node.id);
          const kids =
            interactionMode === "expand" && !collapsed
              ? visibleChildrenOf(node, { hideCompleted, completedTag })
              : [];
          return (
            <div key={node.id}>
              <TreeEntryRow
                node={node}
                nestDepth={0}
                isCollapsed={collapsed}
                {...shared}
              />
              {kids.length > 0 ? (
                <div className="border-l border-[var(--list-border)]">
                  <NestedCardBranch
                    nodes={kids}
                    listParentId={node.id}
                    depth={1}
                    {...shared}
                  />
                </div>
              ) : null}
              <StripInsertTarget
                paneId={paneId}
                listParentId={contextNodeId}
                insertIndex={index + 1}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
