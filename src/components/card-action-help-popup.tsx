"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronsUpDown,
  CircleHelp,
  Columns2,
  Copy,
  FolderInput,
  Link,
  ListPlus,
  Pencil,
  StickyNote,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { shouldIgnoreCardKeyboard } from "@/lib/card-keyboard-nav";
import {
  activeHelpSectionIds,
  applyHeldModifierKey,
  cardActionHelpSections,
  EMPTY_HELD_CARD_MODIFIERS,
  isApplePlatform,
  type CardHelpIcon,
  type HeldCardModifiers,
} from "@/lib/card-modifier-hints";

const HELP_ICONS: Record<CardHelpIcon, LucideIcon> = {
  "arrow-up": ArrowUp,
  "arrow-down": ArrowDown,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "sticky-note": StickyNote,
  "list-plus": ListPlus,
  link: Link,
  pencil: Pencil,
  copy: Copy,
  "folder-input": FolderInput,
  trash: Trash2,
  fold: ChevronsUpDown,
  panels: Columns2,
};

export function CardActionHelpControl({ split }: { split: boolean }) {
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState<HeldCardModifiers>(EMPTY_HELD_CARD_MODIFIERS);
  const [anchor, setAnchor] = useState({ top: 48, right: 12 });
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return isApplePlatform(navigator.platform || "", navigator.userAgent || "");
  }, []);
  const commandLabel: "⌘" | "Strg" = isMac ? "⌘" : "Strg";
  const sections = useMemo(
    () => cardActionHelpSections({ commandLabel, split }),
    [commandLabel, split],
  );
  const activeIds = activeHelpSectionIds(held, isMac);
  const highlight = activeIds.length > 0;

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setAnchor({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
  }, [open]);

  useEffect(() => {
    if (!open) {
      setHeld(EMPTY_HELD_CARD_MODIFIERS);
      return;
    }
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.key === "Escape") {
        if (shouldIgnoreCardKeyboard(e)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setOpen(false);
        return;
      }
      if (down && shouldIgnoreCardKeyboard(e)) return;
      setHeld((prev) => applyHeldModifierKey(prev, e, down));
    };
    const onKeyDown = (e: KeyboardEvent) => onKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => onKey(e, false);
    const clear = () => setHeld(EMPTY_HELD_CARD_MODIFIERS);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition",
          open
            ? "bg-sky-50 text-sky-900"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        ].join(" ")}
        title="Tastaturhilfe für Karten"
        aria-label="Tastaturhilfe"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Tasten</span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
        <div
          id={panelId}
          role="dialog"
          aria-label="Tastaturhilfe für Karten"
          style={{ top: anchor.top, right: anchor.right }}
          className="fixed z-[70] w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-[var(--border)] bg-[var(--panel-solid)] p-3 shadow-xl"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[var(--text)]">Karten-Tasten</p>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                Für die fokussierte Karte (blauer Rand). Modifier halten hebt den Abschnitt hervor.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--control-hover)] hover:text-[var(--text)]"
              aria-label="Tastaturhilfe schließen"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <div className="max-h-[min(70vh,28rem)] space-y-2.5 overflow-y-auto pr-0.5">
            {sections.map((section) => {
              const on = highlight && activeIds.includes(section.id);
              const dim = highlight && !on;
              return (
                <section
                  key={section.id}
                  className={[
                    "rounded-lg px-2 py-1.5 transition",
                    on ? "bg-[var(--list-current-bg)] ring-1 ring-[var(--list-ring)]" : "",
                    dim ? "opacity-40" : "",
                  ].join(" ")}
                >
                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {section.title}
                  </h3>
                  <ul className="mt-1 space-y-1">
                    {section.rows.map((row) => {
                      const Icon = HELP_ICONS[row.icon];
                      return (
                        <li key={row.id} className="flex items-center gap-2 text-[12px] text-[var(--text)]">
                          <kbd className="inline-flex min-w-[2.4rem] justify-center rounded border border-[var(--border)] bg-[var(--control)] px-1 py-0.5 font-mono text-[10px] font-semibold text-[var(--text)]">
                            {row.keys}
                          </kbd>
                          <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--list-focus)]" aria-hidden />
                          <span className="min-w-0 leading-snug">{row.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>,
        document.body,
      )
      : null}
    </div>
  );
}
