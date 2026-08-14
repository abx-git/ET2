/**
 * Kartentypen (Extension Point)
 * =============================
 *
 * Phase 1 registriert nur `card` und `note` in `src/lib/card-type-registry.ts`.
 * Spätere Typen (analog zu E2-Workshop-Modi) werden über `registerCardType(...)`
 * hinzugefügt — Store und Canvas lesen Größen/Labels nur über diese Registry.
 *
 * Empfohlener Ablauf für einen neuen Typ:
 * 1. `TreeNodeKind` bzw. Registry-ID erweitern
 * 2. `CardTypeDefinition` registrieren (Default-Größe, editierbare Felder)
 * 3. Renderer in Canvas/Liste (optional eigener Card-Body)
 * 4. JSON-Schema um typspezifische Felder ergänzen
 */
export {};
