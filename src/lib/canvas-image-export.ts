/**
 * PNG-/SVG-Export des aktuell sichtbaren Canvas-Ausschnitts.
 */

import { toPng, toSvg } from "html-to-image";

const EXPORT_ATTR = "data-et2-canvas-exporting";

function waitNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function stampName(ext: string, stamp = new Date()): string {
  const y = stamp.getFullYear();
  const m = String(stamp.getMonth() + 1).padStart(2, "0");
  const d = String(stamp.getDate()).padStart(2, "0");
  const hh = String(stamp.getHours()).padStart(2, "0");
  const mm = String(stamp.getMinutes()).padStart(2, "0");
  return `et2-canvas-${y}${m}${d}-${hh}${mm}.${ext}`;
}

export function defaultCanvasPngFilename(stamp = new Date()): string {
  return stampName("png", stamp);
}

export function defaultCanvasSvgFilename(stamp = new Date()): string {
  return stampName("svg", stamp);
}

export interface ExportVisibleCanvasImageOptions {
  filename?: string;
  pixelRatio?: number;
}

function captureFilter(node: HTMLElement): boolean {
  return node.dataset.et2ExportHide !== "true";
}

async function withExportChrome<T>(shell: HTMLElement, fn: () => Promise<T>): Promise<T> {
  shell.setAttribute(EXPORT_ATTR, "true");
  try {
    await waitNextFrame();
    return await fn();
  } finally {
    shell.removeAttribute(EXPORT_ATTR);
  }
}

function captureBox(shell: HTMLElement, pixelRatio: number) {
  const width = Math.max(1, Math.round(shell.clientWidth));
  const height = Math.max(1, Math.round(shell.clientHeight));
  return {
    width,
    height,
    canvasWidth: Math.round(width * pixelRatio),
    canvasHeight: Math.round(height * pixelRatio),
    backgroundColor: getComputedStyle(shell).backgroundColor || "#edf0f4",
  };
}

function resolvePixelRatio(override?: number): number {
  return (
    override ??
    Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 2)
  );
}

/** Erfasst den sichtbaren Canvas-Shell-Ausschnitt und lädt ihn als PNG herunter. */
export async function exportVisibleCanvasToPng(
  shell: HTMLElement,
  options: ExportVisibleCanvasImageOptions = {},
): Promise<void> {
  const pixelRatio = resolvePixelRatio(options.pixelRatio);
  const filename = options.filename ?? defaultCanvasPngFilename();
  const box = captureBox(shell, pixelRatio);

  const dataUrl = await withExportChrome(shell, () =>
    toPng(shell, {
      pixelRatio,
      width: box.width,
      height: box.height,
      canvasWidth: box.canvasWidth,
      canvasHeight: box.canvasHeight,
      backgroundColor: box.backgroundColor,
      cacheBust: true,
      filter: (node) => (node instanceof HTMLElement ? captureFilter(node) : true),
    }),
  );
  downloadDataUrl(filename, dataUrl);
}

/** Erfasst den sichtbaren Canvas-Shell-Ausschnitt und lädt ihn als SVG herunter. */
export async function exportVisibleCanvasToSvg(
  shell: HTMLElement,
  options: ExportVisibleCanvasImageOptions = {},
): Promise<void> {
  const filename = options.filename ?? defaultCanvasSvgFilename();
  const dataUrl = await withExportChrome(shell, () =>
    toSvg(shell, {
      width: Math.max(1, Math.round(shell.clientWidth)),
      height: Math.max(1, Math.round(shell.clientHeight)),
      backgroundColor: getComputedStyle(shell).backgroundColor || "#edf0f4",
      cacheBust: true,
      filter: (node) => (node instanceof HTMLElement ? captureFilter(node) : true),
    }),
  );
  downloadDataUrl(filename, dataUrl);
}
