"use client";

import { useDroppable } from "@dnd-kit/core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { CanvasToolbar } from "@/components/canvas-toolbar";
import { JsonPasteImportDialog, TextExportPreviewDialog } from "@/components/json-clipboard-dialog";
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
import { listSchemeFromAppearance } from "@/lib/board-appearance";
import {
  containedNodeIds,
  defaultGroupColor,
  DEFAULT_GROUP_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  fitGroupToContents,
  groupRectAroundNodes,
  GROUP_COLOR_OPTIONS,
  type GroupColorId,
} from "@/lib/canvas-group";
import {
  ALIGN_MODE_LABELS,
  ALIGN_MODES_THREE,
  ALIGN_MODES_TWO,
  type AlignMode,
} from "@/lib/element-align";
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
  SYMBOL_GROUPS,
  type SymbolGroup,
  type SymbolType,
} from "@/lib/diagram-symbol";
import { exportVisibleCanvasToPdf } from "@/lib/canvas-pdf-export";
import { exportVisibleCanvasToPng, exportCanvasSceneToSvg, copyCanvasSceneToDrawioClipboard } from "@/lib/canvas-image-export";
import { exportCanvasAsMermaid } from "@/lib/canvas-mermaid";
import { exportCanvasAsPrompt } from "@/lib/prompt-export";
import { relationsForContext } from "@/lib/task-relations";
import { isTaskMarkedDone } from "@/lib/task-tags";
import { shouldIgnoreCardKeyboard } from "@/lib/card-keyboard-nav";
import { isCardNode, isNoteNode, isSymbolNode } from "@/lib/tree-node-kind";
import { outlineDropFromClientPoint } from "@/lib/outline-dnd";
import { useTaskTreeStore } from "@/store/task-tree-store";

const WORLD_W = 4000;
const WORLD_H = 3000;

const EMPTY_GROUPS: import("@/lib/canvas-group").CanvasGroup[] = [];

function newCanvasGroupId(): string {
  return `grp-${Date.now().toString(36)}`;
}

type CanvasGeomOp =
  | { kind: "abs"; nodeId: string; x: number; y: number }
  | { kind: "delta"; dx: number; dy: number }
  | { kind: "group"; id: string; members: string[]; dx: number; dy: number }
  | { kind: "groupResize"; id: string; x: number; y: number; width: number; height: number }
  | { kind: "resize"; nodeId: string; patch: { x: number; y: number; width: number; height: number } }
  | { kind: "rotate"; nodeId: string; rotation: number };

function canMergeCanvasGeom(a: CanvasGeomOp, b: CanvasGeomOp): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "abs" && b.kind === "abs") return a.nodeId === b.nodeId;
  if (a.kind === "delta" && b.kind === "delta") return true;
  if (a.kind === "group" && b.kind === "group") return a.id === b.id;
  if (a.kind === "groupResize" && b.kind === "groupResize") return a.id === b.id;
  if (a.kind === "resize" && b.kind === "resize") return a.nodeId === b.nodeId;
  if (a.kind === "rotate" && b.kind === "rotate") return a.nodeId === b.nodeId;
  return false;
}

function mergeCanvasGeom(prev: CanvasGeomOp, next: CanvasGeomOp): CanvasGeomOp {
  if (prev.kind === "delta" && next.kind === "delta") {
    return { kind: "delta", dx: prev.dx + next.dx, dy: prev.dy + next.dy };
  }
  if (prev.kind === "group" && next.kind === "group") {
    return { kind: "group", id: next.id, members: next.members, dx: prev.dx + next.dx, dy: prev.dy + next.dy };
  }
  return next;
}

function isScrollableCardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const el = target.closest("[data-card-scroll]");
  if (!(el instanceof HTMLElement)) return false;
  return el.scrollHeight > el.clientHeight + 1;
}

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
  const noteAccentColor = useTaskTreeStore((s) => s.noteAccentColor);
  const canvasViewport = useTaskTreeStore((s) => s.canvasViewport);
  const setCanvasViewport = useTaskTreeStore((s) => s.setCanvasViewport);
  const ensureContextCanvasLayout = useTaskTreeStore((s) => s.ensureContextCanvasLayout);
  const moveCanvasNode = useTaskTreeStore((s) => s.moveCanvasNode);
  const moveCanvasNodesBy = useTaskTreeStore((s) => s.moveCanvasNodesBy);
  const resizeCanvasNode = useTaskTreeStore((s) => s.resizeCanvasNode);
  const rotateCanvasNode = useTaskTreeStore((s) => s.rotateCanvasNode);
  const beginCanvasGeometryGesture = useTaskTreeStore((s) => s.beginCanvasGeometryGesture);
  const endCanvasGeometryGesture = useTaskTreeStore((s) => s.endCanvasGeometryGesture);
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

  const appearance = useTaskTreeStore((s) => s.appearance);
  const canvasGroups = useTaskTreeStore((s) => s.canvasGroups[s.contextNodeId ?? "__root__"] || EMPTY_GROUPS);
  const addCanvasGroup = useTaskTreeStore((s) => s.addCanvasGroup);
  const updateCanvasGroup = useTaskTreeStore((s) => s.updateCanvasGroup);
  const removeCanvasGroup = useTaskTreeStore((s) => s.removeCanvasGroup);
  const moveCanvasGroupBy = useTaskTreeStore((s) => s.moveCanvasGroupBy);
  const alignCanvasSelection = useTaskTreeStore((s) => s.alignCanvasSelection);
  const duplicateCanvasSelection = useTaskTreeStore((s) => s.duplicateCanvasSelection);
  const importCanvasMermaid = useTaskTreeStore((s) => s.importCanvasMermaid);

  const shellRef = useRef<HTMLDivElement>(null);
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [pendingTitleEditId, setPendingTitleEditId] = useState<string | null>(null);
  const [lasso, setLasso] = useState<LassoRect | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId?: string;
    groupId?: string;
  } | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [pendingGroupLabelEditId, setPendingGroupLabelEditId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [nestHoverId, setNestHoverId] = useState<string | null>(null);
  const [symbolPaletteOpen, setSymbolPaletteOpen] = useState(false);
  const [placingSymbolType, setPlacingSymbolType] = useState<SymbolType | null>(null);
  const [contextSymbolGroup, setContextSymbolGroup] = useState<SymbolGroup | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [imageExporting, setImageExporting] = useState<"png" | "svg" | null>(null);
  const [drawioCopied, setDrawioCopied] = useState(false);
  const [mermaidExportOpen, setMermaidExportOpen] = useState(false);
  const [mermaidExportText, setMermaidExportText] = useState("");
  const [mermaidPasteOpen, setMermaidPasteOpen] = useState(false);
  const panStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const spaceDown = useRef(false);
  const multiDrag = useRef<{ ox: number; oy: number } | null>(null);
  const lassoJustFinished = useRef(false);
  const panMoved = useRef(false);
  const groupDragMembers = useRef<Record<string, string[]>>({});

  const contextKids = useMemo(
    () => contextChildren(roots, contextNodeId, { includeSymbols: true }),
    [roots, contextNodeId],
  );
  const needsCanvasLayout = contextKids.some((n) => !nodeHasCanvasPosition(n));

  useLayoutEffect(() => {
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
        setSelectedGroupId(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && (selectedRelationId || selectedGroupId)) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
        e.preventDefault();
        if (selectedRelationId) {
          disconnectRelation(selectedRelationId);
        } else if (selectedGroupId) {
          removeCanvasGroup(selectedGroupId);
          setSelectedGroupId(null);
        }
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (shouldIgnoreCardKeyboard(e)) return;
        const store = useTaskTreeStore.getState();
        if (store.boardViewMode !== "canvas") return;
        e.preventDefault();
        duplicateCanvasSelection();
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
    selectedGroupId,
    removeCanvasGroup,
    setRelationConnectMode,
    setRelationDraftSourceId,
    setSelectedRelationId,
    setSelectedCanvasNodeId,
    clearCanvasMultiSelect,
    duplicateCanvasSelection,
  ]);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) && isScrollableCardTarget(e.target)) return;
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

  const fitAllCardsInView = useCallback((): boolean => {
    const el = shellRef.current;
    if (!el) return false;
    const { width, height } = el.getBoundingClientRect();
    if (width <= 0 || height <= 0) return false;
    const rects = [
      ...nodes.map((n) => taskCardRect(n)),
      ...canvasGroups.map((g) => ({ x: g.x, y: g.y, w: g.width, h: g.height })),
    ];
    const bounds = unionWorldBounds(rects);
    if (!bounds) {
      setCanvasViewport({ ...DEFAULT_CANVAS_VIEWPORT });
      return true;
    }
    setCanvasViewport(fitViewportToBounds(bounds, width, height));
    return true;
  }, [nodes, canvasGroups, setCanvasViewport]);

  const fittedContextKeyRef = useRef<string | undefined>(undefined);

  /** Beim Wechsel der Canvas-Ebene (Drill, Brotkrumen, Listen→Canvas) alle Karten einpassen. */
  useLayoutEffect(() => {
    if (needsCanvasLayout) return;
    const key = contextNodeId ?? "__root__";
    if (fittedContextKeyRef.current === key) return;

    if (fitAllCardsInView()) {
      fittedContextKeyRef.current = key;
      return;
    }

    const el = shellRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (fittedContextKeyRef.current === key) {
        ro.disconnect();
        return;
      }
      if (fitAllCardsInView()) {
        fittedContextKeyRef.current = key;
        ro.disconnect();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [contextNodeId, needsCanvasLayout, fitAllCardsInView]);

  const exportVisibleViewportPdf = useCallback(async () => {
    const el = shellRef.current;
    if (!el || pdfExporting || imageExporting) return;
    setPdfExporting(true);
    flushSync(() => {
      setContextMenu(null);
      setLasso(null);
      setSymbolPaletteOpen(false);
      setSelectedCanvasNodeId(null);
      setSelectedRelationId(null);
      clearCanvasMultiSelect();
      setSelectedGroupId(null);
    });
    try {
      await exportVisibleCanvasToPdf(el);
    } catch (err) {
      console.error("Canvas-PDF-Export fehlgeschlagen", err);
      window.alert("PDF-Export fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setPdfExporting(false);
    }
  }, [
    pdfExporting,
    imageExporting,
    setSelectedCanvasNodeId,
    setSelectedRelationId,
    clearCanvasMultiSelect,
  ]);

  const exportVisibleViewportImage = useCallback(
    async (kind: "png" | "svg") => {
      if (pdfExporting || imageExporting) return;
      if (kind === "svg") {
        setImageExporting("svg");
        try {
          exportCanvasSceneToSvg({
            nodes,
            relations: visibleRelations,
            groups: canvasGroups,
            completedTag,
            noteAccentColor,
          });
        } catch (err) {
          console.error("Canvas-SVG-Export fehlgeschlagen", err);
          window.alert("SVG-Export fehlgeschlagen. Bitte erneut versuchen.");
        } finally {
          setImageExporting(null);
        }
        return;
      }

      const el = shellRef.current;
      if (!el) return;
      setImageExporting("png");
      flushSync(() => {
        setContextMenu(null);
        setLasso(null);
        setSymbolPaletteOpen(false);
        setSelectedCanvasNodeId(null);
        setSelectedRelationId(null);
        clearCanvasMultiSelect();
        setSelectedGroupId(null);
      });
      try {
        await exportVisibleCanvasToPng(el);
      } catch (err) {
        console.error("Canvas-PNG-Export fehlgeschlagen", err);
        window.alert("PNG-Export fehlgeschlagen. Bitte erneut versuchen.");
      } finally {
        setImageExporting(null);
      }
    },
    [
      pdfExporting,
      imageExporting,
      nodes,
      visibleRelations,
      canvasGroups,
      completedTag,
      noteAccentColor,
      setSelectedCanvasNodeId,
      setSelectedRelationId,
      clearCanvasMultiSelect,
    ],
  );

  const copyCanvasToDrawio = useCallback(async () => {
    const ok = await copyCanvasSceneToDrawioClipboard({
      nodes,
      relations: visibleRelations,
      groups: canvasGroups,
      completedTag,
      noteAccentColor,
    });
    if (!ok) {
      window.alert("In die Zwischenablage kopieren ist in diesem Kontext nicht möglich.");
      return;
    }
    setDrawioCopied(true);
    window.setTimeout(() => setDrawioCopied(false), 1400);
  }, [nodes, visibleRelations, canvasGroups, completedTag, noteAccentColor]);

  const openMermaidExport = useCallback(() => {
    setMermaidExportText(exportCanvasAsMermaid(nodes, visibleRelations, canvasGroups));
    setMermaidExportOpen(true);
  }, [nodes, visibleRelations, canvasGroups]);

  const applyMermaidImport = useCallback(
    (text: string) => {
      try {
        importCanvasMermaid(text);
        setMermaidPasteOpen(false);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Mermaid konnte nicht importiert werden.");
      }
    },
    [importCanvasMermaid],
  );

  const selectCanvasNodeForMenu = useCallback((nodeId: string) => {
    const multi = useTaskTreeStore.getState().selectedCanvasNodeIds;
    if (multi.length > 1 && multi.includes(nodeId)) {
      useTaskTreeStore.setState({ selectedCanvasNodeId: nodeId });
      setSelectedGroupId(null);
      return;
    }
    setSelectedCanvasNodeId(nodeId);
    setSelectedGroupId(null);
  }, [setSelectedCanvasNodeId]);

  const applyAlign = useCallback(
    (mode: AlignMode, referenceId?: string) => {
      alignCanvasSelection(mode, referenceId);
      setContextMenu(null);
    },
    [alignCanvasSelection],
  );

  const selectGroupExclusive = useCallback(
    (id: string) => {
      setSelectedGroupId(id);
      setSelectedCanvasNodeId(null);
      setSelectedRelationId(null);
      clearCanvasMultiSelect();
    },
    [setSelectedCanvasNodeId, setSelectedRelationId, clearCanvasMultiSelect],
  );

  const addGroupAroundSelectionOrPoint = useCallback(
    (center: { x: number; y: number }) => {
      const store = useTaskTreeStore.getState();
      const selectedIds =
        store.selectedCanvasNodeIds.length > 0
          ? store.selectedCanvasNodeIds
          : store.selectedCanvasNodeId
            ? [store.selectedCanvasNodeId]
            : [];
      const selected = nodes.filter((n) => selectedIds.includes(n.id));
      const wrapped = groupRectAroundNodes(selected);
      const id = newCanvasGroupId();
      const color = defaultGroupColor(canvasGroups.length);
      if (wrapped) {
        addCanvasGroup({ id, label: "Gruppe", color, ...wrapped });
      } else {
        addCanvasGroup({
          id,
          label: "Gruppe",
          color,
          x: center.x - DEFAULT_GROUP_WIDTH / 2,
          y: center.y - DEFAULT_GROUP_HEIGHT / 2,
          width: DEFAULT_GROUP_WIDTH,
          height: DEFAULT_GROUP_HEIGHT,
        });
      }
      selectGroupExclusive(id);
    },
    [addCanvasGroup, canvasGroups.length, nodes, selectGroupExclusive],
  );

  const fitSelectedGroup = useCallback(
    (groupId: string) => {
      const group = canvasGroups.find((g) => g.id === groupId);
      if (!group) return;
      const next = fitGroupToContents(group, nodes);
      if (!next) return;
      updateCanvasGroup(groupId, next);
    },
    [canvasGroups, nodes, updateCanvasGroup],
  );

  useEffect(() => {
    setSelectedGroupId(null);
  }, [contextNodeId]);

  useEffect(() => {
    if (selectedGroupId && !canvasGroups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [canvasGroups, selectedGroupId]);

  const handleCardSelect = useCallback(
    (nodeId: string, shiftKey: boolean) => {
      if (shiftKey) {
        toggleCanvasNodeSelected(nodeId);
        setSelectedGroupId(null);
        return;
      }
      // If the card is already part of a multi-selection, keep the selection
      // (so user can drag the group without losing it)
      const multiIds = useTaskTreeStore.getState().selectedCanvasNodeIds;
      if (multiIds.length > 1 && multiIds.includes(nodeId)) {
        // Already in multi-select, just set as primary for detail sidebar
        useTaskTreeStore.setState({ selectedCanvasNodeId: nodeId });
        setSelectedGroupId(null);
        return;
      }

      const draft = useTaskTreeStore.getState().relationDraftSourceId;
      const connecting = useTaskTreeStore.getState().relationConnectMode;
      // Verbindung zuerst abschließen — nicht vorher selectedRelationId löschen.
      if (connecting && draft && draft !== nodeId) {
        connectTasks(draft, nodeId);
        return;
      }
      if (connecting && !draft) {
        setSelectedCanvasNodeId(nodeId);
        setRelationDraftSourceId(nodeId);
        setSelectedGroupId(null);
        return;
      }
      setSelectedCanvasNodeId(nodeId);
      setSelectedGroupId(null);
    },
    [
      toggleCanvasNodeSelected,
      setSelectedCanvasNodeId,
      connectTasks,
      setRelationDraftSourceId,
    ],
  );

  const geomPendingRef = useRef<CanvasGeomOp | null>(null);
  const geomRafRef = useRef(0);
  const nestHoverRafRef = useRef(0);
  const pendingNestHoverRef = useRef<string | null | undefined>(undefined);

  const applyCanvasGeom = useCallback(
    (op: CanvasGeomOp) => {
      switch (op.kind) {
        case "abs":
          moveCanvasNode(op.nodeId, op.x, op.y);
          break;
        case "delta":
          moveCanvasNodesBy(op.dx, op.dy);
          break;
        case "group":
          moveCanvasGroupBy(op.id, op.dx, op.dy, op.members);
          break;
        case "groupResize":
          updateCanvasGroup(op.id, { x: op.x, y: op.y, width: op.width, height: op.height });
          break;
        case "resize":
          resizeCanvasNode(op.nodeId, op.patch);
          break;
        case "rotate":
          rotateCanvasNode(op.nodeId, op.rotation);
          break;
      }
    },
    [moveCanvasGroupBy, moveCanvasNode, moveCanvasNodesBy, resizeCanvasNode, rotateCanvasNode, updateCanvasGroup],
  );

  const flushCanvasGeom = useCallback(() => {
    const op = geomPendingRef.current;
    geomPendingRef.current = null;
    if (op) applyCanvasGeom(op);
  }, [applyCanvasGeom]);

  const queueCanvasGeom = useCallback(
    (op: CanvasGeomOp) => {
      beginCanvasGeometryGesture();
      const prev = geomPendingRef.current;
      if (prev && !canMergeCanvasGeom(prev, op)) {
        applyCanvasGeom(prev);
        geomPendingRef.current = op;
      } else {
        geomPendingRef.current = prev ? mergeCanvasGeom(prev, op) : op;
      }
      if (geomRafRef.current) return;
      geomRafRef.current = requestAnimationFrame(() => {
        geomRafRef.current = 0;
        flushCanvasGeom();
      });
    },
    [applyCanvasGeom, beginCanvasGeometryGesture, flushCanvasGeom],
  );

  const endCanvasGeomGesture = useCallback(() => {
    if (geomRafRef.current) {
      cancelAnimationFrame(geomRafRef.current);
      geomRafRef.current = 0;
    }
    if (nestHoverRafRef.current) {
      cancelAnimationFrame(nestHoverRafRef.current);
      nestHoverRafRef.current = 0;
    }
    pendingNestHoverRef.current = undefined;
    flushCanvasGeom();
    setNestHoverId(null);
    endCanvasGeometryGesture();
  }, [endCanvasGeometryGesture, flushCanvasGeom]);

  const endCanvasGeomGestureRef = useRef(endCanvasGeomGesture);
  endCanvasGeomGestureRef.current = endCanvasGeomGesture;
  useEffect(() => () => endCanvasGeomGestureRef.current(), []);

  const handleCardMove = useCallback(
    (nodeId: string, x: number, y: number, isMultiDragDelta?: { dx: number; dy: number }) => {
      const multiIds = useTaskTreeStore.getState().selectedCanvasNodeIds;
      if (multiIds.length > 1 && multiIds.includes(nodeId) && isMultiDragDelta) {
        queueCanvasGeom({ kind: "delta", dx: isMultiDragDelta.dx, dy: isMultiDragDelta.dy });
      } else {
        queueCanvasGeom({ kind: "abs", nodeId, x, y });
      }
    },
    [queueCanvasGeom],
  );

  const handleNestHoverChange = useCallback((targetId: string | null) => {
    pendingNestHoverRef.current = targetId;
    if (nestHoverRafRef.current) return;
    nestHoverRafRef.current = requestAnimationFrame(() => {
      nestHoverRafRef.current = 0;
      const next = pendingNestHoverRef.current;
      pendingNestHoverRef.current = undefined;
      if (next === undefined) return;
      setNestHoverId(next);
    });
  }, []);

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
      <CanvasToolbar
        relationConnectMode={relationConnectMode}
        onToggleConnect={() => {
          const next = !relationConnectMode;
          setRelationConnectMode(next);
          if (!next) setRelationDraftSourceId(null);
        }}
        defaultRelationType={defaultRelationType}
        onDefaultRelationTypeChange={setDefaultRelationType}
        onFitAll={() => {
          fitAllCardsInView();
        }}
        onResetView={() => setCanvasViewport({ ...DEFAULT_CANVAS_VIEWPORT })}
        onExportPrompt={() => {
          const prompt = exportCanvasAsPrompt(nodes, visibleRelations, {
            contextTitle: contextNodeId
              ? nodes.length > 0 ? `Canvas-Ansicht (${nodes.length} Karten)` : undefined
              : "Board-Übersicht",
          });
          return navigator.clipboard.writeText(prompt);
        }}
        onExportPdf={() => {
          void exportVisibleViewportPdf();
        }}
        onExportPng={() => {
          void exportVisibleViewportImage("png");
        }}
        onExportSvg={() => {
          void exportVisibleViewportImage("svg");
        }}
        onCopyDrawio={() => {
          void copyCanvasToDrawio();
        }}
        onExportMermaid={() => {
          openMermaidExport();
        }}
        onImportMermaid={() => {
          setMermaidPasteOpen(true);
        }}
        pdfExporting={pdfExporting}
        imageExporting={imageExporting}
        drawioCopied={drawioCopied}
        selectedCount={selectedCanvasNodeIds.length}
        canDuplicate={Boolean(selectedCanvasNodeId) || selectedCanvasNodeIds.length > 0}
        onAlign={(mode) => applyAlign(mode)}
        onDuplicate={() => duplicateCanvasSelection()}
        onAddGroup={() => {
          const el = shellRef.current;
          if (!el) {
            addGroupAroundSelectionOrPoint({ x: 250, y: 200 });
            return;
          }
          const rect = el.getBoundingClientRect();
          const world = screenToWorld(
            canvasViewport,
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            rect,
          );
          addGroupAroundSelectionOrPoint(world);
        }}
        placingSymbolType={placingSymbolType}
        symbolPaletteOpen={symbolPaletteOpen}
        onSymbolPaletteOpenChange={setSymbolPaletteOpen}
        onPickSymbol={(type) => {
          setPlacingSymbolType(type);
          setSymbolPaletteOpen(false);
          setRelationConnectMode(false);
          setRelationDraftSourceId(null);
        }}
        onCancelPlacing={() => setPlacingSymbolType(null)}
        onOpenHelp={() => setHelpOpen(true)}
      />

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
            data-et2-export-hide="true"
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
              scheme={listSchemeFromAppearance(appearance)}
              onSelect={() => selectGroupExclusive(group.id)}
              onMoveStart={() => {
                groupDragMembers.current[group.id] = containedNodeIds(nodes, group);
              }}
              onMove={(_x, _y, delta) => {
                const members = groupDragMembers.current[group.id] ?? [];
                queueCanvasGeom({ kind: "group", id: group.id, members, dx: delta.dx, dy: delta.dy });
              }}
              onMoveEnd={() => {
                delete groupDragMembers.current[group.id];
                endCanvasGeomGesture();
              }}
              onResize={(patch) =>
                queueCanvasGeom({ kind: "groupResize", id: group.id, ...patch })
              }
              onGeometryEnd={endCanvasGeomGesture}
              onLabelChange={(label) => updateCanvasGroup(group.id, { label })}
              requestLabelEdit={pendingGroupLabelEditId === group.id}
              onLabelEditConsumed={() => setPendingGroupLabelEditId(null)}
              onContextMenu={(e) => {
                const el = shellRef.current;
                if (!el) return;
                const rect = el.getBoundingClientRect();
                setContextMenu({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  groupId: group.id,
                });
              }}
            />
          ))}

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
                onResize={(patch) => queueCanvasGeom({ kind: "resize", nodeId: node.id, patch })}
                onRotate={(r) => queueCanvasGeom({ kind: "rotate", nodeId: node.id, rotation: r })}
                onGeometryEnd={endCanvasGeomGesture}
                onConnectHandle={() => handleCardConnect(node.id)}
                onContextMenu={(e) => {
                  const el = shellRef.current;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, nodeId: node.id });
                  selectCanvasNodeForMenu(node.id);
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
                onResize={(patch) => queueCanvasGeom({ kind: "resize", nodeId: node.id, patch })}
                onRotate={(r) => queueCanvasGeom({ kind: "rotate", nodeId: node.id, rotation: r })}
                onGeometryEnd={endCanvasGeomGesture}
                onConnectHandle={() => handleCardConnect(node.id)}
                onNestHoverChange={handleNestHoverChange}
                onNestOnto={(targetId) => handleNestOnto(node.id, targetId)}
                onOutlineDrop={(clientX, clientY) => handleDropOnOutline(node.id, clientX, clientY)}
                onContextMenu={(e) => {
                  const el = shellRef.current;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, nodeId: node.id });
                  selectCanvasNodeForMenu(node.id);
                }}
                multiSelected={selectedCanvasNodeIds.includes(node.id) && selectedCanvasNodeIds.length > 1}
              />
            ),
          )}
          {/* Nach den Karten, hoher z-index: Linien nicht unter Notizen/Karten verstecken */}
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
              setSelectedGroupId(null);
            }}
            onReconnectRelation={(relationId, end, newNodeId) =>
              reconnectRelation(relationId, end, newNodeId)
            }
          />
          {nodes.length === 0 ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-500">
              Keine Karten auf dieser Ebene — Doppelklick zum Anlegen
            </div>
          ) : null}
        </div>

        {/* Right-click context menu */}
        {contextMenu && (
          <div
            data-et2-export-hide="true"
            className="absolute z-[100] min-w-[180px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl text-[13px] text-slate-800"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {contextMenu.groupId ? (
              <>
                {(() => {
                  const menuGroup = canvasGroups.find((g) => g.id === contextMenu.groupId);
                  const memberCount = menuGroup ? containedNodeIds(nodes, menuGroup).length : 0;
                  return (
                    <>
                      <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Gruppe{memberCount ? ` · ${memberCount}` : ""}
                      </p>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                        onClick={() => {
                          selectGroupExclusive(contextMenu.groupId!);
                          setPendingGroupLabelEditId(contextMenu.groupId!);
                          setContextMenu(null);
                        }}
                      >
                        ✎ Umbenennen
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100 disabled:text-slate-400"
                        disabled={memberCount === 0}
                        onClick={() => {
                          fitSelectedGroup(contextMenu.groupId!);
                          setContextMenu(null);
                        }}
                      >
                        ⇲ An Inhalt anpassen
                      </button>
                      <div className="px-3 py-2">
                        <p className="mb-1.5 text-[11px] font-medium text-slate-500">Farbe</p>
                        <div className="flex flex-wrap gap-1">
                          {GROUP_COLOR_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              title={opt.label}
                              className={[
                                "h-6 w-6 rounded-full border",
                                opt.swatchClass,
                                (menuGroup?.color ?? "slate") === opt.id
                                  ? "ring-2 ring-sky-400"
                                  : "border-transparent",
                              ].join(" ")}
                              onClick={() => {
                                updateCanvasGroup(contextMenu.groupId!, { color: opt.id as GroupColorId });
                                setContextMenu(null);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <hr className="my-1 border-slate-100" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-red-700 hover:bg-red-50"
                        onClick={() => {
                          removeCanvasGroup(contextMenu.groupId!);
                          setSelectedGroupId(null);
                          setContextMenu(null);
                        }}
                      >
                        🗑 Gruppe löschen
                      </button>
                    </>
                  );
                })()}
              </>
            ) : contextMenu.nodeId ? (
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
                      ) : !symbol ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                          onClick={() => {
                            onOpenNoteEditor?.(contextMenu.nodeId!);
                            setContextMenu(null);
                          }}
                        >
                          ✎ Details bearbeiten
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
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                        onClick={() => {
                          duplicateCanvasSelection();
                          setContextMenu(null);
                        }}
                      >
                        Duplizieren
                      </button>
                      {selectedCanvasNodeIds.length >= 2 &&
                      selectedCanvasNodeIds.includes(contextMenu.nodeId!) ? (
                        <div className="border-t border-slate-100 pt-1">
                          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Ausrichten
                          </p>
                          {ALIGN_MODES_TWO.map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-slate-800 hover:bg-slate-100"
                              onClick={() => applyAlign(mode, contextMenu.nodeId)}
                            >
                              {ALIGN_MODE_LABELS[mode]}
                            </button>
                          ))}
                          {selectedCanvasNodeIds.length >= 3
                            ? ALIGN_MODES_THREE.map((mode) => (
                                <button
                                  key={mode}
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-slate-800 hover:bg-slate-100"
                                  onClick={() => applyAlign(mode, contextMenu.nodeId)}
                                >
                                  {ALIGN_MODE_LABELS[mode]}
                                </button>
                              ))
                            : null}
                        </div>
                      ) : null}
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
                {SYMBOL_GROUPS.map((group) => (
                  <div className="relative" key={group}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                      onClick={() =>
                        setContextSymbolGroup((g) => (g === group ? null : group))
                      }
                    >
                      <span>+ {SYMBOL_GROUP_LABELS[group]}</span>
                      <span className="text-slate-400">{contextSymbolGroup === group ? "▾" : "▸"}</span>
                    </button>
                    {contextSymbolGroup === group
                      ? listSymbolTypesByGroup(group).map((def) => (
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
                ))}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                  onClick={() => {
                    const el = shellRef.current;
                    if (!el) { setContextMenu(null); return; }
                    const rect = el.getBoundingClientRect();
                    const world = screenToWorld(canvasViewport, contextMenu.x + rect.left, contextMenu.y + rect.top, rect);
                    addGroupAroundSelectionOrPoint(world);
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
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                  disabled={pdfExporting || imageExporting !== null}
                  onClick={() => {
                    void exportVisibleViewportPdf();
                  }}
                >
                  📄 PDF-Export (Ansicht)
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                  disabled={pdfExporting || imageExporting !== null}
                  onClick={() => {
                    void exportVisibleViewportImage("png");
                  }}
                >
                  PNG-Export (Ansicht)
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                  disabled={pdfExporting || imageExporting !== null}
                  onClick={() => {
                    void exportVisibleViewportImage("svg");
                  }}
                >
                  SVG-Export (Draw.io)
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                  onClick={() => {
                    void copyCanvasToDrawio();
                    setContextMenu(null);
                  }}
                >
                  {drawioCopied ? "✓ In Zwischenablage" : "📋 Nach Draw.io kopieren"}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                  onClick={() => {
                    openMermaidExport();
                    setContextMenu(null);
                  }}
                >
                  Mermaid exportieren
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100"
                  onClick={() => {
                    setMermaidPasteOpen(true);
                    setContextMenu(null);
                  }}
                >
                  Mermaid einfügen
                </button>
              </>
            )}
          </div>
        )}
      </div>
      </div>
      <TaskDetailSidebar
        onOpenNoteEditor={onOpenNoteEditor}
        selectedGroupId={selectedGroupId}
        onClearGroupSelection={() => setSelectedGroupId(null)}
        onFitGroupToContents={fitSelectedGroup}
      />
      <KeyboardShortcutsHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <TextExportPreviewDialog
        open={mermaidExportOpen}
        title="Mermaid-Export"
        hint="Flowchart der aktuellen Canvas-Ebene: Karten, Notizen, Ablaufplan-Symbole, Pfeile und Gruppen. Mindmaps werden beim Import wieder zu verschachtelten Karten."
        text={mermaidExportText}
        contentLabel="Mermaid"
        downloadFilename="canvas.mmd"
        downloadMime="text/plain;charset=utf-8"
        downloadLabel=".mmd herunterladen"
        onClose={() => setMermaidExportOpen(false)}
      />
      <JsonPasteImportDialog
        open={mermaidPasteOpen}
        title="Mermaid einfügen"
        hint="Flowchart (flowchart/graph) oder Mindmap einfügen. Wird rechts neben den vorhandenen Karten dieser Ebene angelegt. Optional eine .mmd-Datei laden."
        placeholder={"flowchart TD\n  Start[Los] --> Ende[Fertig]"}
        applyLabel="Auf Canvas einfügen"
        fileAccept=".mmd,.md,.txt,text/plain,text/markdown"
        fileButtonLabel="Datei laden"
        onClose={() => setMermaidPasteOpen(false)}
        onApplyPastedText={applyMermaidImport}
      />
    </div>
  );
}
