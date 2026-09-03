"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import {
  GROUP_HEADER_HEIGHT,
  groupColorPaint,
  resizedGroupRect,
  type CanvasGroup,
  type GroupResizeHandle,
} from "@/lib/canvas-group";
import { isCoarsePointerDevice } from "@/lib/coarse-pointer";

const HANDLE_POSITIONS: Record<GroupResizeHandle, string> = {
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
};

export interface CanvasGroupBoxProps {
  group: CanvasGroup;
  selected: boolean;
  zoom: number;
  scheme?: "light" | "dark";
  onSelect: () => void;
  onMoveStart?: () => void;
  onMove: (x: number, y: number, delta: { dx: number; dy: number }) => void;
  onMoveEnd?: () => void;
  onResize: (patch: { x: number; y: number; width: number; height: number }) => void;
  onGeometryEnd?: () => void;
  onLabelChange: (label: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  requestLabelEdit?: boolean;
  onLabelEditConsumed?: () => void;
}

export function CanvasGroupBox({
  group,
  selected,
  zoom,
  scheme = "light",
  onSelect,
  onMoveStart,
  onMove,
  onMoveEnd,
  onResize,
  onGeometryEnd,
  onLabelChange,
  onContextMenu,
  requestLabelEdit,
  onLabelEditConsumed,
}: CanvasGroupBoxProps) {
  const drag = useRef<{ ox: number; oy: number; sx: number; sy: number; lastDx: number; lastDy: number } | null>(
    null,
  );
  const [editingLabel, setEditingLabel] = useState(false);
  const [draft, setDraft] = useState(group.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef(false);
  editingRef.current = editingLabel;
  const coarsePointer = isCoarsePointerDevice();
  const paint = groupColorPaint(group.color, scheme);

  const commitLabel = () => {
    setEditingLabel(false);
    const next = draft.trim();
    if (next !== group.label) onLabelChange(next);
  };

  useEffect(() => {
    if (!requestLabelEdit || editingRef.current) return;
    setDraft(group.label);
    setEditingLabel(true);
    onLabelEditConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestLabelEdit]);

  useEffect(() => {
    if (!editingLabel) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editingLabel]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitLabel();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(group.label);
      setEditingLabel(false);
    }
  };

  const startResize = (handle: GroupResizeHandle, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { x: group.x, y: group.y, width: group.width, height: group.height };
    const onMoveEv = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      onResize(resizedGroupRect(orig, handle, dx, dy));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMoveEv);
      window.removeEventListener("pointerup", onUp);
      onGeometryEnd?.();
    };
    window.addEventListener("pointermove", onMoveEv);
    window.addEventListener("pointerup", onUp);
  };

  const frameStyle: React.CSSProperties = {
    left: group.x,
    top: group.y,
    width: group.width,
    height: group.height,
    backgroundColor: paint.fill,
    borderColor: paint.stroke,
    color: paint.label,
    boxShadow: selected ? `0 0 0 2px color-mix(in srgb, ${paint.stroke} 70%, transparent)` : undefined,
  };

  return (
    <>
      <div
        data-et2-canvas-group-id={group.id}
        className="absolute rounded-lg border border-dashed"
        style={{ ...frameStyle, zIndex: 5 }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
          onContextMenu?.(e);
        }}
      >
        <div
          className="flex cursor-move items-center gap-1 px-2"
          style={{ height: GROUP_HEADER_HEIGHT }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            if (editingLabel) return;
            e.stopPropagation();
            onSelect();
            onMoveStart?.();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = {
              ox: e.clientX,
              oy: e.clientY,
              sx: group.x,
              sy: group.y,
              lastDx: 0,
              lastDy: 0,
            };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            e.stopPropagation();
            const dx = (e.clientX - drag.current.ox) / zoom;
            const dy = (e.clientY - drag.current.oy) / zoom;
            const incrementDx = dx - drag.current.lastDx;
            const incrementDy = dy - drag.current.lastDy;
            drag.current.lastDx = dx;
            drag.current.lastDy = dy;
            onMove(drag.current.sx + dx, drag.current.sy + dy, { dx: incrementDx, dy: incrementDy });
          }}
          onPointerUp={(e) => {
            const wasDragging = drag.current !== null;
            drag.current = null;
            if (wasDragging) onMoveEnd?.();
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }}
        >
          {editingLabel ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={commitLabel}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded border border-sky-300 bg-white px-1 py-0.5 text-[11px] font-medium text-slate-700 outline-none"
            />
          ) : (
            <span
              className="flex-1 cursor-text truncate text-[11px] font-semibold"
              style={{ color: paint.label }}
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
        </div>
      </div>

      {selected ? (
        <div
          data-et2-export-hide="true"
          className="pointer-events-none absolute"
          style={{
            left: group.x,
            top: group.y,
            width: group.width,
            height: group.height,
            zIndex: 80,
          }}
        >
          {(Object.keys(HANDLE_POSITIONS) as GroupResizeHandle[]).map((handle) => (
            <button
              key={handle}
              type="button"
              aria-label={`Gruppengröße ändern (${handle})`}
              className={[
                "pointer-events-auto absolute rounded-sm border border-sky-600 bg-white shadow-sm",
                coarsePointer ? "h-4 w-4" : "h-2.5 w-2.5",
                HANDLE_POSITIONS[handle],
              ].join(" ")}
              onPointerDown={(e) => startResize(handle, e)}
              onClick={(e) => e.stopPropagation()}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
