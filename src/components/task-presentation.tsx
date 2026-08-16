"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NoteMarkdownContent } from "@/components/note-markdown-content";
import { contextChildren, contextPathNodes } from "@/lib/board-context";
import { shouldIgnoreCardKeyboard } from "@/lib/card-keyboard-nav";
import {
  canPresentationDrillIn,
  firstPresentationItemId,
  focusAfterDrillIn,
  navigatePresentation,
} from "@/lib/presentation-nav";
import { isCardNode, isNoteNode, nodeDisplayTitle } from "@/lib/tree-node-kind";
import { rootsForMindmapDisplay } from "@/lib/tree-utils";
import { useTaskTreeStore } from "@/store/task-tree-store";
import type { TaskNode } from "@/types/task-node";

function PresentationCardBlock({
  node,
  focused,
  onFocus,
}: {
  node: TaskNode;
  focused: boolean;
  onFocus: () => void;
}) {
  const title = nodeDisplayTitle(node);
  const description = node.description?.trim() ?? "";
  const hasChildren = canPresentationDrillIn(node);

  return (
    <section
      data-presentation-item-id={node.id}
      tabIndex={-1}
      onClick={onFocus}
      className={[
        "scroll-mt-6 rounded-xl px-5 py-4 outline-none transition",
        focused
          ? "bg-sky-50/90 ring-2 ring-sky-400/70 ring-offset-2 ring-offset-white"
          : "hover:bg-slate-50/80",
      ].join(" ")}
    >
      <div className="flex items-baseline gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h2>
        {hasChildren ? (
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            → Unterebene
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mt-3 max-w-prose whitespace-pre-wrap text-base leading-relaxed text-slate-600 sm:text-lg">
          {description}
        </p>
      ) : null}
    </section>
  );
}

function PresentationNoteBlock({
  node,
  focused,
  onFocus,
}: {
  node: TaskNode;
  focused: boolean;
  onFocus: () => void;
}) {
  const title = node.title.trim();
  return (
    <section
      data-presentation-item-id={node.id}
      tabIndex={-1}
      onClick={onFocus}
      className={[
        "scroll-mt-6 rounded-xl px-5 py-4 outline-none transition",
        focused
          ? "bg-amber-50/90 ring-2 ring-amber-400/70 ring-offset-2 ring-offset-white"
          : "hover:bg-amber-50/40",
      ].join(" ")}
    >
      {title ? (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-amber-700/80">
          {title}
        </p>
      ) : null}
      {node.markdown?.trim() ? (
        <div className="max-w-prose text-base leading-relaxed sm:text-lg [&_.note-markdown]:text-[15px] sm:[&_.note-markdown]:text-base">
          <NoteMarkdownContent markdown={node.markdown} />
        </div>
      ) : (
        <p className="text-sm italic text-slate-400">Leere Notiz</p>
      )}
    </section>
  );
}

export function TaskPresentation() {
  const roots = useTaskTreeStore((s) => s.roots);
  const contextNodeId = useTaskTreeStore((s) => s.contextNodeId);
  const drillIntoNode = useTaskTreeStore((s) => s.drillIntoNode);
  const drillUp = useTaskTreeStore((s) => s.drillUp);
  const setContextNodeId = useTaskTreeStore((s) => s.setContextNodeId);
  const hideCompletedTasks = useTaskTreeStore((s) => s.hideCompletedTasks);
  const completedTag = useTaskTreeStore((s) => s.completedTag);
  const filterTags = useTaskTreeStore((s) => s.filterTags);
  const filterExcludeTags = useTaskTreeStore((s) => s.filterExcludeTags);
  const filterColors = useTaskTreeStore((s) => s.filterColors);
  const filterScheduleKinds = useTaskTreeStore((s) => s.filterScheduleKinds);
  const filterCombineMode = useTaskTreeStore((s) => s.filterCombineMode);

  const shellRef = useRef<HTMLDivElement>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const filteredRoots = useMemo(
    () =>
      rootsForMindmapDisplay(roots, {
        hideCompletedTasks,
        completedTag,
        filterTags,
        filterExcludeTags,
        filterColors,
        filterScheduleKinds,
        filterCombineMode,
      }),
    [
      roots,
      hideCompletedTasks,
      completedTag,
      filterTags,
      filterExcludeTags,
      filterColors,
      filterScheduleKinds,
      filterCombineMode,
    ],
  );

  const items = useMemo(
    () => contextChildren(filteredRoots, contextNodeId),
    [filteredRoots, contextNodeId],
  );

  const pageTitle = useMemo(() => {
    if (!contextNodeId) return "Wurzel";
    const path = contextPathNodes(filteredRoots, contextNodeId);
    const current = path[path.length - 1];
    return current ? nodeDisplayTitle(current) : "Ebene";
  }, [filteredRoots, contextNodeId]);

  const breadcrumb = useMemo(
    () => contextPathNodes(filteredRoots, contextNodeId),
    [filteredRoots, contextNodeId],
  );

  // Keep focus valid when level / items change
  useEffect(() => {
    if (items.length === 0) {
      setFocusId(null);
      return;
    }
    if (!focusId || !items.some((n) => n.id === focusId)) {
      setFocusId(firstPresentationItemId(items));
    }
  }, [items, focusId]);

  const scrollFocusIntoView = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const el = shellRef.current?.querySelector(
        `[data-presentation-item-id="${CSS.escape(id)}"]`,
      );
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }, []);

  const applyFocus = useCallback(
    (id: string | null) => {
      setFocusId(id);
      if (id) scrollFocusIntoView(id);
    },
    [scrollFocusIntoView],
  );

  const exitFullscreen = useCallback(() => {
    setFullscreen(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {
        /* ignore */
      });
    }
  }, []);

  const enterFullscreen = useCallback(() => {
    setFullscreen(true);
    const el = shellRef.current;
    if (el && el.requestFullscreen) {
      void el.requestFullscreen().catch(() => {
        /* CSS fallback already via state */
      });
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (fullscreen || document.fullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [fullscreen, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreCardKeyboard(e)) return;

      if (e.key === "f" || e.key === "F") {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      if (e.key === "Escape") {
        if (fullscreen || document.fullscreenElement) {
          e.preventDefault();
          exitFullscreen();
          return;
        }
        if (contextNodeId) {
          e.preventDefault();
          const leaving = contextNodeId;
          drillUp();
          applyFocus(leaving);
        }
        return;
      }

      const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;
      if (!arrowKeys.includes(e.key as (typeof arrowKeys)[number])) return;

      e.preventDefault();
      const direction =
        e.key === "ArrowUp"
          ? "up"
          : e.key === "ArrowDown"
            ? "down"
            : e.key === "ArrowLeft"
              ? "left"
              : "right";

      const nav = navigatePresentation(items, focusId, direction);

      if (nav.shouldDrillUp) {
        const leaving = contextNodeId;
        drillUp();
        if (leaving) applyFocus(leaving);
        return;
      }
      if (nav.shouldDrillIn && nav.nextId) {
        drillIntoNode(nav.nextId);
        const kids = contextChildren(filteredRoots, nav.nextId);
        applyFocus(focusAfterDrillIn(kids));
        return;
      }
      if (nav.nextId) applyFocus(nav.nextId);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    items,
    focusId,
    contextNodeId,
    filteredRoots,
    drillIntoNode,
    drillUp,
    applyFocus,
    fullscreen,
    toggleFullscreen,
    exitFullscreen,
  ]);

  const chrome = !fullscreen;

  return (
    <div
      ref={shellRef}
      className={[
        "flex min-h-0 flex-1 flex-col bg-[var(--canvas)]",
        fullscreen
          ? "fixed inset-0 z-[1200] bg-white"
          : "",
      ].join(" ")}
    >
      {chrome ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--panel-solid)] px-3 py-2">
          <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-xs text-slate-600" aria-label="Pfad">
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-slate-100"
              onClick={() => {
                setContextNodeId(null);
                applyFocus(firstPresentationItemId(contextChildren(filteredRoots, null)));
              }}
            >
              Wurzel
            </button>
            {breadcrumb.map((n) => (
              <span key={n.id} className="flex items-center gap-1">
                <span className="text-slate-300" aria-hidden>
                  /
                </span>
                <button
                  type="button"
                  className="max-w-[12rem] truncate rounded px-1.5 py-0.5 hover:bg-slate-100"
                  onClick={() => {
                    setContextNodeId(n.id);
                  }}
                >
                  {nodeDisplayTitle(n)}
                </button>
              </span>
            ))}
          </nav>
          <p className="shrink-0 text-[10px] text-slate-400">
            ↑↓ Fokus · → hinein · ← / Esc hoch · F Vollbild
          </p>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            onClick={toggleFullscreen}
          >
            Vollbild
          </button>
        </div>
      ) : (
        <div className="pointer-events-none absolute right-4 top-3 z-10 rounded-md bg-slate-900/70 px-2.5 py-1 text-[10px] text-white/90">
          Esc beendet Vollbild · F umschalten
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-10 sm:py-14">
          <header className="mb-10 border-b border-slate-200/80 pb-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              Präsentation
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {pageTitle}
            </h1>
          </header>

          {items.length === 0 ? (
            <p className="text-base text-slate-500">
              Keine Einträge auf dieser Ebene — ← oder Esc für Ebene hoch.
            </p>
          ) : (
            <div className="flex flex-col gap-8">
              {items.map((node) =>
                isNoteNode(node) ? (
                  <PresentationNoteBlock
                    key={node.id}
                    node={node}
                    focused={focusId === node.id}
                    onFocus={() => applyFocus(node.id)}
                  />
                ) : isCardNode(node) ? (
                  <PresentationCardBlock
                    key={node.id}
                    node={node}
                    focused={focusId === node.id}
                    onFocus={() => applyFocus(node.id)}
                  />
                ) : null,
              )}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
