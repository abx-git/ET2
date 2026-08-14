"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TaskCanvasCard } from "@/components/task-canvas-card";
import { TaskConnectors } from "@/components/task-connectors";
import { TaskDetailSidebar } from "@/components/task-detail-sidebar";
import { contextChildren } from "@/lib/board-context";
import { nodeMatchesBoardFilters } from "@/lib/board-filters";
import {
  DEFAULT_CANVAS_VIEWPORT,
  screenToWorld,
  zoomAtPoint,
  ZOOM_STEP,
  type CanvasViewport,
} from "@/lib/canvas-viewport";
import { relationsForContext } from "@/lib/task-relations";
import { isTaskMarkedDone } from "@/lib/task-tags";
import { isNoteNode } from "@/lib/tree-node-kind";
import { useTaskTreeStore } from "@/store/task-tree-store";
import {
  TASK_RELATION_TYPE_LABELS,
  TASK_RELATION_TYPES,
  type TaskRelationType,
} from "@/types/task-relation";

const WORLD_W = 4000;
const WORLD_H = 3000;

export function TaskCanvas() {
  const roots = useTaskTreeStore((s) => s.roots);
  const contextNodeId = useTaskTreeStore((s) => s.contextNodeId);
  const relations = useTaskTreeStore((s) => s.relations ?? []);
  const completedTag = useTaskTreeStore((s) => s.completedTag);
  const canvasViewport = useTaskTreeStore((s) => s.canvasViewport);
  const setCanvasViewport = useTaskTreeStore((s) => s.setCanvasViewport);
  const ensureContextCanvasLayout = useTaskTreeStore((s) => s.ensureContextCanvasLayout);
  const moveCanvasNode = useTaskTreeStore((s) => s.moveCanvasNode);
  const drillIntoNode = useTaskTreeStore((s) => s.drillIntoNode);
  const addCardAfter = useTaskTreeStore((s) => s.addCardAfter);
  const connectTasks = useTaskTreeStore((s) => s.connectTasks);
  const disconnectRelation = useTaskTreeStore((s) => s.disconnectRelation);
  const selectedRelationId = useTaskTreeStore((s) => s.selectedRelationId);
  const setSelectedRelationId = useTaskTreeStore((s) => s.setSelectedRelationId);
  const selectedCanvasNodeId = useTaskTreeStore((s) => s.selectedCanvasNodeId);
  const setSelectedCanvasNodeId = useTaskTreeStore((s) => s.setSelectedCanvasNodeId);
  const relationConnectMode = useTaskTreeStore((s) => s.relationConnectMode);
  const setRelationConnectMode = useTaskTreeStore((s) => s.setRelationConnectMode);
  const relationDraftSourceId = useTaskTreeStore((s) => s.relationDraftSourceId);
  const setRelationDraftSourceId = useTaskTreeStore((s) => s.setRelationDraftSourceId);
  const defaultRelationType = useTaskTreeStore((s) => s.defaultRelationType);
  const setDefaultRelationType = useTaskTreeStore((s) => s.setDefaultRelationType);
  const hideCompletedTasks = useTaskTreeStore((s) => s.hideCompletedTasks);
  const filterTags = useTaskTreeStore((s) => s.filterTags);
  const filterExcludeTags = useTaskTreeStore((s) => s.filterExcludeTags);
  const filterColors = useTaskTreeStore((s) => s.filterColors);
  const filterScheduleKinds = useTaskTreeStore((s) => s.filterScheduleKinds);
  const filterCombineMode = useTaskTreeStore((s) => s.filterCombineMode);

  const shellRef = useRef<HTMLDivElement>(null);
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [pendingTitleEditId, setPendingTitleEditId] = useState<string | null>(null);
  const panStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const spaceDown = useRef(false);

  useEffect(() => {
    ensureContextCanvasLayout();
    // Nur bei Ebenenwechsel layouten — nicht bei jedem roots-Update (sonst Drag-Jank).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [contextNodeId, ensureContextCanvasLayout]);

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
    const children = contextChildren(roots, contextNodeId);
    return children.filter((n) => {
      if (hideCompletedTasks && isTaskMarkedDone(n, completedTag)) return false;
      if (!filtersActive) return true;
      if (isNoteNode(n)) return filterExcludeTags.length === 0;
      return nodeMatchesBoardFilters(n, filterOpts);
    });
  }, [
    roots,
    contextNodeId,
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

  const selectedRelation = visibleRelations.find((r) => r.id === selectedRelationId) ?? null;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        spaceDown.current = true;
        setSpaceHeld(true);
        e.preventDefault();
      }
      if (e.key === "Escape") {
        setRelationConnectMode(false);
        setRelationDraftSourceId(null);
        setSelectedRelationId(null);
        setSelectedCanvasNodeId(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedRelationId) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
        e.preventDefault();
        disconnectRelation(selectedRelationId);
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
    selectedRelationId,
    setRelationConnectMode,
    setRelationDraftSourceId,
    setSelectedRelationId,
    setSelectedCanvasNodeId,
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

  const beginPan = useCallback(
    (clientX: number, clientY: number, vp: CanvasViewport) => {
      setPanning(true);
      panStart.current = { x: clientX, y: clientY, vx: vp.x, vy: vp.y };
    },
    [],
  );

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
          Typ
          <select
            className="rounded border border-slate-300 bg-white px-1 py-0.5"
            value={defaultRelationType}
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
          onClick={() => setCanvasViewport({ ...DEFAULT_CANVAS_VIEWPORT })}
        >
          Ansicht zurücksetzen
        </button>
        <span className="text-slate-400">
          Leertaste+Ziehen = Pan · Doppelklick = hinein · Auswahl → Details rechts
          {selectedRelation ? " · Entf = Pfeil löschen" : ""}
        </span>
      </div>

      <div
        ref={shellRef}
        className={[
          "relative min-h-0 flex-1 overflow-hidden bg-[var(--canvas)] bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] bg-[length:24px_24px]",
          spaceHeld || panning ? (panning ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
        ].join(" ")}
        onPointerDown={(e) => {
          if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
            e.preventDefault();
            beginPan(e.clientX, e.clientY, canvasViewport);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (!panning) return;
          setCanvasViewport({
            ...canvasViewport,
            x: panStart.current.vx + (e.clientX - panStart.current.x),
            y: panStart.current.vy + (e.clientY - panStart.current.y),
          });
        }}
        onPointerUp={(e) => {
          if (!panning) return;
          setPanning(false);
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains("et2-canvas-world")) {
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
        onClick={() => {
          setSelectedCanvasNodeId(null);
          setSelectedRelationId(null);
        }}
      >
        <div
          className="et2-canvas-world absolute left-0 top-0 origin-top-left"
          style={{
            width: WORLD_W,
            height: WORLD_H,
            transform: `translate(${canvasViewport.x}px, ${canvasViewport.y}px) scale(${canvasViewport.zoom})`,
          }}
        >
          <TaskConnectors
            nodes={nodes}
            relations={visibleRelations}
            selectedRelationId={selectedRelationId}
            relationDraftSourceId={relationDraftSourceId}
            onSelectRelation={(id) => {
              setSelectedRelationId(id);
            }}
          />
          {nodes.map((node) => (
            <TaskCanvasCard
              key={node.id}
              node={node}
              completedTag={completedTag}
              selected={selectedCanvasNodeId === node.id}
              connectSource={relationDraftSourceId === node.id}
              zoom={canvasViewport.zoom}
              requestTitleEdit={pendingTitleEditId === node.id}
              onTitleEditConsumed={() => setPendingTitleEditId(null)}
              onSelect={() => {
                setSelectedCanvasNodeId(node.id);
                if (relationConnectMode && relationDraftSourceId && relationDraftSourceId !== node.id) {
                  connectTasks(relationDraftSourceId, node.id);
                  setRelationConnectMode(false);
                } else if (relationConnectMode && !relationDraftSourceId) {
                  setRelationDraftSourceId(node.id);
                }
              }}
              onDrill={() => drillIntoNode(node.id)}
              onMove={(x, y) => moveCanvasNode(node.id, x, y)}
              onConnectHandle={() => handleCardConnect(node.id)}
            />
          ))}
          {nodes.length === 0 ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-500">
              Keine Karten auf dieser Ebene — Doppelklick zum Anlegen
            </div>
          ) : null}
        </div>
      </div>
      </div>
      <TaskDetailSidebar />
    </div>
  );
}
