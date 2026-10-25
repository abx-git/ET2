/** Escape a cell for tab-separated ET2V rows (JSON string when needed). */
export function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "1" : "0";
  const s = String(value);
  if (!/[\t\r\n"\\]/.test(s) && s.length < 120) return s;
  return JSON.stringify(s);
}

export function parseCell(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith('"') || t.startsWith("'")) {
    try {
      return JSON.parse(t) as string;
    } catch {
      return t;
    }
  }
  return t;
}

function pushCell(parts: string[], cur: string): void {
  parts.push(cur);
}

function splitRowOnChar(line: string, delimiter: "\t"): string[] {
  const parts: string[] = [];
  let cur = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inStr) {
      if (esc) {
        cur += ch;
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = false;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === delimiter) {
      pushCell(parts, cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  pushCell(parts, cur);
  return parts;
}

function splitRowOnWhitespace(line: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inStr) {
      if (esc) {
        cur += ch;
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = false;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) {
        pushCell(parts, cur);
        cur = "";
      }
      continue;
    }
    cur += ch;
  }
  if (cur || parts.length) pushCell(parts, cur);
  return parts;
}

export function row(cols: (string | number | boolean | null | undefined)[]): string {
  return cols.map((c) => cell(c)).join("\t");
}

export function splitRow(line: string): string[] {
  if (line.includes("\t")) return splitRowOnChar(line, "\t");
  return splitRowOnWhitespace(line);
}
