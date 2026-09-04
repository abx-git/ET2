"use client";

import type { CardFieldVisibility } from "@/lib/card-field-visibility";
import type { CardInteractionMode } from "@/lib/card-expand";
import type { BoardPaneId } from "@/lib/board-pane";
import type { TaskNode } from "@/types/task-node";

import { BreadcrumbTrail } from "./breadcrumb-trail";
import { ContextCardList } from "./context-card-list";
import type { TaskTitleSaveMeta } from "./task-row";

export interface BoardPaneProps {
  paneId: BoardPaneId;
  active: boolean;
  /** Quelle (aktiv) / Ziel (inaktiv) in der Split-Ansicht; null = einzelnes Panel. */
  transferRole?: "source" | "target" | null;
  itemCount: number;
  dragging: boolean;
  contextNodeId: string | null;
  breadcrumbPath: TaskNode[];
  contextLabel: string;
  nodes: TaskNode[];
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
  onActivate: () => void;
  onNavigateRoot: () => void;
  onNavigateTo: (id: string) => void;
  onDrillUp: () => void;
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

export function BoardPane({
  paneId,
  active,
  transferRole = null,
  itemCount,
  dragging,
  contextNodeId,
  breadcrumbPath,
  contextLabel,
  nodes,
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
  onActivate,
  onNavigateRoot,
  onNavigateTo,
  onDrillUp,
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
}: BoardPaneProps) {
  const isSource = transferRole === "source";
  const isTarget = transferRole === "target";
  const paneLabel = paneId === "left" ? "Linkes Panel" : "Rechtes Panel";

  return (
    <div
      className={[
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden text-[var(--list-text)] transition-colors",
        isSource
          ? "bg-[var(--list-bg)] ring-2 ring-inset ring-[var(--list-ring)]"
          : isTarget
            ? "bg-[var(--list-bg)] ring-2 ring-inset ring-[var(--list-target-ring)]"
            : active
              ? "bg-[var(--list-bg)] ring-1 ring-inset ring-[var(--list-ring)]"
              : "bg-[var(--list-bg)] opacity-[0.92]",
      ].join(" ")}
      data-board-pane-shell={paneId}
      data-active-pane={active ? "true" : "false"}
      data-transfer-role={transferRole ?? undefined}
      role="region"
      aria-label={`${paneLabel}${isSource ? " · Quelle" : isTarget ? " · Ziel" : ""}`}
      onMouseDownCapture={onActivate}
    >
      <div
        className={[
          "shrink-0 border-b px-3 py-2",
          isSource
            ? "border-[var(--list-focus)] bg-[var(--list-current-bg)]"
            : isTarget
              ? "border-[var(--list-target)] bg-[var(--list-target-bg)]"
              : "border-[var(--list-border)]",
          !isSource && !isTarget && active ? "bg-[var(--list-header)]" : "",
        ].join(" ")}
      >
        {transferRole ? (
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span
              className={[
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                isSource
                  ? "bg-[var(--list-focus)] text-white"
                  : "bg-[var(--list-target)] text-white",
              ].join(" ")}
            >
              {isSource ? "Quelle" : "Ziel"}
            </span>
            <span
              className={[
                "truncate text-[11px] font-medium",
                isSource ? "text-[var(--list-current-text)]" : "text-[var(--list-target-text)]",
              ].join(" ")}
              title={contextLabel}
            >
              {itemCount} {itemCount === 1 ? "Eintrag" : "Einträge"} · {contextLabel}
            </span>
          </div>
        ) : null}
        <BreadcrumbTrail
          path={breadcrumbPath}
          onNavigateRoot={onNavigateRoot}
          onNavigateTo={onNavigateTo}
          onDrillUp={onDrillUp}
        />
      </div>
      <div
        className={[
          "flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3",
          dragging ? "touch-none" : "",
        ].join(" ")}
      >
        <ContextCardList
          paneId={paneId}
          paneActive={active}
          nodes={nodes}
          contextNodeId={contextNodeId}
          contextLabel={contextLabel}
          fieldVisibility={fieldVisibility}
          searchFocusNodeId={searchFocusNodeId}
          keyboardFocusNodeId={keyboardFocusNodeId}
          titleEditNodeId={titleEditNodeId}
          nestDropTargetId={nestDropTargetId}
          interactionMode={interactionMode}
          cardCollapsedIds={cardCollapsedIds}
          hideCompleted={hideCompleted}
          completedTag={completedTag}
          splitHints={splitHints}
          onSelect={onSelect}
          onDrillIn={onDrillIn}
          onToggleExpand={onToggleExpand}
          onInteractionModeChange={onInteractionModeChange}
          onAddChild={onAddChild}
          onAddSibling={onAddSibling}
          onAddNote={onAddNote}
          onOpenDetails={onOpenDetails}
          onTitleSave={onTitleSave}
          onTitleEditStart={onTitleEditStart}
          onTitleEditCancel={onTitleEditCancel}
          onRequestExport={onRequestExport}
          onRequestInsertTemplate={onRequestInsertTemplate}
          onRequestConvertToNote={onRequestConvertToNote}
          onRequestDelete={onRequestDelete}
        />
      </div>
    </div>
  );
}
