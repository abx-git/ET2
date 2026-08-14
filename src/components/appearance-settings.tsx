"use client";

import {
  APPEARANCE_PRESETS,
  DEFAULT_APPEARANCE,
} from "@/lib/board-appearance";
import { useTaskTreeStore } from "@/store/task-tree-store";

export function AppearanceSettings() {
  const appearance = useTaskTreeStore((s) => s.appearance);
  const setAppearance = useTaskTreeStore((s) => s.setAppearance);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted)]">
        Farbschema für Arbeitsfläche und Seitenleisten (wie in E2). Wird mit der
        Board-Datei gespeichert.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[0.72rem] font-medium text-[var(--muted)]">
          Arbeitsbereich
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
