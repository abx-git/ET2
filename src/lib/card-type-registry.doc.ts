/**
 * Kartentypen (Extension Point)
 * =============================
 *
 * Registriert: `card`, `note`, sowie canvas-only `symbol` (Formen in `diagram-symbol.ts`).
 * Weitere Typen (analog zu E2-Workshop-Modi) über `registerCardType(...)` —
 * Store und Canvas lesen Größen/Labels nur über diese Registry.
 *
 * Empfohlener Ablauf für einen neuen Typ:
 * 1. `TreeNodeKind` bzw. Registry-ID erweitern
 * 2. `CardTypeDefinition` registrieren (Default-Größe, editierbare Felder, `listVisibleIn`)
 * 3. Renderer in Canvas/Liste (optional eigener Card-Body)
 * 4. JSON-Schema um typspezifische Felder ergänzen
 * 5. Bei `listVisibleIn: "canvas"`: aus Liste/Outline/Suche ausfiltern
 */
export {};
