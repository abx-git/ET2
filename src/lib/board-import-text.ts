import {
  boardImportPayloadFromEt2vText,
  decodeEt2vText,
  extractEt2vFromClipboardText,
  isEt2vText,
} from "@/lib/et2v";
import type { BoardImportPayload } from "@/lib/task-tree-json";
import type { TaskNode } from "@/types/task-node";

/** True when pasted text is likely board JSON or ET2V (not Mermaid). */
export function looksLikePasteImportText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (isEt2vText(trimmed)) return true;
  if (/##\s*data\s*\n```(?:et2v)?/i.test(trimmed)) return true;
  if (trimmed.startsWith("{")) return true;
  return false;
}

export function boardImportPayloadFromEt2vPackageText(text: string): BoardImportPayload | null {
  return boardImportPayloadFromEt2vText(extractEt2vFromClipboardText(text));
}

export function parseEt2vImport(text: string): {
  board: BoardImportPayload | null;
  subtreeRoot: TaskNode | null;
  context: BoardImportPayload | null;
} {
  const raw = extractEt2vFromClipboardText(text);
  const decoded = decodeEt2vText(raw);
  if (!decoded) {
    return { board: null, subtreeRoot: null, context: null };
  }
  if (decoded.scope === "board") {
    return { board: decoded.payload, subtreeRoot: null, context: null };
  }
  if (decoded.scope === "subtree" && decoded.subtreeRoot) {
    return { board: null, subtreeRoot: decoded.subtreeRoot, context: null };
  }
  if (decoded.scope === "context") {
    return { board: null, subtreeRoot: null, context: decoded.payload };
  }
  return { board: null, subtreeRoot: null, context: null };
}

export function boardImportPayloadFromImportText(text: string): BoardImportPayload | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (isEt2vText(trimmed) || /##\s*data\s*\n```(?:et2v)?/i.test(trimmed)) {
    const fromPack = boardImportPayloadFromEt2vPackageText(trimmed);
    if (fromPack) return fromPack;
  }
  return null;
}
