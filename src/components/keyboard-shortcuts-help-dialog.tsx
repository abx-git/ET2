"use client";

import { useEffect, useId, useState } from "react";

export interface KeyboardShortcutsHelpDialogProps {
  open: boolean;
  onClose: () => void;
}

type ShortcutItem = {
  keys: string;
  description: string;
};

type ShortcutSection = {
  title: string;
  hint?: string;
  items: ShortcutItem[];
};

function useModifierLabel(): string {
  const [label, setLabel] = useState("Strg");

  useEffect(() => {
    const platform =
      typeof navigator !== "undefined"
        ? navigator.platform || navigator.userAgent
        : "";
    if (/Mac|iPhone|iPod|iPad/i.test(platform)) {
      setLabel("Cmd");
    }
  }, []);

  return label;
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700 shadow-sm">
      {children}
    </kbd>
  );
}

function ShortcutKeys({ keys }: { keys: string }) {
  const parts = keys.split(" + ").map((part) => part.trim());
  return (
    <span className="flex flex-wrap items-center justify-end gap-1">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? <span className="text-[10px] text-slate-400">+</span> : null}
          <Kbd>{part}</Kbd>
        </span>
      ))}
    </span>
  );
}

function ShortcutSectionBlock({ section }: { section: ShortcutSection }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.title}</h3>
      {section.hint ? <p className="mt-1 text-xs text-slate-500">{section.hint}</p> : null}
      <dl className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
        {section.items.map((item) => (
          <div
            key={`${section.title}-${item.keys}-${item.description}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5"
          >
            <dt className="text-sm text-slate-700">{item.description}</dt>
            <dd className="m-0">
              <ShortcutKeys keys={item.keys} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function KeyboardShortcutsHelpDialog({ open, onClose }: KeyboardShortcutsHelpDialogProps) {
  const titleId = useId();
  const mod = useModifierLabel();

  if (!open) return null;

  const sections: ShortcutSection[] = [
    {
      title: "Canvas — Maus",
      hint: "Auf dem leeren Arbeitsbereich bzw. auf Karten.",
      items: [
        { keys: "Ziehen (leer)", description: "Arbeitsbereich verschieben (Pan)" },
        { keys: "Mittlere Maustaste / Leertaste + Ziehen", description: "Pan (Alternative)" },
        { keys: "Shift + Ziehen (leer)", description: "Lasso: mehrere Karten auswählen" },
        { keys: "Ziehen (Karte)", description: "Karte verschieben" },
        { keys: "Karte auf Karte legen", description: "Als Unterkarte einhängen (Nest)" },
        { keys: "Klick auf Titel", description: "Titel bearbeiten" },
        { keys: "Klick / Shift + Klick", description: "Karte auswählen / Mehrfachauswahl" },
        { keys: "Doppelklick (Karte)", description: "In die Karte hinein (Unterebene)" },
        { keys: "Doppelklick (leer)", description: "Neue Karte anlegen" },
        { keys: "Mausrad", description: "Pan · Ctrl/Cmd + Rad = Zoom" },
        { keys: "Ecken / Kanten", description: "Größe ändern · Drehgriff oben = rotieren" },
        { keys: "Klick auf Pfeil", description: "Pfeil auswählen · Ansatzpunkte an den Karten" },
        { keys: "Ansatzpunkt ziehen", description: "Pfeil-Ende umhängen (auf andere Geschwisterkarte)" },
        { keys: "Rechtsklick", description: "Kontextmenü" },
      ],
    },
    {
      title: "Canvas — Tastatur",
      items: [
        { keys: "Esc", description: "Auswahl / Verbindungsmodus aufheben" },
        { keys: `${mod} + A`, description: "Alle Karten der Ebene auswählen" },
        { keys: "Entf / Rücktaste", description: "Ausgewählten Pfeil löschen" },
        { keys: "Leertaste (halten)", description: "Pan-Modus für Linksklick" },
      ],
    },
    {
      title: "Allgemein",
      items: [
        { keys: `${mod} + Z`, description: "Rückgängig" },
        { keys: `${mod} + Shift + Z`, description: "Wiederholen" },
      ],
    },
    {
      title: "Karten (Listenansicht)",
      hint: "Karte zuerst per Klick oder Pfeiltasten fokussieren (blauer Ring).",
      items: [
        { keys: "↑ ↓", description: "Zwischen Karten in der aktuellen Ebene wechseln" },
        { keys: "→", description: "Navigieren: hinein · Aufklappen: Ast öffnen / erstes Kind" },
        { keys: "← / Esc", description: "Navigieren: eine Ebene höher · Aufklappen: zuklappen / Parent" },
        { keys: "Leertaste", description: "Karten-Ast ein-/ausklappen (unabhängig von der Struktur)" },
        { keys: "Enter", description: "Geschwisterkarte anlegen und Titel bearbeiten" },
        { keys: "Tab", description: "Unterkarte anlegen und Titel bearbeiten" },
        { keys: "Shift + Enter", description: "Geschwisternotiz anlegen und bearbeiten" },
        { keys: "Shift + Tab", description: "Unternotiz anlegen und bearbeiten" },
        { keys: "F2", description: "Detailansicht der fokussierten Karte öffnen" },
        { keys: `${mod} + K`, description: "Link oder Befehl aus Zwischenablage speichern" },
        { keys: "Entf / Rücktaste", description: "Karte löschen (mit Bestätigung)" },
      ],
    },
    {
      title: "Titel bearbeiten",
      hint: "Beim Anlegen oder per Klick auf den Titel (Canvas).",
      items: [
        { keys: "Enter", description: "Titel übernehmen" },
        { keys: "Shift + Enter", description: "Titel übernehmen und Geschwisterkarte anlegen" },
        { keys: "Esc", description: "Bearbeitung abbrechen" },
      ],
    },
    {
      title: "Suche",
      items: [
        { keys: "↑ ↓", description: "Treffer auswählen" },
        { keys: "Enter", description: "Ausgewählte Karte öffnen" },
        { keys: "Esc", description: "Suchliste schließen" },
      ],
    },
    {
      title: "Listenansicht — Maus",
      items: [
        { keys: "Klick", description: "Karte auswählen" },
        {
          keys: "Doppelklick / Chevron",
          description: "Modus Aufklappen: Ast öffnen · Modus Navigieren: hinein springen",
        },
        { keys: "Ziehen", description: "Umsortieren oder nesten (Liste oder Struktur links)" },
        { keys: "Rechtsklick", description: "Details öffnen" },
        { keys: "⋯", description: "Aktionen (Farbe, Ändern, …)" },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <h2 id={titleId} className="text-sm font-semibold text-slate-900">
            Bedienung
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Maus- und Tastaturbedienung für Canvas und Listenansicht.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {sections.map((section) => (
            <ShortcutSectionBlock key={section.title} section={section} />
          ))}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
