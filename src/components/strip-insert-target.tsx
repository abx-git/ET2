"use client";

import { useDroppable } from "@dnd-kit/core";

import type { BoardPaneId } from "@/lib/board-pane";
import { contextGapId } from "@/lib/context-list-dnd";

export function StripInsertTarget({
  paneId,
  listParentId,
  insertIndex,
  emptyHint,
  splitHints,
  indentPx = 0,
}: {
  paneId: BoardPaneId;
  listParentId: string | null;
  insertIndex: number;
  emptyHint?: boolean;
  splitHints?: boolean;
  /** Einrückung der Einfügelinie (verschachtelte Listen). */
  indentPx?: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: contextGapId(listParentId, insertIndex, paneId),
    data: { kind: "contextGap" as const, listParentId, insertIndex, paneId },
  });

  if (emptyHint) {
    return (
      <div
        ref={setNodeRef}
        className={[
          "list-strip-empty border border-dashed border-[var(--list-border)] bg-[var(--list-card-nested)] px-3 py-2 text-center text-sm text-[var(--list-muted)]",
          isOver ? "border-[var(--list-insert-line)]" : "",
        ].join(" ")}
      >
        {splitHints ? (
          <>
            Keine Streifen hier.{" "}
            <kbd className="rounded border border-[var(--list-border)] bg-[var(--list-card)] px-1 text-[11px]">
              Tab
            </kbd>{" "}
            wechselt das Panel,{" "}
            <kbd className="rounded border border-[var(--list-border)] bg-[var(--list-card)] px-1 text-[11px]">
              Enter
            </kbd>{" "}
            legt eine Karte an.
          </>
        ) : (
          <>
            Keine Streifen hier.{" "}
            <kbd className="rounded border border-[var(--list-border)] bg-[var(--list-card)] px-1 text-[11px]">
              Enter
            </kbd>{" "}
            /{" "}
            <kbd className="rounded border border-[var(--list-border)] bg-[var(--list-card)] px-1 text-[11px]">
              Tab
            </kbd>{" "}
            für Karten,{" "}
            <kbd className="rounded border border-[var(--list-border)] bg-[var(--list-card)] px-1 text-[11px]">
              Shift+Enter
            </kbd>{" "}
            /{" "}
            <kbd className="rounded border border-[var(--list-border)] bg-[var(--list-card)] px-1 text-[11px]">
              Shift+Tab
            </kbd>{" "}
            für Notizen.
          </>
        )}
        <span className="mt-1 block text-xs opacity-80">
          Oder Karte aus der Zwischenablage hierher ziehen.
        </span>
        {isOver ? (
          <div
            className="pointer-events-none mx-auto mt-2 h-0.5 max-w-full bg-[var(--list-insert-line)]"
            style={{ marginLeft: indentPx, width: indentPx ? `calc(100% - ${indentPx}px)` : undefined }}
            aria-hidden
          />
        ) : null}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} className="relative z-[1] h-0 w-full" aria-hidden>
      <div className="absolute inset-x-0 top-0 h-2 -translate-y-1/2" />
      {isOver ? (
        <div
          className="pointer-events-none absolute top-0 h-0.5 -translate-y-1/2 bg-[var(--list-insert-line)] shadow-[0_0_8px_var(--list-insert-line-glow)]"
          style={{
            left: indentPx,
            right: 0,
          }}
          role="presentation"
        />
      ) : null}
    </div>
  );
}
