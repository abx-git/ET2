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

export type CardHelpIcon =
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
  | "panels";

export type CardHelpSectionId = "shift" | "command" | "alt" | "fn" | "space";

export type CardHelpRow = {
  id: string;
  keys: string;
  label: string;
  icon: CardHelpIcon;
};

export type CardHelpSection = {
  id: CardHelpSectionId;
  title: string;
  rows: CardHelpRow[];
};

export function isApplePlatform(platform: string, userAgent = ""): boolean {
  return /Mac|iPhone|iPod|iPad/i.test(platform) || /Mac OS|Macintosh/i.test(userAgent);
}

export function commandModifierHeld(held: HeldCardModifiers, isMac: boolean): boolean {
  return isMac ? held.meta || held.ctrl : held.ctrl;
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

export function activeHelpSectionIds(
  held: HeldCardModifiers,
  isMac: boolean,
): CardHelpSectionId[] {
  const ids: CardHelpSectionId[] = [];
  if (held.shift) ids.push("shift");
  if (commandModifierHeld(held, isMac)) ids.push("command");
  if (held.alt) ids.push("alt");
  if (held.fn) ids.push("fn");
  if (held.space) ids.push("space");
  return ids;
}

export function cardActionHelpSections(args: {
  commandLabel: "⌘" | "Strg";
  split: boolean;
}): CardHelpSection[] {
  const cmd = args.commandLabel;
  const sections: CardHelpSection[] = [
    {
      id: "shift",
      title: "Shift",
      rows: [
        { id: "move-up", keys: "⇧↑", label: "Karte nach oben", icon: "arrow-up" },
        { id: "move-down", keys: "⇧↓", label: "Karte nach unten", icon: "arrow-down" },
        { id: "move-left", keys: "⇧←", label: "Eine Ebene höher", icon: "arrow-left" },
        { id: "move-right", keys: "⇧→", label: "Unter die Karte darüber (wenn aufgeklappt)", icon: "arrow-right" },
        { id: "add-sibling-note", keys: "⇧↵", label: "Notiz daneben", icon: "sticky-note" },
      ],
    },
    {
      id: "command",
      title: cmd,
      rows: [
        { id: "paste-link", keys: `${cmd}+K`, label: "Link aus der Zwischenablage", icon: "link" },
      ],
    },
    {
      id: "alt",
      title: "Alt / Option",
      rows: [
        { id: "add-sibling-card", keys: "↵", label: "Neue Karte daneben", icon: "list-plus" },
        {
          id: args.split ? "switch-pane" : "add-child-card",
          keys: "⇥",
          label: args.split ? "Anderes Panel" : "Unterkarte anlegen",
          icon: args.split ? "panels" : "list-plus",
        },
        { id: "edit-details-alt", keys: "F2", label: "Details öffnen", icon: "pencil" },
        { id: "delete-card", keys: "⌫", label: "Eintrag löschen", icon: "trash" },
      ],
    },
    {
      id: "fn",
      title: "Fn / F-Tasten",
      rows: [{ id: "edit-details", keys: "F2", label: "Details öffnen", icon: "pencil" }],
    },
    {
      id: "space",
      title: "Leertaste",
      rows: [{ id: "toggle-expand", keys: "␣", label: "Ast auf- oder zuklappen", icon: "fold" }],
    },
  ];

  if (!args.split) {
    sections[0]!.rows.push({
      id: "add-child-note",
      keys: "⇧⇥",
      label: "Notiz darunter",
      icon: "sticky-note",
    });
  } else {
    sections[1]!.rows.push(
      { id: "add-child-card-split", keys: `${cmd}+↵`, label: "Unterkarte anlegen", icon: "list-plus" },
      { id: "add-child-note-split", keys: `${cmd}+⇧↵`, label: "Notiz darunter", icon: "sticky-note" },
    );
    sections[3]!.rows.push(
      { id: "copy-pane", keys: "F5", label: "Ins andere Panel kopieren", icon: "copy" },
      { id: "move-pane", keys: "F6", label: "Ins andere Panel verschieben", icon: "folder-input" },
    );
  }

  return sections;
}
