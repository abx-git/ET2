"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Columns2,
  Copy,
  FolderInput,
  Link,
  ListPlus,
  Pencil,
  StickyNote,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { shouldIgnoreCardKeyboard } from "@/lib/card-keyboard-nav";
import {
  applyHeldModifierKey,
  cardModifierHints,
  EMPTY_HELD_CARD_MODIFIERS,
  isApplePlatform,
  movesForCard,
  shouldShowCardHints,
  type CardHint,
  type CardHintIcon,
  type HeldCardModifiers,
} from "@/lib/card-modifier-hints";
import {
  getMobileLayoutServerSnapshot,
  getMobileLayoutSnapshot,
  subscribeMobileLayout,
} from "@/lib/mobile-layout";
import { isNoteNode } from "@/lib/tree-node-kind";
import { useTaskTreeStore } from "@/store/task-tree-store";
import type { TaskNode } from "@/types/task-node";

type HeldCardModifiersValue = {
  held: HeldCardModifiers;
  isMac: boolean;
  commandLabel: "⌘" | "Strg";
  split: boolean;
};

const HeldCardModifiersContext = createContext<HeldCardModifiersValue>({
  held: EMPTY_HELD_CARD_MODIFIERS,
  isMac: false,
  commandLabel: "Strg",
  split: false,
});

export function HeldCardModifiersProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [held, setHeld] = useState<HeldCardModifiers>(EMPTY_HELD_CARD_MODIFIERS);
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return isApplePlatform(navigator.platform || "", navigator.userAgent || "");
  }, []);
  const commandLabel: "⌘" | "Strg" = isMac ? "⌘" : "Strg";
  const splitViewEnabled = useTaskTreeStore((s) => s.splitViewEnabled);
  const lightModeEnabled = useTaskTreeStore((s) => s.lightModeEnabled);
  const boardViewMode = useTaskTreeStore((s) => s.boardViewMode ?? "list");
  const isMobileLayout = useSyncExternalStore(
    subscribeMobileLayout,
    getMobileLayoutSnapshot,
    getMobileLayoutServerSnapshot,
  );
  const split =
    splitViewEnabled && !isMobileLayout && boardViewMode === "list" && !lightModeEnabled;

  useEffect(() => {
    if (!enabled) {
      setHeld(EMPTY_HELD_CARD_MODIFIERS);
      return;
    }

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (down && shouldIgnoreCardKeyboard(e)) return;
      setHeld((prev) => applyHeldModifierKey(prev, e, down));
    };
    const onKeyDown = (e: KeyboardEvent) => onKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => onKey(e, false);
    const clear = () => setHeld(EMPTY_HELD_CARD_MODIFIERS);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") clear();
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
        clear();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [enabled]);

  const value = useMemo(
    () => ({ held, isMac, commandLabel, split }),
    [held, isMac, commandLabel, split],
  );

  return (
    <HeldCardModifiersContext.Provider value={value}>{children}</HeldCardModifiersContext.Provider>
  );
}

const HINT_ICONS: Record<CardHintIcon, LucideIcon> = {
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
  fold: ChevronDown,
  unfold: ChevronRight,
  panels: Columns2,
};

function HintChip({ hint, compact }: { hint: CardHint; compact?: boolean }) {
  const Icon = HINT_ICONS[hint.icon];
  return (
    <span
      title={hint.label}
      className={[
        "inline-flex items-center gap-0.5 rounded-md font-medium shadow-sm ring-1",
        compact ? "px-1 py-px text-[8px]" : "px-1 py-0.5 text-[10px]",
        hint.enabled
          ? "bg-[var(--list-focus)] text-white ring-[var(--list-focus)]"
          : "bg-[var(--list-card)]/90 text-[var(--list-muted)] ring-[var(--list-border)]",
      ].join(" ")}
    >
      <kbd className="font-mono leading-none">{hint.keys}</kbd>
      <Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
    </span>
  );
}

function MoveDpad({ hints, compact }: { hints: CardHint[]; compact?: boolean }) {
  const byId = new Map(hints.map((h) => [h.id, h]));
  const cell = (id: string) => {
    const hint = byId.get(id);
    if (!hint) return <span />;
    return <HintChip hint={hint} compact={compact} />;
  };
  return (
    <div
      className={[
        "grid grid-cols-3 grid-rows-3 place-items-center",
        compact ? "gap-px" : "gap-0.5",
      ].join(" ")}
    >
      <span />
      {cell("move-up")}
      <span />
      {cell("move-left")}
      <span />
      {cell("move-right")}
      <span />
      {cell("move-down")}
      <span />
    </div>
  );
}

export function CardModifierHintOverlay({
  node,
  hasChildren,
  isCollapsed,
  compact = false,
}: {
  node: TaskNode;
  hasChildren: boolean;
  isCollapsed: boolean;
  compact?: boolean;
}) {
  const { held, isMac, commandLabel, split } = useContext(HeldCardModifiersContext);
  const roots = useTaskTreeStore((s) => s.roots);

  if (!shouldShowCardHints(held, isMac)) return null;

  const hints = cardModifierHints({
    held,
    isMac,
    commandLabel,
    isNote: isNoteNode(node),
    hasChildren,
    isCollapsed,
    split,
    moves: movesForCard(roots, node.id),
  });
  if (hints.length === 0) return null;

  const moves = hints.filter((h) => h.group === "move");
  const rest = hints.filter((h) => h.group !== "move");

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-1"
      aria-hidden
    >
      <div className="flex justify-end">
        {moves.length > 0 ? <MoveDpad hints={moves} compact={compact} /> : null}
      </div>
      {rest.length > 0 ? (
        <div className="flex flex-wrap justify-end gap-0.5">
          {rest.map((hint) => (
            <HintChip key={hint.id} hint={hint} compact={compact} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
