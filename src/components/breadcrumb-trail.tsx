"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import type { TaskNode } from "@/types/task-node";

export interface BreadcrumbTrailProps {
  path: TaskNode[];
  onNavigateRoot: () => void;
  onNavigateTo: (nodeId: string) => void;
  onDrillUp: () => void;
}

export function BreadcrumbTrail({
  path,
  onNavigateRoot,
  onNavigateTo,
  onDrillUp,
}: BreadcrumbTrailProps) {
  return (
    <nav
      className="flex min-w-0 flex-wrap items-center gap-1 text-sm"
      aria-label="Pfad"
    >
      <button
        type="button"
        onClick={onDrillUp}
        disabled={path.length === 0}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--list-border)] bg-[var(--list-card)] text-[var(--list-muted)] hover:bg-[var(--list-hover)] hover:text-[var(--list-text)] disabled:opacity-40"
        title="Eine Ebene höher"
        aria-label="Eine Ebene höher"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onNavigateRoot}
        className={[
          "rounded-md px-2 py-1 text-xs font-medium transition",
          path.length === 0
            ? "bg-[var(--list-current-bg)] text-[var(--list-current-text)]"
            : "text-[var(--list-muted)] hover:bg-[var(--list-hover)] hover:text-[var(--list-text)]",
        ].join(" ")}
      >
        Übersicht
      </button>
      {path.map((node, i) => {
        const isLast = i === path.length - 1;
        return (
          <span key={node.id} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--list-muted)] opacity-60" aria-hidden />
            <button
              type="button"
              onClick={() => onNavigateTo(node.id)}
              className={[
                "max-w-[12rem] truncate rounded-md px-2 py-1 text-xs font-medium transition",
                isLast
                  ? "bg-[var(--list-current-bg)] text-[var(--list-current-text)]"
                  : "text-[var(--list-muted)] hover:bg-[var(--list-hover)] hover:text-[var(--list-text)]",
              ].join(" ")}
              title={node.title.trim() || "(Ohne Titel)"}
            >
              {node.title.trim() || "(Ohne Titel)"}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
