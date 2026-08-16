"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { NoteMarkdownContent } from "@/components/note-markdown-content";
import { CardIconBadge } from "@/components/card-icon-badge";
import {
  aggregateNextDueOpen,
  aggregateOverdueDue,
  formatDueHint,
  isDueOverdue,
} from "@/lib/aggregates";
import { cardColorAccentClass, cardColorClass } from "@/lib/card-color";
import { canvasStackCssZIndex } from "@/lib/canvas-stack";
import { isCoarsePointerDevice } from "@/lib/coarse-pointer";
import { taskCardRect } from "@/lib/connector-geometry";
import {
  effortTotalsIsEmpty,
  formatEffortTotals,
  rollupDisplayTotals,
} from "@/lib/task-effort";
import { taskLinkHref } from "@/lib/task-link";
import { isTaskMarkedDone, tagsWithoutCompletedTag } from "@/lib/task-tags";
import { isNoteNode } from "@/lib/tree-node-kind";
import { useTaskTreeStore } from "@/store/task-tree-store";
import type { TaskNode } from "@/types/task-node";

const MIN_WIDTH = 100;
const MIN_HEIGHT = 60;
const NEST_DRAG_THRESHOLD_PX = 6;

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function canvasCardIdFromPoint(clientX: number, clientY: number, excludeId: string): string | null {
  if (typeof document === "undefined") return null;
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    if (!(el instanceof Element)) continue;
    const host = el.closest("[data-canvas-card-id]");
    if (!host) continue;
    const id = host.getAttribute("data-canvas-card-id");
    if (id && id !== excludeId) return id;
  }
  return null;
}

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

export interface TaskCanvasCardProps {
  node: TaskNode;
  completedTag: string;
  selected: boolean;
  connectSource: boolean;
  dimmed?: boolean;
  multiSelected?: boolean;
  /** True while another card is dragged over this one (nest drop). */
  nestTarget?: boolean;
  onSelect: (shiftKey?: boolean) => void;
  onDrill: () => void;
  /** Notiz: WYSIWYG-Popup öffnen. */
  onOpenNote?: () => void;
  onMove: (x: number, y: number, delta?: { dx: number; dy: number }) => void;
  onResize: (patch: { x: number; y: number; width: number; height: number }) => void;
  onRotate: (rotation: number) => void;
  onConnectHandle: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** While dragging: card under pointer that would receive a nest drop (or null). */
  onNestHoverChange?: (targetId: string | null) => void;
  /** On drag end over another card: nest this card under targetId. */
  onNestOnto?: (targetId: string) => void;
  /** On drag end over outline: return true if drop was handled. */
  onOutlineDrop?: (clientX: number, clientY: number) => boolean;
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
  multiSelected,
  nestTarget,
  onSelect,
  onDrill,
  onOpenNote,
  onMove,
  onResize,
  onRotate,
  onConnectHandle,
  onContextMenu,
  onNestHoverChange,
  onNestOnto,
  onOutlineDrop,
  zoom,
  requestTitleEdit,
  onTitleEditConsumed,
}: TaskCanvasCardProps) {
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
  const effortOnTasksEnabled = useTaskTreeStore((s) => s.effortOnTasksEnabled);
  const fieldVisibility = useTaskTreeStore((s) => s.cardFieldVisibility);
  const note = isNoteNode(node);
  const relationConnectMode = useTaskTreeStore((s) => s.relationConnectMode);
  const relationDraftSourceId = useTaskTreeStore((s) => s.relationDraftSourceId);
  /** Im Verbindungsmodus Klicks durchlassen / Verbindung abschließen statt Editor. */
  const connecting = relationConnectMode || Boolean(relationDraftSourceId);
  const done = !note && isTaskMarkedDone(node, completedTag);

  useEffect(() => {
    setCoarsePointer(isCoarsePointerDevice());
  }, []);

  const rollupDue = !note ? aggregateNextDueOpen(node, completedTag) : null;
  const rollupOverdue = !note ? aggregateOverdueDue(node, completedTag) : null;
  const dueHint =
    !note && fieldVisibility.dueDate ? formatDueHint(rollupOverdue ?? rollupDue) : null;
  const reminderHint =
    !note && fieldVisibility.reminderDate ? formatDueHint(node.reminderDate) : null;
  const effortTotals =
    !note && fieldVisibility.effort && effortOnTasksEnabled
      ? rollupDisplayTotals(node, completedTag)
      : null;
  const effortLabel =
    effortTotals && !effortTotalsIsEmpty(effortTotals)
      ? formatEffortTotals(effortTotals)
      : "";
  const overdue = !note && isDueOverdue(rollupOverdue ?? null, done);
  const allVisibleTags =
    !note && fieldVisibility.tags ? tagsWithoutCompletedTag(node.tags, completedTag) : [];
  const visibleTags = allVisibleTags.slice(0, 4);
  const showScheduleMeta = Boolean(dueHint || reminderHint || effortLabel);

  const colorClass = note
    ? "bg-yellow-50 border-yellow-200/80"
    : cardColorClass(node.cardColor) ?? "bg-white border-slate-200/60";
  const accent = note
    ? "bg-yellow-400"
    : cardColorAccentClass(node.cardColor) ?? "bg-slate-300";

  const hasChildren = node.children.length > 0;
  const linkHref = !note ? taskLinkHref(node.link) : null;
  const showHandles = selected || hovered;

  const beginEdit = () => {
    onSelect(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestTitleEdit]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    if (node.title.trim()) el.select();
  }, [editing, node.title]);

  useEffect(() => {
    if (!selected && editingRef.current) commitTitle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (!editing) setDraft(node.title);
  }, [node.title, editing]);

  const onTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
    else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  };

  const ROTATION_SNAP = 15;

  /** E2-style resize: 8 handles, opposite edge/corner stays anchored. */
  const startResize = (handle: ResizeHandle, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { x: rect.x, y: rect.y, width: rect.w, height: rect.h };
    const onMoveEv = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      let x = orig.x;
      let y = orig.y;
      let width = orig.width;
      let height = orig.height;
      if (handle.includes("e")) width = Math.max(MIN_WIDTH, orig.width + dx);
      if (handle.includes("s")) height = Math.max(MIN_HEIGHT, orig.height + dy);
      if (handle.includes("w")) {
        const nextWidth = Math.max(MIN_WIDTH, orig.width - dx);
        x = orig.x + (orig.width - nextWidth);
        width = nextWidth;
      }
      if (handle.includes("n")) {
        const nextHeight = Math.max(MIN_HEIGHT, orig.height - dy);
        y = orig.y + (orig.height - nextHeight);
        height = nextHeight;
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

  /** E2-style global rotation with shift-snap. */
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
    const onMove = (ev: PointerEvent) => {
      const delta = angleAt(ev.clientX, ev.clientY) - startAngle;
      let next = startRotation + delta;
      if (ev.shiftKey) {
        next = Math.round(next / ROTATION_SNAP) * ROTATION_SNAP;
      }
      onRotate(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      data-canvas-card-id={node.id}
      className={[
        "group/card absolute flex flex-col rounded-xl border transition-all duration-150",
        editing ? "" : "select-none cursor-grab active:cursor-grabbing",
        colorClass,
        selected
          ? multiSelected
            ? "ring-[3px] ring-teal-400 ring-offset-2 shadow-[0_0_0_6px_rgba(45,212,191,0.35)] shadow-xl outline outline-2 outline-teal-600/80"
            : "ring-2 ring-teal-500 ring-offset-1 shadow-xl"
          : hovered
            ? "shadow-lg shadow-slate-900/10"
            : "shadow-md shadow-slate-900/5",
        connectSource ? "ring-2 ring-amber-400 shadow-xl" : "",
        nestTarget ? "ring-2 ring-violet-500 ring-offset-2 shadow-xl shadow-violet-500/30 scale-[1.02]" : "",
        done ? "opacity-50 saturate-50" : "",
        overdue ? "border-red-300/90" : "",
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
        zIndex: canvasStackCssZIndex(node, {
          selected: selected || nestTarget,
          hovered,
          connectSource,
          editing,
        }),
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => { if (!drag.current) setHovered(false); }}
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
        if (!drag.current) return;
        if (editing) return;
        e.stopPropagation();
        const dxPx = e.clientX - drag.current.ox;
        const dyPx = e.clientY - drag.current.oy;
        if (!drag.current.moved && Math.abs(dxPx) + Math.abs(dyPx) >= NEST_DRAG_THRESHOLD_PX) {
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
        if (drag.current.moved) {
          onNestHoverChange?.(canvasCardIdFromPoint(e.clientX, e.clientY, node.id));
        }
      }}
      onPointerUp={(e) => {
        const state = drag.current;
        drag.current = null;
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ }
        onNestHoverChange?.(null);
        if (!state?.moved || editing) return;
        if (onOutlineDrop?.(e.clientX, e.clientY)) return;
        const targetId = canvasCardIdFromPoint(e.clientX, e.clientY, node.id);
        if (targetId) onNestOnto?.(targetId);
      }}
      onPointerCancel={() => {
        drag.current = null;
        onNestHoverChange?.(null);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (editing || (e.target as Element | null)?.closest("[data-card-title]")) return;
        if (note) {
          onOpenNote?.();
          return;
        }
        onDrill();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e);
      }}
    >
      {/* Accent bar */}
      <div className={`h-2 w-full shrink-0 rounded-t-xl ${accent}`} />

      {/* Card body */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-3 py-2">
        {/* Title row */}
        <div className="flex items-start justify-between gap-1.5">
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
              className="min-w-0 flex-1 rounded-md border border-sky-300 bg-white px-1.5 py-0.5 text-[13px] font-semibold text-slate-900 outline-none ring-2 ring-sky-200/60"
              aria-label="Titel"
            />
          ) : (
            <span
              data-card-title
              className="flex max-w-full w-fit cursor-text items-start gap-1.5 text-[13px] font-semibold leading-snug text-slate-900"
              onPointerDown={(e) => {
                if (connecting) return;
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (connecting) {
                  onSelect(false);
                  return;
                }
                beginEdit();
              }}
            >
              {!note ? <CardIconBadge icon={node.cardIcon} className="mt-0.5" /> : null}
              <span className="line-clamp-3">
                {node.title.trim() || <span className="text-slate-400 font-normal italic">Ohne Titel</span>}
              </span>
            </span>
          )}

          {/* Child indicator badge */}
          {hasChildren && (
            <button
              type="button"
              title={`${node.children.length} Unterkarte${node.children.length > 1 ? "n" : ""} — Doppelklick zum Öffnen`}
              className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDrill(); }}
            >
              <svg className="h-2.5 w-2.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 4h4v4H2V4zm0 6h4v4H2v-4zm6-6h4v4H8V4zm6 0h2v2h-2V4zM8 10h4v4H8v-4z" opacity="0.7" />
              </svg>
              {node.children.length}
            </button>
          )}
        </div>

        {/* Link */}
        {linkHref && (
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            title={linkHref}
            className="group/link flex items-center gap-1.5 truncate rounded-md bg-sky-50/80 px-2 py-1 text-[11px] text-sky-700 no-underline transition-colors hover:bg-sky-100 hover:text-sky-900"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="h-3 w-3 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span className="truncate group-hover/link:underline">
              {(() => { try { const u = new URL(linkHref); return u.hostname.replace("www.", ""); } catch { return linkHref; } })()}
            </span>
          </a>
        )}

        {/* Description */}
        {!note && fieldVisibility.description && node.description.trim() ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <p className="text-[11px] leading-relaxed text-slate-500 overflow-hidden" style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: "unset" }}>{node.description}</p>
          </div>
        ) : null}

        {/* Note markdown — Klick öffnet WYSIWYG-Popup */}
        {note ? (
          <button
            type="button"
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md text-left hover:bg-yellow-100/60"
            title={connecting ? "Als Verbindungsziel wählen" : "Notiz bearbeiten"}
            onPointerDown={(e) => {
              if (connecting) return;
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (connecting) {
                onSelect(false);
                return;
              }
              onOpenNote?.();
            }}
          >
            {node.markdown?.trim() ? (
              <NoteMarkdownContent markdown={node.markdown} fillContainer />
            ) : (
              <p className="px-0.5 text-[11px] italic text-slate-400">
                Leere Notiz — klicken zum Bearbeiten
              </p>
            )}
          </button>
        ) : null}

        {/* Due / reminder / effort (incl. rolled-up Σ) */}
        {showScheduleMeta ? (
          <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5">
            {dueHint ? (
              <span
                className={[
                  "text-[10px] tabular-nums",
                  overdue ? "font-semibold text-red-600" : "text-slate-500",
                ].join(" ")}
                title="Fälligkeit (inkl. Unterkarten)"
              >
                {dueHint}
              </span>
            ) : null}
            {reminderHint ? (
              <span className="text-[10px] tabular-nums text-amber-700/90" title="Erinnerung">
                Erin. {reminderHint}
              </span>
            ) : null}
            {effortLabel ? (
              <span
                className="text-[10px] tabular-nums text-slate-600"
                title="Aufwand inkl. Summe der Unterkarten"
              >
                Σ {effortLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Tags */}
        {visibleTags.length > 0 ? (
          <div className={[showScheduleMeta ? "pt-0.5" : "mt-auto pt-0.5", "flex flex-wrap gap-1"].join(" ")}>
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
            {allVisibleTags.length > 4 ? (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                +{allVisibleTags.length - 4}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* === Handles (appear on hover/select) === */}

      {/* Connect handle — right edge */}
      <div
        className={[
          "absolute -right-3 top-1/2 z-30 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-white shadow-md transition-all duration-100",
          connectSource
            ? "border-amber-400 text-amber-600 scale-110"
            : "border-slate-300 text-slate-400 hover:border-teal-500 hover:text-teal-600 hover:scale-110",
          showHandles ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        title="Verbinden — Klicken um Pfeil zu starten"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onConnectHandle(); }}
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>

      {/* Resize handles — E2-style 8 handles (only single-select) */}
      {selected && !multiSelected && !editing &&
        (Object.keys(HANDLE_POSITIONS) as ResizeHandle[]).map((handle) => (
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
        ))}

      {/* Rotation handle — top-center, E2-style with Shift=15° snap */}
      {selected && !multiSelected && !editing && (
        <button
          type="button"
          aria-label="Drehen"
          title="Drehen (Shift: 15°-Raster)"
          className="absolute left-1/2 top-0 z-20 flex h-5 w-5 -translate-x-1/2 -translate-y-7 cursor-grab items-center justify-center rounded-full border border-sky-600 bg-white text-sky-700 shadow-sm active:cursor-grabbing"
          onPointerDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); startRotateGlobal(e); }}
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          </svg>
        </button>
      )}

      {/* Drill-in indicator — bottom-right subtle arrow (only on hover, when has children) */}
      {hasChildren && !selected && hovered && (
        <div className="absolute bottom-1.5 right-2 text-[10px] text-slate-400 pointer-events-none">
          ⏎
        </div>
      )}
    </div>
  );
}
