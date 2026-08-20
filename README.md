# ET2

> **Dokumentation** (GitHub-Quellcode). Live-App nach Deploy: **[https://abx-git.github.io/ET2/](https://abx-git.github.io/ET2/)**

Hierarchische Aufgaben wie **T2** (Outline, Suche, Filter, lokale JSON) plus eine **Canvas-Ansicht** im Stil von **E2**: Karten frei positionieren, Abhängigkeiten als Pfeile, Drill-down in Parent-Karten.

**Navigation (Liste):** Outline links, Breadcrumb oben, in der Mitte die Kinder der aktuellen Ebene.

**Navigation (Canvas):** dieselbe Ebene als Kartenfläche — Pan/Zoom, Drag, Verbinden per Pfeil, Doppelklick = hinein.

## Sofort loslegen

```bash
npm install
npm run dev
```

Chrome/Edge empfohlen für File System Access (Arbeitsdatei `et2-board.json`). T2-Boards (`format: "hierarchical-task-manager"`) lassen sich öffnen; fehlende Positionen werden beim Canvas-Öffnen auto-layoutet.

## Ansichten

| Ansicht | Zweck |
|--------|--------|
| Liste | Struktur, Suche, Filter, DnD — wie T2 |
| Canvas | Layout, Abhängigkeits-Pfeile, grafisches Drill-down, Ausrichten, Gruppen mit Inhalt, PNG/SVG/PDF |

Beide teilen denselben Store und denselben Drill-Kontext (`contextNodeId`).

## Datenformat

Weiterhin `hierarchical-task-manager`. ET2 speichert zusätzlich Canvas-Felder (`x`/`y`/`width`/`height` an Knoten) und Board-`relations` (Abhängigkeiten zwischen Geschwistern).

## Kartentypen

`card` und `note` in Liste und Canvas; `symbol` (Use Case / Flowchart) nur im Canvas — nicht in Liste, Outline oder Suche. Registry: `src/lib/card-type-registry.ts`, Formen: `src/lib/diagram-symbol.ts`.

## Repository

[github.com/abx-git/ET2](https://github.com/abx-git/ET2) · Basis: T2-Clone mit Canvas aus E2-Mustern.
