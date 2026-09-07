import { availableKeyboardMoves, type CardNavDirection } from "@/lib/card-keyboard-nav";
import type { TaskNode } from "@/types/task-node";

export type HeldCardModifiers = {
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  space: boolean;
  fn: boolean;
};

export const EMPTY_HELD_CARD_MODIFIERS: HeldCardModifiers = {
  shift: false,
  alt: false,
  ctrl: false,
  meta: false,
  space: false,
  fn: false,
};

export type CardHintIcon =
  | "arrow-up"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "sticky-note"
  | "list-plus"
  | "link"
  | "pencil"
  | "copy"
  | "folder-input"
  | "trash"
  | "fold"
  | "unfold"
  | "panels";

export type CardHintGroup = "move" | "create" | "edit" | "fold" | "transfer";

export type CardHint = {
  id: string;
  label: string;
  keys: string;
  icon: CardHintIcon;
  enabled: boolean;
  group: CardHintGroup;
};

export type CardModifierHintArgs = {
  held: HeldCardModifiers;
  isMac: boolean;
  isNote: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  split: boolean;
  moves: Record<CardNavDirection, boolean>;
  commandLabel: "⌘" | "Strg";
};

export function isApplePlatform(platform: string, userAgent = ""): boolean {
  return /Mac|iPhone|iPod|iPad/i.test(platform) || /Mac OS|Macintosh/i.test(userAgent);
}

export function commandModifierHeld(held: HeldCardModifiers, isMac: boolean): boolean {
  return isMac ? held.meta || held.ctrl : held.ctrl;
}

export function shouldShowCardHints(held: HeldCardModifiers, isMac: boolean): boolean {
  return (
    held.shift || held.alt || held.space || held.fn || commandModifierHeld(held, isMac)
  );
}

type KeyLike = {
  key: string;
  code?: string;
  getModifierState?: (key: string) => boolean;
};

export function applyHeldModifierKey(
  prev: HeldCardModifiers,
  e: KeyLike,
  down: boolean,
): HeldCardModifiers {
  const next: HeldCardModifiers = { ...prev };
  const key = e.key;
  const code = e.code ?? "";

  if (key === "Shift") next.shift = down;
  else if (e.getModifierState) next.shift = e.getModifierState("Shift");

  if (key === "Alt" || key === "AltGraph") next.alt = down;
  else if (e.getModifierState) next.alt = e.getModifierState("Alt");

  if (key === "Control") next.ctrl = down;
  else if (e.getModifierState) next.ctrl = e.getModifierState("Control");

  if (key === "Meta" || key === "OS") next.meta = down;
  else if (e.getModifierState) next.meta = e.getModifierState("Meta");

  if (key === " " || key === "Spacebar" || code === "Space") next.space = down;

  const isFnKey = key === "Fn" || code === "Fn" || code === "FnLeft" || code === "FnRight";
  const isFKey = /^F\d{1,2}$/.test(key);
  if (isFnKey || isFKey) next.fn = down;
  else if (down && e.getModifierState?.("Fn")) next.fn = true;

  return next;
}

export function movesForCard(roots: TaskNode[], nodeId: string): Record<CardNavDirection, boolean> {
  return availableKeyboardMoves(roots, nodeId);
}

export function cardModifierHints(args: CardModifierHintArgs): CardHint[] {
  if (!shouldShowCardHints(args.held, args.isMac)) return [];

  const hints: CardHint[] = [];
  const cmd = args.commandLabel;
  const command = commandModifierHeld(args.held, args.isMac);
  const { held } = args;

  if (held.shift) {
    hints.push(
      {
        id: "move-up",
        label: "Unter Geschwistern nach oben",
        keys: "⇧↑",
        icon: "arrow-up",
        enabled: args.moves.up,
        group: "move",
      },
      {
        id: "move-down",
        label: "Unter Geschwistern nach unten",
        keys: "⇧↓",
        icon: "arrow-down",
        enabled: args.moves.down,
        group: "move",
      },
      {
        id: "move-left",
        label: "Eine Ebene höher",
        keys: "⇧←",
        icon: "arrow-left",
        enabled: args.moves.left,
        group: "move",
      },
      {
        id: "move-right",
        label: "Eine Ebene tiefer (unter die Karte darüber)",
        keys: "⇧→",
        icon: "arrow-right",
        enabled: args.moves.right,
        group: "move",
      },
    );
    if (!command) {
      hints.push({
        id: "add-sibling-note",
        label: "Geschwisternotiz anlegen",
        keys: "⇧↵",
        icon: "sticky-note",
        enabled: true,
        group: "create",
      });
      if (!args.split) {
        hints.push({
          id: "add-child-note",
          label: "Unternotiz anlegen",
          keys: "⇧⇥",
          icon: "sticky-note",
          enabled: true,
          group: "create",
        });
      }
    }
  }

  if (command) {
    if (!args.isNote) {
      hints.push({
        id: "paste-link",
        label: "Link oder Befehl aus der Zwischenablage speichern",
        keys: `${cmd}+K`,
        icon: "link",
        enabled: true,
        group: "edit",
      });
    }
    if (args.split) {
      if (held.shift) {
        hints.push({
          id: "add-child-note-split",
          label: "Unternotiz anlegen",
          keys: `${cmd}+⇧↵`,
          icon: "sticky-note",
          enabled: true,
          group: "create",
        });
      } else {
        hints.push({
          id: "add-child-card-split",
          label: "Unterkarte anlegen",
          keys: `${cmd}+↵`,
          icon: "list-plus",
          enabled: true,
          group: "create",
        });
      }
    }
  }

  if (held.fn) {
    hints.push({
      id: "edit-details",
      label: "Details öffnen",
      keys: "F2",
      icon: "pencil",
      enabled: true,
      group: "edit",
    });
    if (args.split) {
      hints.push(
        {
          id: "copy-pane",
          label: "Ins andere Panel kopieren",
          keys: "F5",
          icon: "copy",
          enabled: true,
          group: "transfer",
        },
        {
          id: "move-pane",
          label: "Ins andere Panel verschieben",
          keys: "F6",
          icon: "folder-input",
          enabled: true,
          group: "transfer",
        },
      );
    }
  }

  if (held.space) {
    hints.push({
      id: "toggle-expand",
      label: args.isCollapsed ? "Ast aufklappen" : "Ast zuklappen",
      keys: "␣",
      icon: args.isCollapsed ? "unfold" : "fold",
      enabled: args.hasChildren,
      group: "fold",
    });
  }

  const onlyAlt = held.alt && !held.shift && !command && !held.fn && !held.space;
  if (onlyAlt) {
    hints.push(
      {
        id: "add-sibling-card",
        label: "Geschwisterkarte anlegen",
        keys: "↵",
        icon: "list-plus",
        enabled: true,
        group: "create",
      },
      args.split
        ? {
            id: "switch-pane",
            label: "Panel wechseln",
            keys: "⇥",
            icon: "panels",
            enabled: true,
            group: "transfer",
          }
        : {
            id: "add-child-card",
            label: "Unterkarte anlegen",
            keys: "⇥",
            icon: "list-plus",
            enabled: true,
            group: "create",
          },
      {
        id: "edit-details-alt",
        label: "Details öffnen",
        keys: "F2",
        icon: "pencil",
        enabled: true,
        group: "edit",
      },
      {
        id: "delete-card",
        label: "Eintrag löschen",
        keys: "⌫",
        icon: "trash",
        enabled: true,
        group: "edit",
      },
    );
  }

  return hints;
}
