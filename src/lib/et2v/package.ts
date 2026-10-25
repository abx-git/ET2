import type { BoardImportPayload } from "@/lib/task-tree-json";

import { encodeEt2vFromPayload, type EncodeEt2vOptions } from "@/lib/et2v/encode";
import { isEt2vText } from "@/lib/et2v/decode";
import { ET2V_ENGLISH_LLM_PROMPT, stringifyEt2vSchema } from "@/lib/et2v/schema";
import { ET2V_FORMAT, ET2V_VERSION } from "@/lib/et2v/constants";

export function buildEt2vSchemaPromptPackage(): string {
  return [
    "ET2V schema prompt package",
    "No board data — generate ET2V text that conforms to the schema below.",
    `Wire format: ${ET2V_FORMAT} v${ET2V_VERSION}. Layout is explicit on the canvas.`,
    "Paste generated data into ET2 (Daten → ET2V einfügen or Canvas → ET2V).",
    "",
    "## prompt",
    ET2V_ENGLISH_LLM_PROMPT.trim(),
    "",
    "## schema",
    "```json",
    stringifyEt2vSchema(),
    "```",
    "",
  ].join("\n");
}

export function buildEt2vClipboardPackage(
  payload: BoardImportPayload,
  options?: EncodeEt2vOptions,
): string {
  const data = encodeEt2vFromPayload(payload, { ...options, scope: options?.scope ?? "context" });
  return [
    "ET2 compact package (ET2V)",
    `Wire format: ${ET2V_FORMAT} v${ET2V_VERSION}.`,
    "Paste this package or only the ## data block into ET2.",
    "",
    "## prompt",
    ET2V_ENGLISH_LLM_PROMPT.trim(),
    "",
    "## schema",
    "```json",
    stringifyEt2vSchema(),
    "```",
    "",
    "## data",
    "```et2v",
    data.trimEnd(),
    "```",
    "",
  ].join("\n");
}

export function extractEt2vFromClipboardText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const dataFence = trimmed.match(/##\s*data\s*\n```(?:et2v)?\s*\n([\s\S]*?)\n```/i);
  if (dataFence?.[1]?.trim()) return dataFence[1].trim();

  if (isEt2vText(trimmed)) return trimmed;

  return trimmed;
}

export function et2vExportFilename(title: string, scope: string): string {
  const slug = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "et2-board";
  return `${slug(title)}-${slug(scope)}.et2v.txt`;
}
