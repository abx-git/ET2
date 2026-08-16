"use client";

import { useDroppable } from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TaskCanvasCard } from "@/components/task-canvas-card";
import { TaskCanvasSymbol } from "@/components/task-canvas-symbol";
import { TaskConnectors } from "@/components/task-connectors";
import { TaskDetailSidebar } from "@/components/task-detail-sidebar";
import { CanvasGroupBox } from "@/components/canvas-group-box";
import { KeyboardShortcutsHelpDialog } from "@/components/keyboard-shortcuts-help-dialog";
import { contextChildren } from "@/lib/board-context";
import { nodeMatchesBoardFilters } from "@/lib/board-filters";
import { nodeHasCanvasPosition } from "@/lib/canvas-layout";
import { compareCanvasStackOrder } from "@/lib/canvas-stack";
import { isNodeInsideGroup } from "@/lib/canvas-group";
import {
  DEFAULT_CANVAS_VIEWPORT,
  fitViewportToBounds,
  screenToWorld,
  unionWorldBounds,
  zoomAtPoint,
  ZOOM_STEP,
  type CanvasViewport,
} from "@/lib/canvas-viewport";
import { CANVAS_DROP_TARGET_ID } from "@/lib/clipboard-dnd";
import { taskCardRect } from "@/lib/connector-geometry";
import {
  defaultSymbolSize,
  listSymbolTypesByGroup,
  SYMBOL_GROUP_LABELS,
  type SymbolType,
} from "@/lib/diagram-symbol";
import { exportCanvasAsPrompt } from "@/lib/prompt-export";
import { relationsForContext } from "@/lib/task-relations";
import { isTaskMarkedDone } from "@/lib/task-tags";
import { shouldIgnoreCardKeyboard } from "@/lib/card-keyboard-nav";
import { isCardNode, isNoteNode, isSymbolNode } from "@/lib/tree-node-kind";
import { outlineDropFromClientPoint } from "@/lib/outline-dnd";
import { useTaskTreeStore } from "@/store/task-tree-store";
import {
  TASK_RELATION_TYPE_LABELS,
  TASK_RELATION_TYPES,
  type TaskRelationType,
} from "@/types/task-relation";

const WORLD_W = 4000;
const WORLD_H = 3000;

const EMPTY_GROUPS: import("@/lib/canvas-group").CanvasGroup[] = [];

interface LassoRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function TaskCanvas({
  onOpenNoteEditor,
}: {
  /** Öffnet den WYSIWYG-Notiz-Dialog (Parent hält NoteEditorDialog). */
  onOpenNoteEditor?: (nodeId: string) => void;
} = {}) {
  const roots = useTaskTreeStore((s) => s.roots);
  const contextNodeId = useTaskTreeStore((s) => s.contextNodeId);
  const relations = useTaskTreeStore((s) => s.relations);
  const completedTag = useTaskTreeStore((s) => s.completedTag);
  const canvasViewport = useTaskTreeStore((s) => s.canvasViewport);
  const setCanvasViewport = useTaskTreeStore((s) => s.setCanvasViewport);
  const ensureContextCanvasLayout = useTaskTreeStore((s) => s.ensureContextCanvasLayout);
  const moveCanvasNode = useTaskTreeStore((s) => s.moveCanvasNode);
  const moveCanvasNodesBy = useTaskTreeStore((s) => s.moveCanvasNodesBy);
  const resizeCanvasNode = useTaskTreeStore((s) => s.resizeCanvasNode);
  const rotateCanvasNode = useTaskTreeStore((s) => s.rotateCanvasNode);
  const reorderCanvasNodeZIndex = useTaskTreeStore((s) => s.reorderCanvasNodeZIndex);
  const drillIntoNode = useTaskTreeStore((s) => s.drillIntoNode);
  const addCardAfter = useTaskTreeStore((s) => s.addCardAfter);
  const addNoteAfter = useTaskTreeStore((s) => s.addNoteAfter);
  const addSymbolAfter = useTaskTreeStore((s) => s.addSymbolAfter);
  const removeCard = useTaskTreeStore((s) => s.removeCard);
  const moveNodesToClipboard = useTaskTreeStore((s) => s.moveNodesToClipboard);
  const connectTasks = useTaskTreeStore((s) => s.connectTasks);
  const reconnectRelation = useTaskTreeStore((s) => s.reconnectRelation);
  const disconnectRelation = useTaskTreeStore((s) => s.disconnectRelation);
  const selectedRelationId = useTaskTreeStore((s) => s.selectedRelationId);
  const setSelectedRelationId = useTaskTreeStore((s) => s.setSelectedRelationId);
  const selectedCanvasNodeId = useTaskTreeStore((s) => s.selectedCanvasNodeId);
  const setSelectedCanvasNodeId = useTaskTreeStore((s) => s.setSelectedCanvasNodeId);
  const selectedCanvasNodeIds = useTaskTreeStore((s) => s.selectedCanvasNodeIds);
  const toggleCanvasNodeSelected = useTaskTreeStore((s) => s.toggleCanvasNodeSelected);
  const clearCanvasMultiSelect = useTaskTreeStore((s) => s.clearCanvasMultiSelect);
  const relationConnectMode = useTaskTreeStore((s) => s.relationConnectMode);
  const setRelationConnectMode = useTaskTreeStore((s) => s.setRelationConnectMode);
  const relationDraftSourceId = useTaskTreeStore((s) => s.relationDraftSourceId);
  const setRelationDraftSourceId = useTaskTreeStore((s) => s.setRelationDraftSourceId);
  const defaultRelationType = useTaskTreeStore((s) => s.defaultRelationType);
  const setDefaultRelationType = useTaskTreeStore((s) => s.setDefaultRelationType);
  const applyOutlineDrag = useTaskTreeStore((s) => s.applyOutlineDrag);
  const hideCompletedTasks = useTaskTreeStore((s) => s.hideCompletedTasks);
  const filterTags = useTaskTreeStore((s) => s.filterTags);
  const filterExcludeTags = useTaskTreeStore((s) => s.filterExcludeTags);
  const filterColors = useTaskTreeStore((s) => s.filterColors);
  const filterScheduleKinds = useTaskTreeStore((s) => s.filterScheduleKinds);
  const filterCombineMode = useTaskTreeStore((s) => s.filterCombineMode);

  const canvasGroups = useTaskTreeStore((s) => s.canvasGroups[s.contextNodeId ?? "__root__"] || EMPTY_GROUPS);
  const addCanvasGroup = useTaskTreeStore((s) => s.addCanvasGroup);
  const updateCanvasGroup = useTaskTreeStore((s) => s.updateCanvasGroup);
  const removeCanvasGroup = useTaskTreeStore((s) => s.removeCanvasGroup);

  const shellRef = useRef<HTMLDivElement>(null);
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [pendingTitleEditId, setPendingTitleEditId] = useState<string | null>(null);
  const [lasso, setLasso] = useState<LassoRect | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [nestHoverId, setNestHoverId] = useState<string | null>(null);
  const [symbolPaletteOpen, setSymbolPaletteOpen] = useState(false);
  const [placingSymbolType, setPlacingSymbolType] = useState<SymbolType | null>(null);
  const [contextSymbolGroup, setContextSymbolGroup] = useState<"useCase" | "flowchart" | null>(null);
  const panStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const spaceDown = useRef(false);
  const multiDrag = useRef<{ ox: number; oy: number } | null>(null);
  const lassoJustFinished = useRef(false);
  const panMoved = useRef(false);

  const contextKids = useMemo(
    () => contextChildren(roots, contextNodeId, { includeSymbols: true }),
    [roots, contextNodeId],
  );
  const needsCanvasLayout = contextKids.some((n) => !nodeHasCanvasPosition(n));

  useEffect(() => {
    if (!needsCanvasLayout) return;
    ensureContextCanvasLayout();
  }, [needsCanvasLayout, contextNodeId, ensureContextCanvasLayout]);

  const filterOpts = useMemo(
    () => ({
      filterTags,
      filterExcludeTags,
      filterColors,
      filterScheduleKinds,
      filterCombineMode,
    }),
    [filterTags, filterExcludeTags, filterColors, filterScheduleKinds, filterCombineMode],
  );

  const filtersActive =
    filterTags.length > 0 ||
    filterExcludeTags.length > 0 ||
    filterColors.length > 0 ||
    filterScheduleKinds.length > 0;

  const nodes = useMemo(() => {
    return contextKids.filter((n) => {
      if (isSymbolNode(n)) return true;
      if (hideCompletedTasks && isTaskMarkedDone(n, completedTag)) return false;
      if (!filtersActive) return true;
      if (isNoteNode(n)) return filterExcludeTags.length === 0;
      return nodeMatchesBoardFilters(n, filterOpts);
    });
  }, [
    contextKids,
    hideCompletedTasks,
    completedTag,
    filtersActive,
    filterOpts,
    filterExcludeTags.length,
  ]);

  const visibleIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const visibleRelations = useMemo(
    () => relationsForContext(relations, visibleIds),
    [relations, visibleIds],
  );

  // Check if a node is in the lasso selection area
  const isNodeInLasso = useCallback(
    (nodeId: string, lassoRect: LassoRect) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return false;
      const r = taskCardRect(node);
      const lx = Math.min(lassoRect.x1, lassoRect.x2);
      const ly = Math.min(lassoRect.y1, lassoRect.y2);
      const lw = Math.abs(lassoRect.x2 - lassoRect.x1);
      const lh = Math.abs(lassoRect.y2 - lassoRect.y1);
      // Intersection check
      return !(r.x > lx + lw || r.x + r.w < lx || r.y > ly + lh || r.y + r.h < ly);
    },
    [nodes],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Space = Canvas-Pan; nicht abfangen in Inputs / contentEditable (MDX-Notiz-Editor).
      if (e.code === "Space" && !shouldIgnoreCardKeyboard(e)) {
        spaceDown.current = true;
        setSpaceHeld(true);
        e.preventDefault();
      }
      if (e.key === "Escape") {
        setRelationConnectMode(false);
        setRelationDraftSourceId(null);
        setSelectedRelationId(null);
        setSelectedCanvasNodeId(null);
        clearCanvasMultiSelect();
        setContextMenu(null);
        setPlacingSymbolType(null);
        setSymbolPaletteOpen(false);
        setContextSymbolGroup(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedRelationId) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
        e.preventDefault();
        disconnectRelation(selectedRelationId);
      }
      // Select all with Ctrl/Cmd+A
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
        e.preventDefault();
        const store = useTaskTreeStore.getState();
        if (store.boardViewMode === "canvas") {
          const allIds = nodes.map((n) => n.id);
          useTaskTreeStore.setState({ selectedCanvasNodeIds: allIds, selectedCanvasNodeId: null });
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown.current = false;
        setSpaceHeld(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    disconnectRelation,
    nodes,
    selectedRelationId,
    setRelationConnectMode,
    setRelationDraftSourceId,
    setSelectedRelationId,
    setSelectedCanvasNodeId,
    clearCanvasMultiSelect,
  ]);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const vp = useTaskTreeStore.getState().canvasViewport;
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setCanvasViewport(zoomAtPoint(vp, delta, e.clientX, e.clientY, rect));
        return;
      }
      setCanvasViewport({
        ...vp,
        x: vp.x - e.deltaX,
        y: vp.y - e.deltaY,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setCanvasViewport]);

  const placeSymbolAtWorld = useCallback(
    (symbolType: SymbolType, worldX: number, worldY: number) => {
      const size = defaultSymbolSize(symbolType);
      const id = addSymbolAfter(contextNodeId, symbolType);
      moveCanvasNode(id, worldX - size.width / 2, worldY - size.height / 2);
      setSelectedCanvasNodeId(id);
      setPendingTitleEditId(id);
      return id;
    },
    [addSymbolAfter, contextNodeId, moveCanvasNode, setSelectedCanvasNodeId],
  );

  const beginPan = useCallback(
    (clientX: number, clientY: number, vp: CanvasViewport) => {
      setPanning(true);
      panMoved.current = false;
      panStart.current = { x: clientX, y: clientY, vx: vp.x, vy: vp.y };
    },
    [],
  );

  const isCanvasBackgroundTarget = (target: EventTarget | null, currentTarget: EventTarget) => {
    if (target === currentTarget) return true;
    return target instanceof HTMLElement && target.classList.contains("et2-canvas-world");
  };

  const handleCardConnect = useCallback(
    (nodeId: string) => {
      const draft = useTaskTreeStore.getState().relationDraftSourceId;
      if (!draft) {
        setRelationConnectMode(true);
        setRelationDraftSourceId(nodeId);
        return;
      }
      if (draft === nodeId) {
        setRelationDraftSourceId(null);
        return;
      }
      connectTasks(draft, nodeId);
      setRelationConnectMode(false);
    },
    [connectTasks, setRelationConnectMode, setRelationDraftSourceId],
  );

  const handleNestOnto = useCallback(
    (activeId: string, targetId: string) => {
      if (activeId === targetId) return;
      const target = nodes.find((n) => n.id === targetId);
      if (target && isSymbolNode(target)) return;
      applyOutlineDrag(activeId, { kind: "nest", targetId });
      setNestHoverId(null);
    },
    [applyOutlineDrag, nodes],
  );

  /** Canvas-Karte/Notiz in die Struktur links legen (Pointer-Bridge). */
  const handleDropOnOutline = useCallback(
    (nodeId: string, clientX: number, clientY: number): boolean => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || isSymbolNode(node)) return false;
      if (!isCardNode(node) && !isNoteNode(node)) return false;
      const drop = outlineDropFromClientPoint(clientX, clientY);
      if (!drop) return false;
      applyOutlineDrag(nodeId, drop);
      return true;
    },
    [applyOutlineDrag, nodes],
  );

  const { setNodeRef: setCanvasDropRef, isOver: canvasDropOver } = useDroppable({
    id: CANVAS_DROP_TARGET_ID,
    data: { kind: "canvasDrop" as const },
  });

  const setShellRef = useCallback(
    (el: HTMLDivElement | null) => {
      shellRef.current = el;
      setCanvasDropRef(el);
    },
    [setCanvasDropRef],
  );

  const fitAllCardsInView = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const rects = [
      ...nodes.map((n) => taskCardRect(n)),
      ...canvasGroups.map((g) => ({ x: g.x, y: g.y, w: g.width, h: g.height })),
    ];
    const bounds = unionWorldBounds(rects);
    if (!bounds) {
      setCanvasViewport({ ...DEFAULT_CANVAS_VIEWPORT });
      return;
    }
    setCanvasViewport(fitViewportToBounds(bounds, width, height));
  }, [nodes, canvasGroups, setCanvasViewport]);

  const handleCardSelect = useCallback(
    (nodeId: string, shiftKey: boolean) => {
      if (shiftKey) {
        toggleCanvasNodeSelected(nodeId);
      } else {
        // If the card is already part of a multi-selection, keep the selection
        // (so user can drag the group without losing it)
        const multiIds = useTaskTreeStore.getState().selectedCanvasNodeIds;
        if (multiIds.length > 1 && multiIds.includes(nodeId)) {
          // Already in multi-select, just set as primary for detail sidebar
          useTaskTreeStore.setState({ selectedCanvasNodeId: nodeId });
          return;
        }
        setSelectedCanvasNodeId(nodeId);
        if (relationConnectMode && relationDraftSourceId && relationDraftSourceId !== nodeId) {
          connectTasks(relationDraftSourceId, nodeId);
          setRelationConnectMode(false);
        } else if (relationConnectMode && !relationDraftSourceId) {
          setRelationDraftSourceId(nodeId);
        }
      }
    },
    [
      toggleCanvasNodeSelected,
      setSelectedCanvasNodeId,
      relationConnectMode,
      relationDraftSourceId,
      connectTasks,
      setRelationConnectMode,
      setRelationDraftSourceId,
    ],
  );

  const handleCardMove = useCallback(
    (nodeId: string, x: number, y: number, isMultiDragDelta?: { dx: number; dy: number }) => {
      const multiIds = useTaskTreeStore.getState().selectedCanvasNodeIds;
      if (multiIds.length > 1 && multiIds.includes(nodeId) && isMultiDragDelta) {
        moveCanvasNodesBy(isMultiDragDelta.dx, isMultiDragDelta.dy);
      } else {
        moveCanvasNode(nodeId, x, y);
      }
    },
    [moveCanvasNode, moveCanvasNodesBy],
  );

  // Lasso rect in screen coords to world
  const lassoToWorld = useCallback(
    (screenLasso: LassoRect): LassoRect => {
      const el = shellRef.current;
      if (!el) return screenLasso;
      const r = el.getBoundingClientRect();
      const w1 = screenToWorld(canvasViewport, screenLasso.x1, screenLasso.y1, r);
      const w2 = screenToWorld(canvasViewport, screenLasso.x2, screenLasso.y2, r);
      return { x1: w1.x, y1: w1.y, x2: w2.x, y2: w2.y };
    },
    [canvasViewport],
  );

  return (
    <div className="flex h-full min-h-0 flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
        <button
          type="button"
          className={[
            "rounded border px-2 py-1",
            relationConnectMode
              ? "border-amber-500 bg-amber-50 text-amber-900"
              : "border-slate-300 bg-white hover:bg-slate-100",
          ].join(" ")}
          onClick={() => {
            const next = !relationConnectMode;
            setRelationConnectMode(next);
            if (!next) setRelationDraftSourceId(null);
          }}
        >
          Verbinden
        </button>
        <label className="flex items-center gap-1">
          Neuer Pfeil
          <select
            className="rounded border border-slate-300 bg-white px-1 py-0.5"
            value={defaultRelationType}
            title="Typ für neu gezogene Verbindungen (Richtung: Quelle → Ziel)"
            onChange={(e) => setDefaultRelationType(e.target.value as TaskRelationType)}
          >
            {TASK_RELATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TASK_RELATION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100"
          title="Zoom und Position so wählen, dass alle Karten dieser Ebene sichtbar sind"
          onClick={fitAllCardsInView}
        >
          Alles einpassen
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100"
          onClick={() => setCanvasViewport({ ...DEFAULT_CANVAS_VIEWPORT })}
        >
          Ansicht zurücksetzen
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100"
          title="Alle Karten dieser Ansicht als Text-Prompt in die Zwischenablage kopieren"
          onClick={() => {
            const prompt = exportCanvasAsPrompt(nodes, visibleRelations, {
              contextTitle: contextNodeId
                ? nodes.length > 0 ? `Canvas-Ansicht (${nodes.length} Karten)` : undefined
                : "Board-Übersicht",
            });
            navigator.clipboard.writeText(prompt).then(() => {
              // Brief visual feedback
              const btn = document.activeElement as HTMLElement | null;
              if (btn) {
                const orig = btn.textContent;
                btn.textContent = "✓ Kopiert";
                setTimeout(() => { btn.textContent = orig; }, 1200);
              }
            });
          }}
        >
          Prompt-Export
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100"
          title="Gruppierungs-Box im Canvas erstellen"
          onClick={() => {
            const id = `grp-${Date.now().toString(36)}`;
            addCanvasGroup({
              id,
              label: "Neue Gruppe",
              x: 50,
              y: 50,
              width: 400,
              height: 300,
            });
            setSelectedGroupId(id);
          }}
        >
          + Gruppe
        </button>
        <div className="relative">
          <button
            type="button"
            className={[
              "rounded border px-2 py-1",
              placingSymbolType || symbolPaletteOpen
                ? "border-violet-500 bg-violet-50 text-violet-900"
                : "border-slate-300 bg-white hover:bg-slate-100",
            ].join(" ")}
            title="Ablaufplan- und Use-Case-Symbole (nur Canvas)"
            onClick={() => setSymbolPaletteOpen((o) => !o)}
          >
            Symbole{placingSymbolType ? "…" : ""}
          </button>
          {symbolPaletteOpen ? (
            <div className="absolute left-0 top-full z-40 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              {(["useCase", "flowchart"] as const).map((group) => (
                <div key={group} className="mb-2 last:mb-0">
                  <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {SYMBOL_GROUP_LABELS[group]}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {listSymbolTypesByGroup(group).map((def) => (
                      <button
                        key={def.id}
                        type="button"
                        className={[
                          "rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100",
                          placingSymbolType === def.id ? "bg-violet-50 text-violet-900" : "text-slate-800",
                        ].join(" ")}
                        onClick={() => {
                          setPlacingSymbolType(def.id);
                          setSymbolPaletteOpen(false);
                          setRelationConnectMode(false);
                          setRelationDraftSourceId(null);
                        }}
                      >
                        {def.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {placingSymbolType ? (
                <button
                  type="button"
                  className="mt-1 w-full rounded px-2 py-1 text-left text-[11px] text-slate-500 hover:bg-slate-50"
                  onClick={() => setPlacingSymbolType(null)}
                >
                  Platzieren abbrechen
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {placingSymbolType ? (
          <span className="rounded bg-violet-100 px-2 py-0.5 text-violet-900">
            Klick auf Fläche: {listSymbolTypesByGroup("useCase").concat(listSymbolTypesByGroup("flowchart")).find((d) => d.id === placingSymbolType)?.label}
          </span>
        ) : null}
        {selectedCanvasNodeIds.length > 1 && (
          <span className="rounded bg-teal-100 px-2 py-0.5 text-teal-800">
            {selectedCanvasNodeIds.length} Karten ausgewählt
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            title="Bedienung anzeigen"
            aria-label="Bedienung anzeigen"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </button>
        </div>
      </div>

      <div
        ref={setShellRef}
        data-et2-canvas-shell
        className={[
          "relative min-h-0 flex-1 overflow-hidden bg-[var(--canvas)] bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] bg-[length:24px_24px]",
          canvasDropOver ? "ring-2 ring-inset ring-sky-400/70" : "",
          placingSymbolType
            ? "cursor-crosshair"
            : spaceHeld || panning
              ? panning
                ? "cursor-grabbing"
                : "cursor-grab"
              : "cursor-grab",
        ].join(" ")}
        onPointerDown={(e) => {
          const onBackground = isCanvasBackgroundTarget(e.target, e.currentTarget);
          // Middle-mouse or Space+left = Pan
          if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
            e.preventDefault();
            beginPan(e.clientX, e.clientY, canvasViewport);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            return;
          }
          if (e.button !== 0 || !onBackground) return;
          // Symbol placement: wait for click, don't pan
          if (placingSymbolType) return;
          // Shift+drag on empty area = lasso
          if (e.shiftKey) {
            const startX = e.clientX;
            const startY = e.clientY;
            setLasso({ x1: startX, y1: startY, x2: startX, y2: startY });
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            return;
          }
          // Drag on empty area = pan workspace
          beginPan(e.clientX, e.clientY, canvasViewport);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (panning) {
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) panMoved.current = true;
            setCanvasViewport({
              ...canvasViewport,
              x: panStart.current.vx + dx,
              y: panStart.current.vy + dy,
            });
            return;
          }
          if (lasso) {
            setLasso((prev) => (prev ? { ...prev, x2: e.clientX, y2: e.clientY } : null));
          }
        }}
        onPointerUp={(e) => {
          if (panning) {
            setPanning(false);
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch { /* ignore */ }
            return;
          }
          if (lasso) {
            // Finalize lasso selection
            const finalLasso = { ...lasso, x2: e.clientX, y2: e.clientY };
            const dx = Math.abs(finalLasso.x2 - finalLasso.x1);
            const dy = Math.abs(finalLasso.y2 - finalLasso.y1);
            if (dx > 5 || dy > 5) {
              // Actually dragged a selection area
              const worldLasso = lassoToWorld(finalLasso);
              const selected: string[] = [];
              for (const n of nodes) {
                if (isNodeInLasso(n.id, worldLasso)) {
                  selected.push(n.id);
                }
              }
              if (selected.length > 0) {
                useTaskTreeStore.setState({
                  selectedCanvasNodeIds: selected,
                  selectedCanvasNodeId: selected.length === 1 ? selected[0]! : null,
                });
              }
              lassoJustFinished.current = true;
              setTimeout(() => { lassoJustFinished.current = false; }, 0);
            }
            setLasso(null);
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch { /* ignore */ }
            return;
          }
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch { /* ignore */ }
        }}
        onDoubleClick={(e) => {
          if (placingSymbolType) return;
          if (!isCanvasBackgroundTarget(e.target, e.currentTarget)) {
            return;
          }
          const el = shellRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const world = screenToWorld(canvasViewport, e.clientX, e.clientY, rect);
          const id = addCardAfter(contextNodeId);
          moveCanvasNode(id, world.x - 110, world.y - 60);
          setSelectedCanvasNodeId(id);
          setPendingTitleEditId(id);
        }}
        onClick={(e) => {
          // Only clear selection if directly clicking background (not from lasso / pan-drag)
          if (!isCanvasBackgroundTarget(e.target, e.currentTarget)) return;
          if (placingSymbolType) {
            const el = shellRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const world = screenToWorld(canvasViewport, e.clientX, e.clientY, rect);
            placeSymbolAtWorld(placingSymbolType, world.x, world.y);
            setPlacingSymbolType(null);
            return;
          }
          if (lasso || lassoJustFinished.current || panMoved.current) {
            panMoved.current = false;
            return;
          }
          setSelectedCanvasNodeId(null);
          setSelectedRelationId(null);
          clearCanvasMultiSelect();
          setSelectedGroupId(null);
          setContextMenu(null);
          setSymbolPaletteOpen(false);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const el = shellRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          setContextSymbolGroup(null);
          setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        {/* Lasso selection rectangle */}
        {lasso && Math.abs(lasso.x2 - lasso.x1) + Math.abs(lasso.y2 - lasso.y1) > 5 && (
          <div
            className="pointer-events-none absolute z-50 border-2 border-dashed border-teal-500 bg-teal-500/10"
            style={{
              left: Math.min(lasso.x1, lasso.x2) - (shellRef.current?.getBoundingClientRect().left ?? 0),
              top: Math.min(lasso.y1, lasso.y2) - (shellRef.current?.getBoundingClientRect().top ?? 0),
              width: Math.abs(lasso.x2 - lasso.x1),
              height: Math.abs(lasso.y2 - lasso.y1),
            }}
          />
        )}
        <div
          className="et2-canvas-world absolute left-0 top-0 origin-top-left"
          style={{
            width: WORLD_W,
            height: WORLD_H,
            transform: `translate(${canvasViewport.x}px, ${canvasViewport.y}px) scale(${canvasViewport.zoom})`,
          }}
        >
          {/* Grouping boxes (behind cards) */}
          {canvasGroups.map((group) => (
            <CanvasGroupBox
              key={group.id}
              group={group}
              selected={selectedGroupId === group.id}
              zoom={canvasViewport.zoom}
              onSelect={() => setSelectedGroupId(group.id)}
              onMove={(x, y, delta) => {
                // Move cards whose center is inside the group bounding box
                for (const n of nodes) {
                  const nw = n.width ?? 220;
                  const nh = n.height ?? 120;
                  if (isNodeInsideGroup(n.x ?? 0, n.y ?? 0, nw, nh, group)) {
                    moveCanvasNode(n.id, (n.x ?? 0) + delta.dx, (n.y ?? 0) + delta.dy);
                  }
                }
                updateCanvasGroup(group.id, { x, y });
              }}
              onResize={(w, h) => updateCanvasGroup(group.id, { width: w, height: h })}
              onLabelChange={(label) => updateCanvasGroup(group.id, { label })}
              onRemove={() => { removeCanvasGroup(group.id); setSelectedGroupId(null); }}
            />
          ))}

          <TaskConnectors
            nodes={nodes}
            relations={visibleRelations}
            roots={roots}
            selectedRelationId={selectedRelationId}
            relationDraftSourceId={relationDraftSourceId}
            zoom={canvasViewport.zoom}
            clientToWorld={(clientX, clientY) => {
              const el = shellRef.current;
              if (!el) return { x: 0, y: 0 };
              return screenToWorld(
                useTaskTreeStore.getState().canvasViewport,
                clientX,
                clientY,
                el.getBoundingClientRect(),
              );
            }}
            onSelectRelation={(id) => {
              setSelectedRelationId(id);
            }}
            onReconnectRelation={(relationId, end, newNodeId) =>
              reconnectRelation(relationId, end, newNodeId)
            }
          />
          {[...nodes].sort(compareCanvasStackOrder).map((node) =>
            isSymbolNode(node) ? (
              <TaskCanvasSymbol
                key={node.id}
                node={node}
                selected={selectedCanvasNodeId === node.id || selectedCanvasNodeIds.includes(node.id)}
                connectSource={relationDraftSourceId === node.id}
                zoom={canvasViewport.zoom}
                requestTitleEdit={pendingTitleEditId === node.id}
                onTitleEditConsumed={() => setPendingTitleEditId(null)}
                onSelect={(shiftKey) => handleCardSelect(node.id, shiftKey ?? false)}
                onMove={(x, y, delta) => handleCardMove(node.id, x, y, delta)}
                onResize={(patch) => resizeCanvasNode(node.id, patch)}
                onRotate={(r) => rotateCanvasNode(node.id, r)}
                onConnectHandle={() => handleCardConnect(node.id)}
                onContextMenu={(e) => {
                  const el = shellRef.current;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, nodeId: node.id });
                  setSelectedCanvasNodeId(node.id);
                }}
                multiSelected={selectedCanvasNodeIds.includes(node.id) && selectedCanvasNodeIds.length > 1}
              />
            ) : (
              <TaskCanvasCard
                key={node.id}
                node={node}
                completedTag={completedTag}
                selected={selectedCanvasNodeId === node.id || selectedCanvasNodeIds.includes(node.id)}
                connectSource={relationDraftSourceId === node.id}
                nestTarget={nestHoverId === node.id}
                zoom={canvasViewport.zoom}
                requestTitleEdit={pendingTitleEditId === node.id}
                onTitleEditConsumed={() => setPendingTitleEditId(null)}
                onSelect={(shiftKey) => handleCardSelect(node.id, shiftKey ?? false)}
                onDrill={() => drillIntoNode(node.id)}
                onOpenNote={() => onOpenNoteEditor?.(node.id)}
                onMove={(x, y, delta) => handleCardMove(node.id, x, y, delta)}
                onResize={(patch) => resizeCanvasNode(node.id, patch)}
                onRotate={(r) => rotateCanvasNode(node.id, r)}
                onConnectHandle={() => handleCardConnect(node.id)}
                onNestHoverChange={setNestHoverId}
                onNestOnto={(targetId) => handleNestOnto(node.id, targetId)}
                onOutlineDrop={(clientX, clientY) => handleDropOnOutline(node.id, clientX, clientY)}
                onContextMenu={(e) => {
                  const el = shellRef.current;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, nodeId: node.id });
                  setSelectedCanvasNodeId(node.id);
                }}
                multiSelected={selectedCanvasNodeIds.includes(node.id) && selectedCanvasNodeIds.length > 1}
              />
            ),
          )}
          {nodes.length === 0 ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-500">
              Keine Karten auf dieser Ebene — Doppelklick zum Anlegen
            </div>
          ) : null}
        </div>

        {/* Right-click context menu */}
        {contextMenu && (
          <div
            className="absolute z-[100] min-w-[180px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl text-[13px] text-slate-800"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {contextMenu.nodeId ? (
              <>
                {(() => {
                  const menuNode = nodes.find((x) => x.id === contextMenu.nodeId);
                  const symbol = menuNode ? isSymbolNode(menuNode) : false;
                  const note = menuNode ? isNoteNode(menuNode) : false;
                  return (
                    <>
                      {note ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                          onClick={() => {
                            onOpenNoteEditor?.(contextMenu.nodeId!);
                            setContextMenu(null);
                          }}
                        >
                          ✎ Notiz bearbeiten
                        </button>
                      ) : null}
                      {!symbol ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                          onClick={() => {
                            drillIntoNode(contextMenu.nodeId!);
                            setContextMenu(null);
                          }}
                        >
                          → Hinein
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                        onClick={() => {
                          setRelationConnectMode(true);
                          setRelationDraftSourceId(contextMenu.nodeId!);
                          setContextMenu(null);
                        }}
                      >
                        ↗ Verbindung ab hier
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                        onClick={() => {
                          setPendingTitleEditId(contextMenu.nodeId!);
                          setContextMenu(null);
                        }}
                      >
                        ✎ Titel bearbeiten
                      </button>
                      {symbol ? (
                        <>
                          <hr className="my-1 border-slate-100" />
                          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Ebene
                          </p>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                            onClick={() => {
                              reorderCanvasNodeZIndex(contextMenu.nodeId!, "forward");
                              setContextMenu(null);
                            }}
                          >
                            Nach vorne
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                            onClick={() => {
                              reorderCanvasNodeZIndex(contextMenu.nodeId!, "backward");
                              setContextMenu(null);
                            }}
                          >
                            Nach hinten
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                            onClick={() => {
                              reorderCanvasNodeZIndex(contextMenu.nodeId!, "front");
                              setContextMenu(null);
                            }}
                          >
                            Ganz nach vorne
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                            onClick={() => {
                              reorderCanvasNodeZIndex(contextMenu.nodeId!, "back");
                              setContextMenu(null);
                            }}
                          >
                            Ganz nach hinten
                          </button>
                        </>
                      ) : null}
                      {!symbol ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                          onClick={() => {
                            const ids = selectedCanvasNodeIds.length > 1 && selectedCanvasNodeIds.includes(contextMenu.nodeId!)
                              ? selectedCanvasNodeIds
                              : [contextMenu.nodeId!];
                            moveNodesToClipboard(ids);
                            setContextMenu(null);
                          }}
                        >
                          📋 In Zwischenablage
                        </button>
                      ) : null}
                      <hr className="my-1 border-slate-100" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-red-700 hover:bg-red-50"
                        onClick={() => {
                          removeCard(contextMenu.nodeId!);
                          setContextMenu(null);
                        }}
                      >
                        🗑 {symbol ? "Symbol löschen" : "Karte löschen"}
                      </button>
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                {/* Background context menu */}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                  onClick={() => {
                    const el = shellRef.current;
                    if (!el) { setContextMenu(null); return; }
                    const rect = el.getBoundingClientRect();
                    const world = screenToWorld(canvasViewport, contextMenu.x + rect.left, contextMenu.y + rect.top, rect);
                    const id = addCardAfter(contextNodeId);
                    moveCanvasNode(id, world.x - 110, world.y - 60);
                    setSelectedCanvasNodeId(id);
                    setPendingTitleEditId(id);
                    setContextMenu(null);
                  }}
                >
                  + Neue Karte
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                  onClick={() => {
                    const el = shellRef.current;
                    if (!el) { setContextMenu(null); return; }
                    const rect = el.getBoundingClientRect();
                    const world = screenToWorld(canvasViewport, contextMenu.x + rect.left, contextMenu.y + rect.top, rect);
                    const id = addNoteAfter(contextNodeId);
                    moveCanvasNode(id, world.x - 120, world.y - 80);
                    setSelectedCanvasNodeId(id);
                    onOpenNoteEditor?.(id);
                    setContextMenu(null);
                  }}
                >
                  + Neue Notiz
                </button>
                <div className="relative">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                    onClick={() =>
                      setContextSymbolGroup((g) => (g === "useCase" ? null : "useCase"))
                    }
                  >
                    <span>+ Use Case</span>
                    <span className="text-slate-400">{contextSymbolGroup === "useCase" ? "▾" : "▸"}</span>
                  </button>
                  {contextSymbolGroup === "useCase"
                    ? listSymbolTypesByGroup("useCase").map((def) => (
                        <button
                          key={def.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 pl-6 text-left text-sm text-slate-700 hover:bg-slate-100"
                          onClick={() => {
                            const el = shellRef.current;
                            if (!el) { setContextMenu(null); return; }
                            const rect = el.getBoundingClientRect();
                            const world = screenToWorld(canvasViewport, contextMenu.x + rect.left, contextMenu.y + rect.top, rect);
                            placeSymbolAtWorld(def.id, world.x, world.y);
                            setContextMenu(null);
                            setContextSymbolGroup(null);
                          }}
                        >
                          {def.label}
                        </button>
                      ))
                    : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                    onClick={() =>
                      setContextSymbolGroup((g) => (g === "flowchart" ? null : "flowchart"))
                    }
                  >
                    <span>+ Flowchart</span>
                    <span className="text-slate-400">{contextSymbolGroup === "flowchart" ? "▾" : "▸"}</span>
                  </button>
                  {contextSymbolGroup === "flowchart"
                    ? listSymbolTypesByGroup("flowchart").map((def) => (
                        <button
                          key={def.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 pl-6 text-left text-sm text-slate-700 hover:bg-slate-100"
                          onClick={() => {
                            const el = shellRef.current;
                            if (!el) { setContextMenu(null); return; }
                            const rect = el.getBoundingClientRect();
                            const world = screenToWorld(canvasViewport, contextMenu.x + rect.left, contextMenu.y + rect.top, rect);
                            placeSymbolAtWorld(def.id, world.x, world.y);
                            setContextMenu(null);
                            setContextSymbolGroup(null);
                          }}
                        >
                          {def.label}
                        </button>
                      ))
                    : null}
                </div>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                  onClick={() => {
                    const el = shellRef.current;
                    if (!el) { setContextMenu(null); return; }
                    const rect = el.getBoundingClientRect();
                    const world = screenToWorld(canvasViewport, contextMenu.x + rect.left, contextMenu.y + rect.top, rect);
                    const id = `grp-${Date.now().toString(36)}`;
                    addCanvasGroup({ id, label: "Gruppe", x: world.x - 200, y: world.y - 150, width: 400, height: 300 });
                    setSelectedGroupId(id);
                    setContextMenu(null);
                  }}
                >
                  ▭ Gruppe erstellen
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                  onClick={() => {
                    setRelationConnectMode(!relationConnectMode);
                    setContextMenu(null);
                  }}
                >
                  ↗ {relationConnectMode ? "Verbindungsmodus beenden" : "Verbinden"}
                </button>
                <hr className="my-1 border-slate-100" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                  onClick={() => {
                    const prompt = exportCanvasAsPrompt(nodes, visibleRelations);
                    navigator.clipboard.writeText(prompt);
                    setContextMenu(null);
                  }}
                >
                  📋 Prompt-Export
                </button>
              </>
            )}
          </div>
        )}
      </div>
      </div>
      <TaskDetailSidebar onOpenNoteEditor={onOpenNoteEditor} />
      <KeyboardShortcutsHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
