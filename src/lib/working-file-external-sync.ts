/**
 * Live-poll policy for a shared-folder Arbeitsdatei.
 * Distinguishes cloud truncate/partial writes from real remote edits.
 */

import { boardImportPayloadFromExportText, boardExportTextsEquivalent } from "@/lib/task-tree-json";
import { boardContentHash, boardJsonHasContent } from "@/lib/working-file-write-fence";

export type ExternalWorkingFileAction = "ignore" | "mark_equivalent" | "adopt" | "conflict";

export interface ClassifyExternalWorkingFileInput {
  diskJson: string;
  localJson: string;
  /** True when the editor differs from the last *synced* baseline (not vs disk). */
  editorDirty: boolean;
  /** True when the last successfully synced disk snapshot had board content. */
  lastSyncedHadContent: boolean;
}

/**
 * Empty file or unparseable JSON while we already know a nonempty board:
 * typical cloud-sync truncate / partial write. Never adopt, never mark synced.
 */
export function isTransientUnstableWorkingFileJson(
  diskJson: string,
  lastSyncedHadContent: boolean,
): boolean {
  if (!lastSyncedHadContent) return false;
  const trimmed = diskJson.trim();
  if (!trimmed) return true;
  return boardImportPayloadFromExportText(trimmed) === null;
}

/**
 * mtime changed but bytes are still our last baseline or already our outgoing
 * payload (own write / FS echo). Safe to persist without skipCas.
 */
export function isSelfCausedDiskRevision(
  diskJson: string,
  expectedContentHash: string | null | undefined,
  outgoingJson: string,
): boolean {
  const diskHash = boardContentHash(diskJson);
  if (diskHash == null) return false;
  if (expectedContentHash != null && expectedContentHash !== "" && diskHash === expectedContentHash) {
    return true;
  }
  const outHash = boardContentHash(outgoingJson);
  return outHash != null && diskHash === outHash;
}

export function classifyExternalWorkingFile(
  input: ClassifyExternalWorkingFileInput,
): { action: ExternalWorkingFileAction } {
  const disk = input.diskJson;
  const trimmed = disk.trim();

  if (!trimmed) {
    if (input.lastSyncedHadContent) return { action: "ignore" };
    if (!boardJsonHasContent(input.localJson)) return { action: "mark_equivalent" };
    return { action: "ignore" };
  }

  const payload = boardImportPayloadFromExportText(trimmed);
  if (!payload) {
    return { action: "ignore" };
  }

  if (boardExportTextsEquivalent(disk, input.localJson)) {
    return { action: "mark_equivalent" };
  }

  if (!input.editorDirty) {
    return { action: "adopt" };
  }

  return { action: "conflict" };
}
