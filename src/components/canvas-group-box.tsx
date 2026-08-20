"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import type { CanvasGroup } from "@/lib/canvas-group";

export interface CanvasGroupBoxProps {
  group: CanvasGroup;
  selected: boolean;
  zoom: number;
  onSelect: () => void;
  onMoveStart?: () => void;
  onMove: (x: number, y: number, delta: { dx: number; dy: number }) => void;
  onMoveEnd?: () => void;
  onResize: (width: number, height: number) => void;
  onLabelChange: (label: string) => void;
  onRemove: () => void;
}

export function CanvasGroupBox({
  group,
  selected,
  zoom,
  onSelect,
  onMoveStart,
  onMove,
  onMoveEnd,
  onResize,
  onLabelChange,
  onRemove,
}: CanvasGroupBoxProps) {
  const drag = useRef<{ ox: number; oy: number; sx: number; sy: number; lastDx: number; lastDy: number } | null>(null);
  const resize = useRef<{ ox: number; oy: number; sw: number; sh: number } | null>(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const [draft, setDraft] = useState(group.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const colorClass = group.color || "bg-slate-50/60 border-slate-300";

  const commitLabel = () => {
    setEditingLabel(false);
    if (draft.trim() !== group.label) {
      onLabelChange(draft.trim());
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commitLabel(); }
    else if (e.key === "Escape") { e.preventDefault(); setDraft(group.label); setEditingLabel(false); }
  };

  return (
    <div
      className={[
        "absolute rounded-lg border-2 border-dashed",
        colorClass,
        selected ? "ring-2 ring-teal-500/50" : "",
      ].join(" ")}
      style={{
        left: group.x,
        top: group.y,
        width: group.width,
        height: group.height,
        zIndex: 5,
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        // Only drag from the header area (top 28px)
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const localY = e.clientY - rect.top;
        if (localY > 28 * zoom) return; // Don't drag from body
        e.stopPropagation();
        onSelect();
        onMoveStart?.();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { ox: e.clientX, oy: e.clientY, sx: group.x, sy: group.y, lastDx: 0, lastDy: 0 };
      }}
      onPointerMove={(e) => {
        if (drag.current) {
          e.stopPropagation();
          const dx = (e.clientX - drag.current.ox) / zoom;
          const dy = (e.clientY - drag.current.oy) / zoom;
          // Incremental delta since last frame
          const incrementDx = dx - drag.current.lastDx;
          const incrementDy = dy - drag.current.lastDy;
          drag.current.lastDx = dx;
          drag.current.lastDy = dy;
          onMove(drag.current.sx + dx, drag.current.sy + dy, { dx: incrementDx, dy: incrementDy });
        }
        if (resize.current) {
          e.stopPropagation();
          const dx = (e.clientX - resize.current.ox) / zoom;
          const dy = (e.clientY - resize.current.oy) / zoom;
          onResize(
            Math.max(120, resize.current.sw + dx),
            Math.max(80, resize.current.sh + dy),
          );
        }
      }}
      onPointerUp={(e) => {
        const wasGesturing = drag.current !== null || resize.current !== null;
        drag.current = null;
        resize.current = null;
        if (wasGesturing) onMoveEnd?.();
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove();
      }}
    >
      {/* Label area */}
      <div className="flex items-center gap-1 px-2 py-1 cursor-move">
        {editingLabel ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={commitLabel}
            onPointerDown={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 rounded border border-sky-300 bg-white px-1 py-0.5 text-[11px] font-medium text-slate-700 outline-none"
            autoFocus
          />
        ) : (
          <span
            className="flex-1 truncate text-[11px] font-semibold text-slate-600 cursor-text"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setDraft(group.label);
              setEditingLabel(true);
            }}
          >
            {group.label || "Gruppe"}
          </span>
        )}
        <button
          type="button"
          className="shrink-0 rounded px-1 text-[10px] text-slate-400 hover:text-red-600"
          title="Gruppe entfernen"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ✕
        </button>
      </div>

      {/* Resize handle (bottom-right) */}
      <div
        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
          resize.current = { ox: e.clientX, oy: e.clientY, sw: group.width, sh: group.height };
        }}
      >
        <svg viewBox="0 0 10 10" className="h-3 w-3 text-slate-400">
          <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
    </div>
  );
}
