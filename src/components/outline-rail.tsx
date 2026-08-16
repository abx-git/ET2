"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, GripVertical, PanelLeftClose, PanelLeft, StickyNote } from "lucide-react";
import { useMemo, useState } from "react";

import { buildBoardOutlineRows } from "@/lib/board-outline";
import {
  outlineDragId,
  outlineGapId,
  outlineNestId,
} from "@/lib/outline-dnd";
import { isNoteNode, nodeDisplayTitle } from "@/lib/tree-node-kind";
import { noteAccentClasses } from "@/lib/note-accent";
import { isTaskMarkedDone } from "@/lib/task-tags";
import { useTaskTreeStore } from "@/store/task-tree-store";
import type { TaskNode } from "@/types/task-node";

export interface OutlineRailProps {
  roots: TaskNode[];
  collapsedIds: ReadonlySet<string>;
  contextNodeId: string | null;
  hideCompletedTasks: boolean;
  completedTag: string;
  nestDropTargetId?: string | null;
  onSelectNode: (nodeId: string) => void;
  onToggleCollapsed: (nodeId: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function OutlineGap({
  listParentId,
  beforeId,
}: {
  listParentId: string | null;
  beforeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: outlineGapId(listParentId, beforeId),
    data: { kind: "outlineGap" as const, listParentId, beforeId },
  });
  return (
    <div
      ref={setNodeRef}
      data-outline-drop-id={outlineGapId(listParentId, beforeId)}
      className={[
        "mx-1 rounded transition-all",
        isOver ? "h-2.5 bg-sky-200/90 ring-1 ring-sky-400" : "h-1",
      ].join(" ")}
      aria-hidden
    />
  );
}

function OutlineRow({
  node,
  depth,
  selected,
  done,
  collapsed,
  hasChildren,
  isNestTarget,
  onSelect,
  onToggleCollapsed,
}: {
  node: TaskNode;
  depth: number;
  selected: boolean;
  done: boolean;
  collapsed: boolean;
  hasChildren: boolean;
  isNestTarget: boolean;
  onSelect: () => void;
  onToggleCollapsed: () => void;
}) {
  const noteAccentColor = useTaskTreeStore((s) => s.noteAccentColor);
  const accent = noteAccentClasses(noteAccentColor);
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: outlineDragId(node.id),
    data: { kind: "outlineCard" as const, source: "outline" as const, nodeId: node.id },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: outlineNestId(node.id),
    data: { kind: "outlineNest" as const, nodeId: node.id },
    disabled: isDragging,
  });

  return (
    <div
      ref={(el) => {
        setDragRef(el);
        setDropRef(el);
      }}
      data-outline-drop-id={outlineNestId(node.id)}
      className={[
        "group flex touch-none cursor-grab items-center gap-0.5 rounded-md px-0.5 py-0.5 text-left text-[13px] leading-snug text-[var(--text)] active:cursor-grabbing",
        selected
          ? "bg-[var(--control-hover)] font-medium ring-1 ring-[var(--border)]"
          : "hover:bg-[var(--control)]",
        isDragging ? "opacity-40" : "",
        isNestTarget || isOver
          ? isNoteNode(node)
            ? accent.outlineNest
            : "bg-violet-500/20 ring-1 ring-violet-400/60"
          : "",
      ].join(" ")}
      style={{ paddingLeft: `${4 + depth * 12}px` }}
      {...attributes}
      {...listeners}
    >
      <span
        className="flex h-5 w-3.5 shrink-0 items-center justify-center text-[var(--muted)] opacity-70"
        aria-hidden
      >
        <GripVertical className="h-3 w-3" />
      </span>
      {hasChildren ? (
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted)] hover:text-[var(--text)]"
          aria-label={collapsed ? "Aufklappen" : "Zuklappen"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapsed();
          }}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      ) : (
        <span className="w-5 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        className={[
          "min-w-0 flex-1 truncate py-0.5 text-left",
          done ? "text-[var(--muted)] line-through" : "",
        ].join(" ")}
        title={nodeDisplayTitle(node)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {isNoteNode(node) ? (
          <StickyNote
            className={["mr-1 inline h-3 w-3 shrink-0", accent.outlineIcon].join(" ")}
            aria-hidden
          />
        ) : null}
        {nodeDisplayTitle(node)}
      </button>
    </div>
  );
}

export function OutlineRail({
  roots,
  collapsedIds,
  contextNodeId,
  hideCompletedTasks,
  completedTag,
  nestDropTargetId = null,
  onSelectNode,
  onToggleCollapsed,
  open: openProp,
  onOpenChange,
}: OutlineRailProps) {
  const [internalOpen, setInternalOpen] = useState(true);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (openProp === undefined) setInternalOpen(v);
  };

  // Struktur: volle Hierarchie ohne Erledigt-Filter, damit Umsortieren vorhersehbar bleibt.
  const rows = useMemo(
    () => buildBoardOutlineRows(roots, false, completedTag, collapsedIds),
    [roots, completedTag, collapsedIds],
  );

  if (!open) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--panel-solid)] py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--text)]"
          title="Struktur zeigen"
          aria-label="Struktur zeigen"
        >
          <PanelLeft className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel-solid)] text-[var(--text)] md:w-72">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-2 py-2">
        <div className="min-w-0 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Struktur
          </p>
          <p className="truncate text-[10px] text-[var(--muted)] opacity-80">
            Ziehen zum Umsortieren / Nesten
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--text)]"
          title="Struktur einklappen"
          aria-label="Struktur einklappen"
        >
          <PanelLeftClose className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {rows.length === 0 ? (
          <p className="px-2 py-4 text-xs text-[var(--muted)]">Noch keine Karten.</p>
        ) : (
          <ul className="space-y-0">
            {rows.map((row) => {
              const listParentId = row.listParentId || null;
              const selected = contextNodeId === row.node.id;
              const done = isTaskMarkedDone(row.node, completedTag);
              const hasChildren = row.node.children.length > 0;
              const collapsed = collapsedIds.has(row.node.id);
              const nextSibling = rows.find(
                (r) =>
                  r.listParentId === row.listParentId &&
                  r.siblingIndex === row.siblingIndex + 1,
              );
              return (
                <li key={row.node.id}>
                  {row.siblingIndex === 0 ? (
                    <OutlineGap listParentId={listParentId} beforeId={row.node.id} />
                  ) : null}
                  <OutlineRow
                    node={row.node}
                    depth={row.depth}
                    selected={selected}
                    done={done}
                    collapsed={collapsed}
                    hasChildren={hasChildren}
                    isNestTarget={nestDropTargetId === row.node.id}
                    onSelect={() => onSelectNode(row.node.id)}
                    onToggleCollapsed={() => onToggleCollapsed(row.node.id)}
                  />
                  {row.isLastSibling ? (
                    <OutlineGap listParentId={listParentId} beforeId={null} />
                  ) : (
                    <OutlineGap
                      listParentId={listParentId}
                      beforeId={nextSibling?.node.id ?? null}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {hideCompletedTasks ? (
          <p className="px-2 pb-2 pt-1 text-[10px] text-[var(--muted)]">
            Erledigte sind in der Liste ausgeblendet, in der Struktur weiterhin sichtbar.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
