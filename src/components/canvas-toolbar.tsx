"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalJustifyCenter,
  AlignHorizontalSpaceBetween,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceBetween,
  CircleHelp,
  ClipboardCopy,
  Copy,
  Download,
  FileCode2,
  FileText,
  FileType2,
  Image,
  Loader2,
  Maximize2,
  RotateCcw,
  Shapes,
  Spline,
  SquareDashed,
  StretchHorizontal,
  StretchVertical,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import {
  ALIGN_MODE_LABELS,
  ALIGN_MODES_THREE,
  ALIGN_MODES_TWO,
  type AlignMode,
} from "@/lib/element-align";
import {
  listSymbolTypesByGroup,
  SYMBOL_GROUP_LABELS,
  type SymbolType,
} from "@/lib/diagram-symbol";
import {
  TASK_RELATION_TYPE_LABELS,
  TASK_RELATION_TYPES,
  type TaskRelationType,
} from "@/types/task-relation";

type ToolbarMenuId = "export" | "align" | "symbols";

export interface CanvasToolbarProps {
  relationConnectMode: boolean;
  onToggleConnect: () => void;
  defaultRelationType: TaskRelationType;
  onDefaultRelationTypeChange: (type: TaskRelationType) => void;
  onFitAll: () => void;
  onResetView: () => void;
  onExportPrompt: () => void | Promise<void>;
  onExportPdf: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onCopyDrawio: () => void;
  pdfExporting: boolean;
  imageExporting: "png" | "svg" | null;
  drawioCopied: boolean;
  selectedCount: number;
  canDuplicate: boolean;
  onAlign: (mode: AlignMode) => void;
  onDuplicate: () => void;
  onAddGroup: () => void;
  placingSymbolType: SymbolType | null;
  symbolPaletteOpen: boolean;
  onSymbolPaletteOpenChange: (open: boolean) => void;
  onPickSymbol: (type: SymbolType) => void;
  onCancelPlacing: () => void;
  onOpenHelp: () => void;
}

const iconClass = "h-3.5 w-3.5 shrink-0";

const btnClass =
  "flex h-7 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35";

const menuItemClass =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50";

const ALIGN_ICONS: Record<AlignMode, typeof AlignStartHorizontal> = {
  left: AlignStartVertical,
  centerX: AlignCenterVertical,
  right: AlignEndVertical,
  top: AlignStartHorizontal,
  centerY: AlignCenterHorizontal,
  bottom: AlignEndHorizontal,
  distributeX: AlignHorizontalSpaceBetween,
  distributeY: AlignVerticalSpaceBetween,
  sameWidth: StretchHorizontal,
  sameHeight: StretchVertical,
};

function ToolbarDivider() {
  return <span className="mx-0.5 hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />;
}

function ToolbarMenu({
  id,
  open,
  align = "left",
  widthClass = "w-56",
  children,
}: {
  id: string;
  open: boolean;
  align?: "left" | "right";
  widthClass?: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      id={id}
      role="menu"
      className={[
        "absolute top-full z-40 mt-1 origin-top rounded-xl border border-slate-200/90 bg-white p-1 shadow-lg shadow-slate-900/10",
        widthClass,
        align === "right" ? "right-0" : "left-0",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function CanvasToolbar({
  relationConnectMode,
  onToggleConnect,
  defaultRelationType,
  onDefaultRelationTypeChange,
  onFitAll,
  onResetView,
  onExportPrompt,
  onExportPdf,
  onExportPng,
  onExportSvg,
  onCopyDrawio,
  pdfExporting,
  imageExporting,
  drawioCopied,
  selectedCount,
  canDuplicate,
  onAlign,
  onDuplicate,
  onAddGroup,
  placingSymbolType,
  symbolPaletteOpen,
  onSymbolPaletteOpenChange,
  onPickSymbol,
  onCancelPlacing,
  onOpenHelp,
}: CanvasToolbarProps) {
  const [menu, setMenu] = useState<Exclude<ToolbarMenuId, "symbols"> | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const exportMenuId = useId();
  const alignMenuId = useId();
  const symbolsMenuId = useId();
  const exportBusy = pdfExporting || imageExporting !== null;
  const openMenu: ToolbarMenuId | null = symbolPaletteOpen ? "symbols" : menu;

  const closeMenus = useCallback(() => {
    setMenu(null);
    onSymbolPaletteOpenChange(false);
  }, [onSymbolPaletteOpenChange]);

  const toggleMenu = (id: ToolbarMenuId) => {
    if (openMenu === id) {
      closeMenus();
      return;
    }
    setMenu(id === "symbols" ? null : id);
    onSymbolPaletteOpenChange(id === "symbols");
  };

  useEffect(() => {
    if (!openMenu) return;
    const onDoc = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || rootRef.current?.contains(e.target)) return;
      closeMenus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenus();
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu, closeMenus]);

  const placingLabel = placingSymbolType
    ? listSymbolTypesByGroup("useCase")
        .concat(listSymbolTypesByGroup("flowchart"))
        .find((d) => d.id === placingSymbolType)?.label
    : null;

  return (
    <div
      ref={rootRef}
      className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1"
    >
      <div
        className={[
          "flex h-7 items-center rounded-md ring-1 ring-inset",
          relationConnectMode ? "bg-amber-50 ring-amber-400" : "bg-white ring-slate-200",
        ].join(" ")}
      >
        <button
          type="button"
          className={[btnClass, "h-full rounded-r-none", relationConnectMode ? "text-amber-900" : ""].join(
            " ",
          )}
          title="Karten verbinden: Quelle, dann Ziel anklicken"
          aria-pressed={relationConnectMode}
          onClick={onToggleConnect}
        >
          <Spline className={iconClass} aria-hidden />
          <span className="hidden sm:inline">Verbinden</span>
        </button>
        <span className="h-4 w-px bg-slate-200" aria-hidden />
        <select
          className="h-full max-w-[8.75rem] cursor-pointer border-0 bg-transparent py-0 pl-1.5 pr-1 text-[11px] text-slate-700 outline-none"
          value={defaultRelationType}
          title="Typ für neue Verbindungen (Richtung: Quelle → Ziel)"
          aria-label="Typ für neue Verbindungen"
          onChange={(e) => onDefaultRelationTypeChange(e.target.value as TaskRelationType)}
        >
          {TASK_RELATION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TASK_RELATION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <button
          type="button"
          className={[
            btnClass,
            placingSymbolType || openMenu === "symbols" ? "bg-violet-50 text-violet-900" : "",
          ].join(" ")}
          title="Ablaufplan- und Use-Case-Symbole platzieren"
          aria-expanded={openMenu === "symbols"}
          aria-haspopup="menu"
          aria-controls={openMenu === "symbols" ? symbolsMenuId : undefined}
          onClick={() => toggleMenu("symbols")}
        >
          <Shapes className={iconClass} aria-hidden />
          <span className="hidden sm:inline">Symbole</span>
        </button>
        <ToolbarMenu id={symbolsMenuId} open={openMenu === "symbols"}>
          {(["useCase", "flowchart"] as const).map((group) => (
            <div key={group} className="mb-1 last:mb-0">
              <p className="px-2.5 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {SYMBOL_GROUP_LABELS[group]}
              </p>
              {listSymbolTypesByGroup(group).map((def) => (
                <button
                  key={def.id}
                  type="button"
                  role="menuitem"
                  className={[
                    menuItemClass,
                    placingSymbolType === def.id ? "bg-violet-50 text-violet-900" : "",
                  ].join(" ")}
                  onClick={() => onPickSymbol(def.id)}
                >
                  {def.label}
                </button>
              ))}
            </div>
          ))}
          {placingSymbolType ? (
            <button type="button" role="menuitem" className={menuItemClass} onClick={onCancelPlacing}>
              Platzieren abbrechen
            </button>
          ) : null}
        </ToolbarMenu>
      </div>

      <button
        type="button"
        className={btnClass}
        title="Gruppierungs-Box anlegen"
        aria-label="Gruppe anlegen"
        onClick={onAddGroup}
      >
        <SquareDashed className={iconClass} aria-hidden />
        <span className="hidden md:inline">Gruppe</span>
      </button>

      <ToolbarDivider />

      <button
        type="button"
        className={btnClass}
        title="Auswahl duplizieren (Strg/Cmd+D)"
        aria-label="Duplizieren"
        disabled={!canDuplicate}
        onClick={onDuplicate}
      >
        <Copy className={iconClass} aria-hidden />
      </button>

      {selectedCount >= 2 ? (
        <div className="relative">
          <button
            type="button"
            className={btnClass}
            title="Ausgewählte Karten ausrichten"
            aria-expanded={openMenu === "align"}
            aria-haspopup="menu"
            aria-controls={openMenu === "align" ? alignMenuId : undefined}
            onClick={() => toggleMenu("align")}
          >
            <AlignHorizontalJustifyCenter className={iconClass} aria-hidden />
            <span className="hidden sm:inline">Ausrichten</span>
          </button>
          <ToolbarMenu id={alignMenuId} open={openMenu === "align"} widthClass="w-52">
            {ALIGN_MODES_TWO.map((mode) => {
              const Icon = ALIGN_ICONS[mode];
              return (
                <button
                  key={mode}
                  type="button"
                  role="menuitem"
                  className={menuItemClass}
                  onClick={() => {
                    onAlign(mode);
                    closeMenus();
                  }}
                >
                  <Icon className={iconClass} aria-hidden />
                  {ALIGN_MODE_LABELS[mode]}
                </button>
              );
            })}
            {selectedCount >= 3
              ? ALIGN_MODES_THREE.map((mode) => {
                  const Icon = ALIGN_ICONS[mode];
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="menuitem"
                      className={menuItemClass}
                      onClick={() => {
                        onAlign(mode);
                        closeMenus();
                      }}
                    >
                      <Icon className={iconClass} aria-hidden />
                      {ALIGN_MODE_LABELS[mode]}
                    </button>
                  );
                })
              : null}
          </ToolbarMenu>
        </div>
      ) : null}

      <ToolbarDivider />

      <button
        type="button"
        className={btnClass}
        title="Alles einpassen — alle Karten dieser Ebene sichtbar machen"
        aria-label="Alles einpassen"
        onClick={onFitAll}
      >
        <Maximize2 className={iconClass} aria-hidden />
      </button>
      <button
        type="button"
        className={btnClass}
        title="Ansicht zurücksetzen (Zoom 100 %)"
        aria-label="Ansicht zurücksetzen"
        onClick={onResetView}
      >
        <RotateCcw className={iconClass} aria-hidden />
      </button>

      <div className="relative">
        <button
          type="button"
          className={btnClass}
          title="Canvas exportieren"
          aria-expanded={openMenu === "export"}
          aria-haspopup="menu"
          aria-controls={openMenu === "export" ? exportMenuId : undefined}
          disabled={exportBusy}
          onClick={() => toggleMenu("export")}
        >
          {exportBusy ? (
            <Loader2 className={`${iconClass} animate-spin`} aria-hidden />
          ) : (
            <Download className={iconClass} aria-hidden />
          )}
          <span className="hidden sm:inline">{exportBusy ? "Export…" : "Export"}</span>
        </button>
        <ToolbarMenu id={exportMenuId} open={openMenu === "export"}>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={() => {
              void Promise.resolve(onExportPrompt()).then(() => {
                setPromptCopied(true);
                window.setTimeout(() => setPromptCopied(false), 1200);
              });
            }}
          >
            <FileText className={iconClass} aria-hidden />
            {promptCopied ? "Prompt kopiert" : "Prompt kopieren"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            disabled={exportBusy}
            onClick={() => {
              closeMenus();
              onExportPdf();
            }}
          >
            <FileType2 className={iconClass} aria-hidden />
            {pdfExporting ? "PDF…" : "PDF (Ansicht)"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            disabled={exportBusy}
            onClick={() => {
              closeMenus();
              onExportPng();
            }}
          >
            <Image className={iconClass} aria-hidden />
            {imageExporting === "png" ? "PNG…" : "PNG (Ansicht)"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            disabled={exportBusy}
            onClick={() => {
              closeMenus();
              onExportSvg();
            }}
          >
            <FileCode2 className={iconClass} aria-hidden />
            {imageExporting === "svg" ? "SVG…" : "SVG (Draw.io)"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={() => {
              onCopyDrawio();
            }}
          >
            <ClipboardCopy className={iconClass} aria-hidden />
            {drawioCopied ? "Draw.io kopiert" : "Nach Draw.io kopieren"}
          </button>
        </ToolbarMenu>
      </div>

      {placingLabel ? (
        <span className="ml-1 rounded bg-violet-100 px-2 py-0.5 text-[11px] text-violet-900">
          Klick: {placingLabel}
        </span>
      ) : null}
      {selectedCount > 1 ? (
        <span className="rounded bg-teal-100 px-2 py-0.5 text-[11px] text-teal-800">
          {selectedCount} ausgewählt
        </span>
      ) : null}

      <div className="ml-auto flex items-center">
        <button
          type="button"
          className={btnClass}
          title="Bedienung anzeigen"
          aria-label="Bedienung anzeigen"
          onClick={onOpenHelp}
        >
          <CircleHelp className={iconClass} aria-hidden />
        </button>
      </div>
    </div>
  );
}
