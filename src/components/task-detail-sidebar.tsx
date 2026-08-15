"use client";

import { Check, Copy, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { mergeCardFieldVisibility } from "@/lib/card-field-visibility";
import { CARD_COLOR_OPTIONS, type CardColorId } from "@/lib/card-color";
import { fromInputDateTimeLocal, toInputDateTimeLocal } from "@/lib/task-datetime";
import {
  EFFORT_UNIT_LABELS,
  EFFORT_UNITS,
  getEffortSource,
  getEffortUnit,
  type EffortUnit,
} from "@/lib/task-effort";
import { formatTaskIdForDisplay } from "@/lib/task-id";
import { normalizeTaskCommand } from "@/lib/task-command";
import { normalizeTaskLink } from "@/lib/task-link";
import { findNodeById } from "@/lib/tree-utils";
import {
  collectAllTagsFromForest,
  isTaskMarkedDone,
  setCompletedTagOnTags,
  tagsAvailableForFilter,
  uniqNonEmptyTags,
} from "@/lib/task-tags";
import { isNoteNode, normalizeNoteMarkdown } from "@/lib/tree-node-kind";
import { useTaskTreeStore } from "@/store/task-tree-store";
import {
  TASK_RELATION_TYPE_LABELS,
  TASK_RELATION_TYPES,
  type TaskRelationType,
} from "@/types/task-relation";

const fieldClass =
  "mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none ring-sky-500/25 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2";
const labelClass = "block text-[11px] font-medium text-slate-500";

function splitTagInput(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function TaskDetailSidebar() {
  const roots = useTaskTreeStore((s) => s.roots);
  const relations = useTaskTreeStore((s) => s.relations);
  const selectedCanvasNodeId = useTaskTreeStore((s) => s.selectedCanvasNodeId);
  const selectedRelationId = useTaskTreeStore((s) => s.selectedRelationId);
  const setSelectedCanvasNodeId = useTaskTreeStore((s) => s.setSelectedCanvasNodeId);
  const setSelectedRelationId = useTaskTreeStore((s) => s.setSelectedRelationId);
  const updateCard = useTaskTreeStore((s) => s.updateCard);
  const updateNote = useTaskTreeStore((s) => s.updateNote);
  const updateRelation = useTaskTreeStore((s) => s.updateRelation);
  const disconnectRelation = useTaskTreeStore((s) => s.disconnectRelation);
  const removeCard = useTaskTreeStore((s) => s.removeCard);
  const drillIntoNode = useTaskTreeStore((s) => s.drillIntoNode);
  const cardFieldVisibility = useTaskTreeStore((s) => s.cardFieldVisibility);
  const effortOnTasksEnabled = useTaskTreeStore((s) => s.effortOnTasksEnabled);
  const completedTag = useTaskTreeStore((s) => s.completedTag);
  const v = mergeCardFieldVisibility(cardFieldVisibility);

  const node = selectedCanvasNodeId ? findNodeById(roots, selectedCanvasNodeId) : null;
  const relation = selectedRelationId
    ? relations.find((r) => r.id === selectedRelationId) ?? null
    : null;

  const [tagDraft, setTagDraft] = useState("");
  const [idCopied, setIdCopied] = useState(false);

  useEffect(() => {
    setTagDraft("");
    setIdCopied(false);
  }, [selectedCanvasNodeId, selectedRelationId]);

  const allTags = useMemo(() => collectAllTagsFromForest(roots), [roots]);
  const pickableTags = useMemo(
    () => (node && !isNoteNode(node) ? tagsAvailableForFilter(allTags, node.tags) : []),
    [allTags, node],
  );

  const empty = !node && !relation;

  return (
    <aside
      className="flex w-72 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--panel-solid)] text-[var(--text)]"
      aria-label="Kartendetails"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
        <h2 className="text-sm font-semibold text-[var(--text)]">Details</h2>
        {(node || relation) && (
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={() => {
              setSelectedCanvasNodeId(null);
              setSelectedRelationId(null);
            }}
          >
            Auswahl aufheben
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {empty ? (
          <p className="text-xs leading-relaxed text-slate-500">
            Karte oder Pfeil auf dem Canvas auswählen, um Details zu bearbeiten.
          </p>
        ) : null}

        {relation && !node ? (
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Abhängigkeit</p>
            <div>
              <label className={labelClass} htmlFor="et2-rel-type">
                Typ
              </label>
              <select
                id="et2-rel-type"
                className={fieldClass}
                value={relation.type}
                onChange={(e) =>
                  updateRelation(relation.id, { type: e.target.value as TaskRelationType })
                }
              >
                {TASK_RELATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TASK_RELATION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="et2-rel-label">
                Beschriftung
              </label>
              <input
                id="et2-rel-label"
                className={fieldClass}
                value={relation.label ?? ""}
                placeholder={
                  relation.type === "untyped"
                    ? "Optionale Beschriftung"
                    : TASK_RELATION_TYPE_LABELS[relation.type]
                }
                onChange={(e) => updateRelation(relation.id, { label: e.target.value })}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              {relation.sourceId} → {relation.targetId}
            </p>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100"
              onClick={() => disconnectRelation(relation.id)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Pfeil löschen
            </button>
          </div>
        ) : null}

        {node && isNoteNode(node) ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Notiz</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 hover:bg-slate-200"
                title="ID kopieren"
                onClick={() => {
                  void navigator.clipboard.writeText(node.id);
                  setIdCopied(true);
                  window.setTimeout(() => setIdCopied(false), 1200);
                }}
              >
                {formatTaskIdForDisplay(node.id)}
                {idCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 opacity-60" />}
              </button>
            </div>
            <div>
              <label className={labelClass} htmlFor="et2-note-title">
                Titel
              </label>
              <input
                id="et2-note-title"
                className={fieldClass}
                value={node.title}
                onChange={(e) => updateNote(node.id, { title: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="et2-note-md">
                Markdown
              </label>
              <textarea
                id="et2-note-md"
                className={`${fieldClass} min-h-[10rem] font-mono text-xs`}
                value={node.markdown ?? ""}
                onChange={(e) =>
                  updateNote(node.id, { markdown: normalizeNoteMarkdown(e.target.value) })
                }
              />
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => drillIntoNode(node.id)}
              >
                Hinein navigieren →
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100"
                onClick={() => {
                  if (window.confirm("Notiz inkl. Unterbaum löschen?")) removeCard(node.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Löschen
              </button>
            </div>
          </div>
        ) : null}

        {node && !isNoteNode(node) ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Karte</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 hover:bg-slate-200"
                title="ID kopieren"
                onClick={() => {
                  void navigator.clipboard.writeText(node.id);
                  setIdCopied(true);
                  window.setTimeout(() => setIdCopied(false), 1200);
                }}
              >
                {formatTaskIdForDisplay(node.id)}
                {idCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 opacity-60" />}
              </button>
            </div>

            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <label className={labelClass} htmlFor="et2-card-title">
                  Titel
                </label>
                <input
                  id="et2-card-title"
                  className={fieldClass}
                  value={node.title}
                  onChange={(e) => updateCard(node.id, { title: e.target.value })}
                />
              </div>
              {v.completedCheck ? (
                <button
                  type="button"
                  className={[
                    "mb-px flex h-[34px] shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium",
                    isTaskMarkedDone(node, completedTag)
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                  aria-pressed={isTaskMarkedDone(node, completedTag)}
                  onClick={() =>
                    updateCard(node.id, {
                      tags: setCompletedTagOnTags(
                        node.tags,
                        completedTag,
                        !isTaskMarkedDone(node, completedTag),
                      ),
                    })
                  }
                >
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </div>

            <div>
              <span className={labelClass}>Farbe</span>
              <div className="mt-1 flex flex-wrap gap-1">
                <button
                  type="button"
                  title="Keine Farbe"
                  className={[
                    "h-6 w-6 rounded-full border bg-white",
                    !node.cardColor ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200",
                  ].join(" ")}
                  onClick={() => updateCard(node.id, { cardColor: undefined })}
                />
                {CARD_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.label}
                    className={[
                      "h-6 w-6 rounded-full border",
                      opt.swatchClass,
                      node.cardColor === opt.id ? "ring-2 ring-sky-400" : "border-transparent",
                    ].join(" ")}
                    onClick={() => updateCard(node.id, { cardColor: opt.id as CardColorId })}
                  />
                ))}
              </div>
            </div>

            {v.description ? (
              <div>
                <label className={labelClass} htmlFor="et2-card-desc">
                  Beschreibung
                </label>
                <textarea
                  id="et2-card-desc"
                  className={`${fieldClass} min-h-[4.5rem]`}
                  value={node.description}
                  onChange={(e) => updateCard(node.id, { description: e.target.value })}
                />
              </div>
            ) : null}

            {v.tags ? (
              <div>
                <label className={labelClass} htmlFor="et2-card-tags">
                  Tags
                </label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {node.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                      title="Tag entfernen"
                      onClick={() =>
                        updateCard(node.id, {
                          tags: node.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()),
                        })
                      }
                    >
                      {tag} ×
                    </button>
                  ))}
                </div>
                <input
                  id="et2-card-tags"
                  className={fieldClass}
                  value={tagDraft}
                  placeholder="Tag eingeben, Enter"
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const next = uniqNonEmptyTags([...node.tags, ...splitTagInput(tagDraft)]);
                    updateCard(node.id, { tags: next });
                    setTagDraft("");
                  }}
                />
                {pickableTags.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {pickableTags.slice(0, 8).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="rounded border border-dashed border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 hover:border-sky-300 hover:text-sky-800"
                        onClick={() =>
                          updateCard(node.id, { tags: uniqNonEmptyTags([...node.tags, tag]) })
                        }
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {(v.dueDate || v.reminderDate) && (
              <div className="grid grid-cols-1 gap-2">
                {v.dueDate ? (
                  <div>
                    <label className={labelClass} htmlFor="et2-card-due">
                      Fällig
                    </label>
                    <input
                      id="et2-card-due"
                      type="datetime-local"
                      className={fieldClass}
                      value={toInputDateTimeLocal(node.dueDate)}
                      onChange={(e) =>
                        updateCard(node.id, { dueDate: fromInputDateTimeLocal(e.target.value) })
                      }
                    />
                  </div>
                ) : null}
                {v.reminderDate ? (
                  <div>
                    <label className={labelClass} htmlFor="et2-card-rem">
                      Erinnerung
                    </label>
                    <input
                      id="et2-card-rem"
                      type="datetime-local"
                      className={fieldClass}
                      value={toInputDateTimeLocal(node.reminderDate)}
                      onChange={(e) =>
                        updateCard(node.id, {
                          reminderDate: fromInputDateTimeLocal(e.target.value),
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
            )}

            {effortOnTasksEnabled && v.effort ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass} htmlFor="et2-card-effort">
                    Aufwand
                  </label>
                  <input
                    id="et2-card-effort"
                    type="number"
                    min={0}
                    step="any"
                    className={fieldClass}
                    value={node.effort}
                    disabled={getEffortSource(node) === "calculated"}
                    onChange={(e) =>
                      updateCard(node.id, {
                        effort: Math.max(0, Number(e.target.value) || 0),
                        effortSource: "manual",
                      })
                    }
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="et2-card-unit">
                    Einheit
                  </label>
                  <select
                    id="et2-card-unit"
                    className={fieldClass}
                    value={getEffortUnit(node)}
                    onChange={(e) =>
                      updateCard(node.id, { effortUnit: e.target.value as EffortUnit })
                    }
                  >
                    {EFFORT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {EFFORT_UNIT_LABELS[u] ?? u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {v.link ? (
              <div>
                <label className={labelClass} htmlFor="et2-card-link">
                  Link
                </label>
                <input
                  id="et2-card-link"
                  className={fieldClass}
                  value={node.link}
                  onChange={(e) => updateCard(node.id, { link: normalizeTaskLink(e.target.value) })}
                />
              </div>
            ) : null}

            {v.command ? (
              <div>
                <label className={labelClass} htmlFor="et2-card-cmd">
                  Befehl
                </label>
                <input
                  id="et2-card-cmd"
                  className={fieldClass}
                  value={node.command ?? ""}
                  onChange={(e) =>
                    updateCard(node.id, { command: normalizeTaskCommand(e.target.value) })
                  }
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => drillIntoNode(node.id)}
              >
                Hinein navigieren →
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100"
                onClick={() => {
                  if (window.confirm("Karte inkl. Unterbaum löschen?")) removeCard(node.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Löschen
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
