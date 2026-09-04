"use client";

import { Copy, FolderInput } from "lucide-react";

export interface SplitCommanderBarProps {
  sourceLabel: string;
  targetLabel: string;
  sourceTitle: string;
  copyEnabled: boolean;
  moveEnabled: boolean;
  copyHint?: string;
  moveHint?: string;
  onCopy: () => void;
  onMove: () => void;
}

function FnKey({ label }: { label: string }) {
  return (
    <kbd className="inline-flex min-w-[1.6rem] items-center justify-center rounded border border-[var(--list-border)] bg-[var(--list-card)] px-1 py-0.5 font-mono text-[10px] font-semibold text-[var(--list-text)]">
      {label}
    </kbd>
  );
}

export function SplitCommanderBar({
  sourceLabel,
  targetLabel,
  sourceTitle,
  copyEnabled,
  moveEnabled,
  copyHint,
  moveHint,
  onCopy,
  onMove,
}: SplitCommanderBarProps) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-[var(--list-border)] bg-[var(--list-header)] px-2 py-1.5"
      role="toolbar"
      aria-label="Split-Ansicht Aktionen"
    >
      <button
        type="button"
        disabled={!copyEnabled}
        title={copyHint ?? `„${sourceTitle}“ nach ${targetLabel} kopieren`}
        onClick={onCopy}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--list-text)] transition hover:bg-[var(--list-hover)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <FnKey label="F5" />
        <Copy className="h-3.5 w-3.5 text-[var(--list-focus)]" aria-hidden />
        <span>Kopieren</span>
        <span className="hidden text-[var(--list-muted)] sm:inline">→ {targetLabel}</span>
      </button>
      <button
        type="button"
        disabled={!moveEnabled}
        title={moveHint ?? `„${sourceTitle}“ nach ${targetLabel} verschieben`}
        onClick={onMove}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--list-text)] transition hover:bg-[var(--list-hover)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <FnKey label="F6" />
        <FolderInput className="h-3.5 w-3.5 text-[var(--list-target)]" aria-hidden />
        <span>Verschieben</span>
        <span className="hidden text-[var(--list-muted)] sm:inline">→ {targetLabel}</span>
      </button>
      <span className="mx-1 hidden h-4 w-px bg-[var(--list-border)] sm:block" aria-hidden />
      <span className="inline-flex min-h-8 items-center gap-1.5 px-1.5 text-xs text-[var(--list-muted)]">
        <FnKey label="Tab" />
        Panel wechseln
      </span>
      <span className="ml-auto hidden max-w-[40%] truncate text-[11px] text-[var(--list-muted)] md:inline">
        Quelle: {sourceLabel}
      </span>
    </div>
  );
}
