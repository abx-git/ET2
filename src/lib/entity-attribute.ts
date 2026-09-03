/**
 * Einfaches ERM: Attribute eines Datenobjekts auf dem Canvas.
 *
 * Textform (eine Zeile pro Attribut):
 *   * id : integer     Primärschlüssel
 *   name : text        normales Attribut
 *   ~ kunden_id        Fremdschlüssel
 * Präfixe PK / FK werden ebenfalls erkannt.
 */

export type EntityAttributeKey = "pk" | "fk";

export interface EntityAttribute {
  name: string;
  type?: string;
  key?: EntityAttributeKey;
}

export const DEFAULT_ENTITY_ATTRIBUTES: EntityAttribute[] = [{ name: "id", key: "pk" }];

export const ENTITY_HEADER_HEIGHT = 28;
export const ENTITY_ROW_HEIGHT = 20;
export const ENTITY_TABLE_PAD = 4;

export function isEntitySymbol(
  node: { kind?: string; symbolType?: string } | null | undefined,
): boolean {
  return node?.kind === "symbol" && node.symbolType === "entity";
}

export function normalizeEntityAttributes(
  value: unknown,
): EntityAttribute[] {
  if (!Array.isArray(value)) return [];
  const out: EntityAttribute[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!name) continue;
    const type = typeof rec.type === "string" ? rec.type.trim() : "";
    const key = rec.key === "pk" || rec.key === "fk" ? rec.key : undefined;
    out.push({ name, ...(type ? { type } : {}), ...(key ? { key } : {}) });
  }
  return out;
}

export function parseEntityAttributesText(text: string): EntityAttribute[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: EntityAttribute[] = [];
  for (const raw of lines) {
    const parsed = parseEntityAttributeLine(raw);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function serializeEntityAttributes(attrs: readonly EntityAttribute[]): string {
  return attrs.map(serializeEntityAttributeLine).join("\n");
}

export function serializeEntityAttributeLine(attr: EntityAttribute): string {
  const type = attr.type?.trim();
  const body = type ? `${attr.name} : ${type}` : attr.name;
  if (attr.key === "pk") return `* ${body}`;
  if (attr.key === "fk") return `~ ${body}`;
  return body;
}

export function entityAttributeBadge(attr: EntityAttribute): string | null {
  if (attr.key === "pk") return "PK";
  if (attr.key === "fk") return "FK";
  return null;
}

export function entityTableMinHeight(attrs: readonly EntityAttribute[]): number {
  const rows = Math.max(attrs.length, 1);
  return ENTITY_HEADER_HEIGHT + rows * ENTITY_ROW_HEIGHT + ENTITY_TABLE_PAD;
}

export function entityTableMinWidth(): number {
  return 160;
}

function parseEntityAttributeLine(raw: string): EntityAttribute | null {
  let line = raw.trim();
  if (!line) return null;

  let key: EntityAttributeKey | undefined;
  const pk = line.match(/^(?:\*|\#|pk[:\s])\s*/i);
  const fk = line.match(/^(?:~|fk[:\s])\s*/i);
  if (pk) {
    key = "pk";
    line = line.slice(pk[0].length).trim();
  } else if (fk) {
    key = "fk";
    line = line.slice(fk[0].length).trim();
  }
  if (!line) return null;

  const colon = line.indexOf(":");
  let name = line;
  let type = "";
  if (colon >= 0) {
    name = line.slice(0, colon).trim();
    type = line.slice(colon + 1).trim();
  }
  if (!name) return null;
  return { name, ...(type ? { type } : {}), ...(key ? { key } : {}) };
}
