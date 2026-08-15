"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { isCoarsePointerDevice } from "@/lib/coarse-pointer";
import { canvasStackCssZIndex } from "@/lib/canvas-stack";
import { taskCardRect } from "@/lib/connector-geometry";
import { getSymbolTypeDefinition, type SymbolType } from "@/lib/diagram-symbol";
import { useTaskTreeStore } from "@/store/task-tree-store";
import type { TaskNode } from "@/types/task-node";

const MIN_SIZE = 40;
const ROTATION_SNAP = 15;

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const HANDLE_POSITIONS: Record<ResizeHandle, string> = {
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
};

function SymbolShape({ type }: { type: SymbolType }) {
  const stroke = "#334155";
  const fill = "#f8fafc";

  if (type === "actor") {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 72 120" preserveAspectRatio="xMidYMin meet">
        <circle cx="36" cy="18" r="12" fill={fill} stroke={stroke} strokeWidth="2" />
        <line x1="36" y1="30" x2="36" y2="68" stroke={stroke} strokeWidth="2" />
        <line x1="16" y1="48" x2="56" y2="48" stroke={stroke} strokeWidth="2" />
        <line x1="36" y1="68" x2="18" y2="100" stroke={stroke} strokeWidth="2" />
        <line x1="36" y1="68" x2="54" y2="100" stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }

  if (type === "useCase") {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 80" preserveAspectRatio="none">
        <ellipse cx="80" cy="40" rx="76" ry="36" fill={fill} stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }

  if (type === "systemBoundary") {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 280" preserveAspectRatio="none">
        <rect
          x="4"
          y="4"
          width="352"
          height="272"
          fill="transparent"
          stroke={stroke}
          strokeWidth="2"
          strokeDasharray="8 5"
        />
      </svg>
    );
  }

  if (type === "process") {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 72" preserveAspectRatio="none">
        <rect x="2" y="2" width="156" height="68" rx="10" ry="10" fill={fill} stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }

  if (type === "decision") {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 120 120" preserveAspectRatio="none">
        <polygon points="60,4 116,60 60,116 4,60" fill={fill} stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }

  if (type === "terminator") {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 120 56" preserveAspectRatio="none">
        <rect x="2" y="2" width="116" height="52" rx="26" ry="26" fill={fill} stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }

  // document
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 140 90" preserveAspectRatio="none">
      <path
        d="M4 4 H136 V68 Q105 82 70 68 Q35 54 4 68 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface TaskCanvasSymbolProps {
  node: TaskNode;
  selected: boolean;
  connectSource: boolean;
  dimmed?: boolean;
  multiSelected?: boolean;
  onSelect: (shiftKey?: boolean) => void;
  onMove: (x: number, y: number, delta?: { dx: number; dy: number }) => void;
  onResize: (patch: { x: number; y: number; width: number; height: number }) => void;
  onRotate: (rotation: number) => void;
  onConnectHandle: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  zoom: number;
  requestTitleEdit?: boolean;
  onTitleEditConsumed?: () => void;
}

export function TaskCanvasSymbol({
  node,
  selected,
  connectSource,
  dimmed,
  multiSelected,
  onSelect,
  onMove,
  onResize,
  onRotate,
  onConnectHandle,
  onContextMenu,
  zoom,
  requestTitleEdit,
  onTitleEditConsumed,
}: TaskCanvasSymbolProps) {
  const symbolType = node.symbolType ?? "process";
  const def = getSymbolTypeDefinition(symbolType);
  const rect = taskCardRect(node);
  const drag = useRef<{
    ox: number;
    oy: number;
    sx: number;
    sy: number;
    lastDx: number;
    lastDy: number;
    moved: boolean;
  } | null>(null);
  const editingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const updateCard = useTaskTreeStore((s) => s.updateCard);

  useEffect(() => {
    setCoarsePointer(isCoarsePointerDevice());
  }, []);

  useEffect(() => {
    setDraft(node.title);
  }, [node.title]);

  useEffect(() => {
    if (!requestTitleEdit) return;
    setEditing(true);
    editingRef.current = true;
    setDraft(node.title);
    onTitleEditConsumed?.();
    queueMicrotask(() => inputRef.current?.focus());
  }, [requestTitleEdit, node.title, onTitleEditConsumed]);

  const beginEdit = () => {
    setEditing(true);
    editingRef.current = true;
    setDraft(node.title);
    queueMicrotask(() => inputRef.current?.focus());
  };

  const commitTitle = () => {
    setEditing(false);
    editingRef.current = false;
    if (draft !== node.title) updateCard(node.id, { title: draft });
  };

  const onTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft(node.title);
      setEditing(false);
      editingRef.current = false;
    }
  };

  const showHandles = selected || hovered || connectSource;
  const titleOnShape = symbolType !== "actor";
  const zIndex = canvasStackCssZIndex(node, {
    selected,
    hovered,
    connectSource,
    editing,
  });

  const startResize = (handle: ResizeHandle, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = rect.x;
    const oy = rect.y;
    const ow = rect.w;
    const oh = rect.h;
    const onMoveEv = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      let x = ox;
      let y = oy;
      let width = ow;
      let height = oh;
      if (handle.includes("e")) width = Math.max(MIN_SIZE, ow + dx);
      if (handle.includes("s")) height = Math.max(MIN_SIZE, oh + dy);
      if (handle.includes("w")) {
        width = Math.max(MIN_SIZE, ow - dx);
        x = ox + ow - width;
      }
      if (handle.includes("n")) {
        height = Math.max(MIN_SIZE, oh - dy);
        y = oy + oh - height;
      }
      onResize({ x, y, width, height });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMoveEv);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMoveEv);
    window.addEventListener("pointerup", onUp);
  };

  const startRotateGlobal = (e: React.PointerEvent) => {
    const cardEl = e.currentTarget.parentElement as HTMLElement;
    if (!cardEl) return;
    const getCenter = () => {
      const r = cardEl.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const angleAt = (cx: number, cy: number) => {
      const c = getCenter();
      return (Math.atan2(cy - c.y, cx - c.x) * 180) / Math.PI;
    };
    const startAngle = angleAt(e.clientX, e.clientY);
    const startRotation = node.rotation ?? 0;
    const onMoveEv = (ev: PointerEvent) => {
      const delta = angleAt(ev.clientX, ev.clientY) - startAngle;
      let next = startRotation + delta;
      if (ev.shiftKey) next = Math.round(next / ROTATION_SNAP) * ROTATION_SNAP;
      onRotate(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMoveEv);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMoveEv);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      data-canvas-card-id={node.id}
      data-canvas-symbol={symbolType}
      className={[
        "group/card absolute",
        editing ? "" : "select-none cursor-grab active:cursor-grabbing",
        selected
          ? multiSelected
            ? "ring-[3px] ring-teal-400 ring-offset-2"
            : "ring-2 ring-teal-500 ring-offset-1"
          : "",
        connectSource ? "ring-2 ring-amber-400" : "",
        dimmed ? "opacity-25" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
        transformOrigin: "center center",
        zIndex,
      }}
      title={def.label}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        if (!drag.current) setHovered(false);
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        if (editing) return;
        onSelect(e.shiftKey);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = {
          ox: e.clientX,
          oy: e.clientY,
          sx: rect.x,
          sy: rect.y,
          lastDx: 0,
          lastDy: 0,
          moved: false,
        };
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerMove={(e) => {
        if (!drag.current || editing) return;
        e.stopPropagation();
        const dxPx = e.clientX - drag.current.ox;
        const dyPx = e.clientY - drag.current.oy;
        if (!drag.current.moved && Math.abs(dxPx) + Math.abs(dyPx) >= 4) {
          drag.current.moved = true;
        }
        const dx = dxPx / zoom;
        const dy = dyPx / zoom;
        if (multiSelected) {
          const incrementDx = dx - drag.current.lastDx;
          const incrementDy = dy - drag.current.lastDy;
          drag.current.lastDx = dx;
          drag.current.lastDy = dy;
          onMove(drag.current.sx + dx, drag.current.sy + dy, { dx: incrementDx, dy: incrementDy });
        } else {
          onMove(drag.current.sx + dx, drag.current.sy + dy);
        }
      }}
      onPointerUp={(e) => {
        drag.current = null;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* */
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e);
      }}
    >
      <SymbolShape type={symbolType} />

      {titleOnShape ? (
        <div
          className={[
            "absolute inset-0 z-10 flex items-center justify-center px-2",
            symbolType === "systemBoundary" ? "items-start pt-2" : "",
          ].join(" ")}
        >
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
              className="w-full max-w-[90%] rounded-md border border-sky-300 bg-white px-1.5 py-0.5 text-center text-[12px] font-semibold text-slate-900 outline-none ring-2 ring-sky-200/60"
              aria-label="Titel"
            />
          ) : (
            <span
              data-card-title
              className={[
                "max-w-full cursor-text text-center text-[12px] font-semibold leading-snug text-slate-900",
                symbolType === "decision" ? "line-clamp-2 px-4" : "line-clamp-3",
                symbolType === "systemBoundary" ? "bg-white/90 px-1" : "",
              ].join(" ")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                beginEdit();
              }}
            >
              {node.title.trim() || (
                <span className="font-normal italic text-slate-400">{def.defaultTitle}</span>
              )}
            </span>
          )}
        </div>
      ) : editing ? (
        <input
          ref={inputRef}
          data-card-title
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onTitleKeyDown}
          onBlur={commitTitle}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-1/2 z-10 w-[90%] -translate-x-1/2 rounded-md border border-sky-300 bg-white px-1 py-0.5 text-center text-[11px] outline-none"
          aria-label="Titel"
        />
      ) : (
        <button
          type="button"
          data-card-title
          className="absolute bottom-0 left-1/2 z-10 max-w-[95%] -translate-x-1/2 truncate rounded-sm bg-white/95 px-1.5 py-0.5 text-center text-[11px] font-medium text-slate-800 ring-1 ring-slate-200/80"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            beginEdit();
          }}
        >
          {node.title.trim() || def.defaultTitle}
        </button>
      )}

      <div
        className={[
          "absolute -right-3 top-1/2 z-30 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-white shadow-md transition-all duration-100",
          connectSource
            ? "border-amber-400 text-amber-600 scale-110"
            : "border-slate-300 text-slate-400 hover:border-teal-500 hover:text-teal-600 hover:scale-110",
          showHandles ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        title="Verbinden"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onConnectHandle();
        }}
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>

      {selected && !multiSelected && !editing
        ? (Object.keys(HANDLE_POSITIONS) as ResizeHandle[]).map((handle) => (
            <button
              key={handle}
              type="button"
              aria-label={`Größe ändern (${handle})`}
              className={[
                "absolute z-20 rounded-sm border border-sky-600 bg-white shadow-sm",
                coarsePointer ? "h-4 w-4" : "h-2.5 w-2.5",
                HANDLE_POSITIONS[handle],
              ].join(" ")}
              onPointerDown={(e) => startResize(handle, e)}
            />
          ))
        : null}

      {selected && !multiSelected && !editing ? (
        <button
          type="button"
          aria-label="Drehen"
          className="absolute -top-5 left-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 cursor-grab rounded-full border border-sky-600 bg-white shadow-sm active:cursor-grabbing"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            startRotateGlobal(e);
          }}
        />
      ) : null}
    </div>
  );
}
