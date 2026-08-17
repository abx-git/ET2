/**
 * Schreiben von Mehrdateien-Markdown-Exporten in ein per Directory Picker gewähltes Verzeichnis.
 */

import type { MarkdownExportFile } from "@/lib/subtree-branch-export";

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export function directoryPickerUnavailableMessage(): string {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return "Ordner-Export: Seite über https:// oder http://localhost öffnen.";
  }
  return "Ordner-Export benötigt Chrome, Edge oder Brave (File System Access). Alternativ „Als Datei speichern“ nutzen.";
}

/** Öffnet den Verzeichnis-Dialog; `null` bei Abbruch oder fehlender API. */
export async function pickDirectoryForWrite(): Promise<FileSystemDirectoryHandle | null> {
  if (!isDirectoryPickerSupported()) return null;
  try {
    return await window.showDirectoryPicker!({ mode: "readwrite" });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

async function ensureDirectory(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const part of segments) {
    if (!part || part === "." || part === "..") continue;
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

/** Schreibt relative Markdown-Pfade unter `dirHandle`. Gibt die Anzahl geschriebener Dateien zurück. */
export async function writeMarkdownFilesToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  files: readonly MarkdownExportFile[],
): Promise<number> {
  for (const file of files) {
    const segments = file.relativePath.split("/").filter(Boolean);
    const name = segments.pop();
    if (!name) continue;
    const parent = await ensureDirectory(dirHandle, segments);
    const handle = await parent.getFileHandle(name, { create: true });
    const writable = await handle.createWritable({ keepExistingData: false });
    await writable.write(file.content);
    await writable.close();
  }
  return files.length;
}

/**
 * Directory Picker + Schreiben. Wirft bei API-Fehlern; bei Nutzer-Abbruch `{ cancelled: true }`.
 */
export async function exportMarkdownFilesToPickedDirectory(
  files: readonly MarkdownExportFile[],
): Promise<{ cancelled: true } | { cancelled: false; count: number; directoryName: string }> {
  if (!isDirectoryPickerSupported()) {
    throw new Error(directoryPickerUnavailableMessage());
  }
  const dir = await pickDirectoryForWrite();
  if (!dir) return { cancelled: true };
  const count = await writeMarkdownFilesToDirectory(dir, files);
  return { cancelled: false, count, directoryName: dir.name };
}
