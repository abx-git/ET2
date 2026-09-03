import { describe, expect, it } from "vitest";

import {
  entityTableMinHeight,
  isEntitySymbol,
  parseEntityAttributesText,
  serializeEntityAttributes,
} from "./entity-attribute";

describe("entity attributes", () => {
  it("parses PK/FK prefixes and optional types", () => {
    const attrs = parseEntityAttributesText(`
* id : integer
name : text
~ kunden_id
PK code
FK city_id : int
`);
    expect(attrs).toEqual([
      { name: "id", type: "integer", key: "pk" },
      { name: "name", type: "text" },
      { name: "kunden_id", key: "fk" },
      { name: "code", key: "pk" },
      { name: "city_id", type: "int", key: "fk" },
    ]);
  });

  it("roundtrips serialize → parse", () => {
    const src = [
      { name: "id", key: "pk" as const },
      { name: "name", type: "text" },
      { name: "kunden_id", key: "fk" as const, type: "int" },
    ];
    expect(parseEntityAttributesText(serializeEntityAttributes(src))).toEqual(src);
  });

  it("grows table height with rows", () => {
    expect(entityTableMinHeight([])).toBeLessThan(entityTableMinHeight([{ name: "a" }, { name: "b" }, { name: "c" }]));
  });

  it("detects entity symbols", () => {
    expect(isEntitySymbol({ kind: "symbol", symbolType: "entity" })).toBe(true);
    expect(isEntitySymbol({ kind: "symbol", symbolType: "process" })).toBe(false);
    expect(isEntitySymbol({ kind: "card" })).toBe(false);
  });
});
