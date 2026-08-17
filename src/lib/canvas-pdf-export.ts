/**
 * PDF-Export des aktuell sichtbaren Canvas-Ausschnitts (Viewport-Screenshot).
 */

import { toJpeg } from "html-to-image";

const EXPORT_ATTR = "data-et2-canvas-exporting";

/**
 * Einseitiges PDF mit eingebettetem JPEG.
 * `pageWidthPt`/`pageHeightPt` = Seitengröße; `imageWidthPx`/`imageHeightPx` = echte JPEG-Pixel.
 */
export function buildJpegPdf(
  jpeg: Uint8Array,
  pageWidthPt: number,
  pageHeightPt: number,
  imageWidthPx: number = pageWidthPt,
  imageHeightPx: number = pageHeightPt,
): Uint8Array {
  const pageW = Math.max(1, Math.round(pageWidthPt));
  const pageH = Math.max(1, Math.round(pageHeightPt));
  const imgW = Math.max(1, Math.round(imageWidthPx));
  const imgH = Math.max(1, Math.round(imageHeightPx));
  const encoder = new TextEncoder();

  const parts: Uint8Array[] = [];
  let byteLength = 0;
  const track = (chunk: Uint8Array) => {
    parts.push(chunk);
    byteLength += chunk.length;
  };
  const trackText = (text: string) => track(encoder.encode(text));

  const objectOffsets: number[] = [0];

  trackText("%PDF-1.4\n");

  objectOffsets.push(byteLength);
  trackText("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  objectOffsets.push(byteLength);
  trackText("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  objectOffsets.push(byteLength);
  trackText(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n`,
  );

  const contentStream = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStream);
  objectOffsets.push(byteLength);
  trackText(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  track(contentBytes);
  trackText("\nendstream\nendobj\n");

  objectOffsets.push(byteLength);
  trackText(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  track(jpeg);
  trackText("\nendstream\nendobj\n");

  const xrefStart = byteLength;
  trackText(`xref\n0 ${objectOffsets.length}\n`);
  trackText("0000000000 65535 f \n");
  for (let i = 1; i < objectOffsets.length; i += 1) {
    trackText(`${String(objectOffsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  trackText(
    `trailer\n<< /Size ${objectOffsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  const out = new Uint8Array(byteLength);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function downloadPdfBytes(filename: string, bytes: Uint8Array): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Ungültiges Bild-Data-URL");
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function defaultCanvasPdfFilename(stamp = new Date()): string {
  const y = stamp.getFullYear();
  const m = String(stamp.getMonth() + 1).padStart(2, "0");
  const d = String(stamp.getDate()).padStart(2, "0");
  const hh = String(stamp.getHours()).padStart(2, "0");
  const mm = String(stamp.getMinutes()).padStart(2, "0");
  return `et2-canvas-${y}${m}${d}-${hh}${mm}.pdf`;
}

function waitNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export interface ExportVisibleCanvasPdfOptions {
  filename?: string;
  /** Device-pixel-ratio for sharper capture (default 2). */
  pixelRatio?: number;
  /** JPEG quality 0–1 (default 0.92). */
  quality?: number;
}

/**
 * Erfasst den sichtbaren Canvas-Shell-Ausschnitt und lädt ihn als PDF herunter.
 */
export async function exportVisibleCanvasToPdf(
  shell: HTMLElement,
  options: ExportVisibleCanvasPdfOptions = {},
): Promise<void> {
  const pixelRatio =
    options.pixelRatio ??
    Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 2);
  const quality = options.quality ?? 0.92;
  const filename = options.filename ?? defaultCanvasPdfFilename();

  const width = Math.max(1, Math.round(shell.clientWidth));
  const height = Math.max(1, Math.round(shell.clientHeight));
  const canvasWidth = Math.round(width * pixelRatio);
  const canvasHeight = Math.round(height * pixelRatio);

  shell.setAttribute(EXPORT_ATTR, "true");
  try {
    await waitNextFrame();

    const dataUrl = await toJpeg(shell, {
      quality,
      pixelRatio,
      width,
      height,
      canvasWidth,
      canvasHeight,
      backgroundColor: getComputedStyle(shell).backgroundColor || "#edf0f4",
      cacheBust: true,
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        if (node.dataset.et2ExportHide === "true") return false;
        return true;
      },
    });

    const jpeg = dataUrlToUint8Array(dataUrl);
    const pdf = buildJpegPdf(jpeg, width, height, canvasWidth, canvasHeight);
    downloadPdfBytes(filename, pdf);
  } finally {
    shell.removeAttribute(EXPORT_ATTR);
  }
}
