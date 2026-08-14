"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { cardColorAccentClass, cardColorClass } from "@/lib/card-color";
import { taskCardRect } from "@/lib/connector-geometry";
import { isTaskMarkedDone } from "@/lib/task-tags";
import { isNoteNode } from "@/lib/tree-node-kind";
import { useTaskTreeStore } from "@/store/task-tree-store";
import type { TaskNode } from "@/types/task-node";

export interface TaskCanvasCardProps {
  node: TaskNode;
  completedTag: string;
  selected: boolean;
  connectSource: boolean;
  dimmed?: boolean;
  onSelect: () => void;
  onDrill: () => void;
  onMove: (x: number, y: number) => void;
  onConnectHandle: () => void;
  zoom: number;
  requestTitleEdit?: boolean;
  onTitleEditConsumed?: () => void;
}

export function TaskCanvasCard({
  node,
  completedTag,
  selected,
  connectSource,
  dimmed,
  onSelect,
  onDrill,
  onMove,
  onConnectHandle,
  zoom,
  requestTitleEdit,
  onTitleEditConsumed,
}: TaskCanvasCardProps) {
  const rect = taskCardRect(node);
  const drag = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  const editingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const updateCard = useTaskTreeStore((s) => s.updateCard);
  const note = isNoteNode(node);
  const done = !note && isTaskMarkedDone(node, completedTag);
  const colorClass = note ? "bg-slate-100 border-slate-300" : cardColorClass(node.cardColor) ?? "bg-white border-slate-200";
  const accent = note ? "bg-slate-400" : cardColorAccentClass(node.cardColor) ?? "bg-sky-500";

  const beginEdit = () => {
    onSelect();
    setDraft(node.title);
    editingRef.current = true;
    setEditing(true);
  };

  const commitTitle = () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);
    const next = draft.trim();
    if (next !== node.title) {
      updateCard(node.id, { title: next });
    }
  };

  const cancelEdit = () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setDraft(node.title);
    setEditing(false);
  };

  useEffect(() => {
    if (!requestTitleEdit || editingRef.current) return;
    beginEdit();
    onTitleEditConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot from parent
  }, [requestTitleEdit]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    if (node.title.trim()) el.select();
  }, [editing, node.title]);

  useEffect(() => {
    if (!selected && editingRef.current) {
      commitTitle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commit on deselect only
  }, [selected]);

  useEffect(() => {
    if (!editing) setDraft(node.title);
  }, [node.title, editing]);

  const onTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitTitle();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  return (
    <div
      className={[
        "absolute flex flex-col overflow-hidden rounded-md border shadow-sm",
        editing ? "" : "select-none",
        colorClass,
        selected ? "ring-2 ring-teal-600" : "",
        connectSource ? "ring-2 ring-amber-500" : "",
        done ? "opacity-60" : "",
        dimmed ? "opacity-30" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex: selected || connectSource || editing ? 20 : 15,
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        if (editing) return;
        onSelect();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = {
          ox: e.clientX,
          oy: e.clientY,
          sx: rect.x,
          sy: rect.y,
        };
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      onPointerMove={(e) => {
        if (!drag.current || editing) return;
        e.stopPropagation();
        const dx = (e.clientX - drag.current.ox) / zoom;
        const dy = (e.clientY - drag.current.oy) / zoom;
        onMove(drag.current.sx + dx, drag.current.sy + dy);
      }}
      onPointerUp={(e) => {
        drag.current = null;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (editing || (e.target as Element | null)?.closest("[data-card-title]")) return;
        onDrill();
      }}
    >
      <div className={`h-1.5 w-full shrink-0 ${accent}`} />
      <div className="flex min-h-0 flex-1 flex-col gap-1 p-2">
        <div className="flex items-start justify-between gap-1">
          {editing ? (
            <input
              ref={inputRef}
              data-card-title
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onTitleKeyDown}
              onBlur={commitTitle}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded border border-sky-300 bg-white px-1 py-0.5 text-sm font-semibold text-slate-900 outline-none ring-2 ring-sky-200"
              aria-label="Titel"
            />
          ) : (
            <button
              type="button"
              data-card-title
              className="min-w-0 flex-1 line-clamp-2 text-left text-sm font-semibold leading-snug text-slate-900 hover:underline decoration-slate-300 underline-offset-2"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                beginEdit();
              }}
            >
              {node.title.trim() || "(Ohne Titel)"}
            </button>
          )}
          <button
            type="button"
            title="Hinein"
            className="shrink-0 rounded px-1 text-xs text-slate-500 hover:bg-black/5 hover:text-slate-800"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDrill();
            }}
          >
            →
          </button>
        </div>
        {!note && node.description.trim() ? (
          <p className="line-clamp-3 text-[11px] leading-snug text-slate-600">{node.description}</p>
        ) : null}
        {note ? (
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Notiz</p>
        ) : null}
        {!note && node.tags.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-1">
            {node.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded bg-black/5 px-1 py-0.5 text-[10px] text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        title="Verbinden"
        className="absolute -right-2 top-1/2 z-30 h-4 w-4 -translate-y-1/2 rounded-full border border-slate-400 bg-white text-[10px] leading-none text-slate-600 shadow hover:border-teal-600 hover:text-teal-700"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onConnectHandle();
        }}
      >
        ✦
      </button>
    </div>
  );
}
