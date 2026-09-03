"use client";

import {
  APPEARANCE_PRESETS,
  appearanceToCssVars,
  DEFAULT_APPEARANCE,
  listSchemeFromAppearance,
} from "@/lib/board-appearance";
import { cardColorCssVars } from "@/lib/card-color";
import { noteAccentCssVars } from "@/lib/note-accent";
import { useTaskTreeStore } from "@/store/task-tree-store";

export function AppearanceSettings() {
  const appearance = useTaskTreeStore((s) => s.appearance);
  const setAppearance = useTaskTreeStore((s) => s.setAppearance);
  const vars = appearanceToCssVars(appearance);
  const listScheme = listSchemeFromAppearance(appearance);
  const roseInk = cardColorCssVars("rose", listScheme)!;
  const noteInk = noteAccentCssVars("steel", listScheme);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted)]">
        Farbschema für Listenansicht, Canvas und Seitenleisten. Hintergrund,
        Schrift und Hervorhebung der Listen-Karten folgen dem Schema
        und werden mit der Board-Datei gespeichert.
      </p>

      <div
        className="overflow-hidden rounded-lg"
        style={{
          background: vars["--list-bg"],
          color: vars["--list-text"],
        }}
        aria-hidden
      >
        <div
          className="px-3 py-1.5 text-[11px] font-medium"
          style={{
            background: vars["--list-header"],
            color: vars["--list-muted"],
          }}
        >
          Listenansicht
        </div>
        <div className="space-y-2 p-2.5">
          <div
            className="rounded-md px-2.5 py-1.5 text-xs font-medium"
            style={{
              background: vars["--list-card"],
              boxShadow: `${vars["--list-shadow"]}, 0 0 0 2px ${vars["--list-focus"]}`,
            }}
          >
            Fokussierte Karte
          </div>
          <div
            className="rounded-md px-2.5 py-1.5 text-xs"
            style={{
              background: vars["--list-card-nested"],
              color: vars["--list-muted"],
              boxShadow: vars["--list-shadow"],
            }}
          >
            Unterkarte
          </div>
          <div
            className={[
              "rounded-md px-2.5 py-1.5 text-xs font-medium",
              listScheme === "dark" ? "bg-rose-950" : "bg-rose-100",
            ].join(" ")}
            style={{
              color: roseInk["--list-text"],
              boxShadow: vars["--list-shadow"],
            }}
          >
            Rote Karte
          </div>
          <div
            className="rounded-md px-2.5 py-1.5 text-xs"
            style={{
              background: noteInk["--list-card"],
              color: noteInk["--list-text"],
              boxShadow: vars["--list-shadow"],
            }}
          >
            <span className="font-medium">Notiz</span>
            <span style={{ color: noteInk["--list-muted"] }}> · lesbarer Kontrast</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[0.72rem] font-medium text-[var(--muted)]">
          Listen- / Arbeitsbereich
          <input
            type="color"
            className="dock-field mt-1 h-10 cursor-pointer p-1"
            value={appearance.canvas}
            onChange={(e) => setAppearance({ canvas: e.target.value })}
          />
        </label>
        <label className="block text-[0.72rem] font-medium text-[var(--muted)]">
          Seitenleisten
          <input
            type="color"
            className="dock-field mt-1 h-10 cursor-pointer p-1"
            value={appearance.sidebar}
            onChange={(e) => setAppearance({ sidebar: e.target.value })}
          />
        </label>
      </div>

      <div>
        <p className="group-label mb-2">Voreinstellungen</p>
        <div className="flex flex-wrap gap-1.5">
          {APPEARANCE_PRESETS.map((preset) => {
            const active =
              appearance.canvas === preset.appearance.canvas &&
              appearance.sidebar === preset.appearance.sidebar;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setAppearance(preset.appearance)}
                className={[
                  "rounded-lg px-2.5 py-1.5 text-xs",
                  active ? "dock-control-active" : "dock-control",
                ].join(" ")}
              >
                <span
                  className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm border border-[var(--border)] align-middle"
                  style={{ background: preset.appearance.canvas }}
                  aria-hidden
                />
                {preset.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setAppearance(DEFAULT_APPEARANCE)}
            className="dock-control rounded-lg px-2.5 py-1.5 text-xs"
          >
            Zurücksetzen
          </button>
        </div>
      </div>
    </div>
  );
}
