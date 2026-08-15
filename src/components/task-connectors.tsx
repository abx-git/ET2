"use client";

import { relationAnchors } from "@/lib/connector-geometry";
import { relationStroke } from "@/lib/task-relations";
import { relationArrowLabel, type TaskRelation } from "@/types/task-relation";
import type { TaskNode } from "@/types/task-node";

export interface TaskConnectorsProps {
  nodes: TaskNode[];
  relations: TaskRelation[];
  selectedRelationId: string | null;
  relationDraftSourceId?: string | null;
  onSelectRelation: (id: string | null) => void;
}

export function TaskConnectors({
  nodes,
  relations,
  selectedRelationId,
  relationDraftSourceId,
  onSelectRelation,
}: TaskConnectorsProps) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const draftSource = relationDraftSourceId ? byId.get(relationDraftSourceId) : undefined;

  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" style={{ zIndex: 10 }}>
      <defs>
        <marker id="et2-arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#64748b" />
        </marker>
        <marker id="et2-arrowhead-selected" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#0f766e" />
        </marker>
        <marker id="et2-arrowhead-draft" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#ca8a04" />
        </marker>
      </defs>

      {relations.map((rel) => {
        const src = byId.get(rel.sourceId);
        const tgt = byId.get(rel.targetId);
        if (!src || !tgt) return null;
        const { start, end } = relationAnchors(src, tgt);
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const selected = rel.id === selectedRelationId;
        const stroke = relationStroke(rel.type);
        const label = relationArrowLabel(rel);
        return (
          <g key={rel.id}>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="transparent"
              strokeWidth={14}
              className="pointer-events-auto cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelectRelation(rel.id);
              }}
            />
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={selected ? "#0f766e" : stroke.color}
              strokeWidth={selected ? 3 : 2}
              strokeDasharray={stroke.dashed ? "6 4" : undefined}
              markerEnd={selected ? "url(#et2-arrowhead-selected)" : "url(#et2-arrowhead)"}
              className="pointer-events-none"
            />
            {label ? (
              <text
                x={midX}
                y={midY - 8}
                textAnchor="middle"
                className="pointer-events-none fill-slate-500 text-[10px]"
              >
                {label}
              </text>
            ) : null}
          </g>
        );
      })}

      {draftSource ? (
        <circle
          cx={(draftSource.x ?? 0) + ((draftSource.width ?? 220) / 2)}
          cy={(draftSource.y ?? 0) + ((draftSource.height ?? 120) / 2)}
          r={6}
          fill="#ca8a04"
          className="pointer-events-none"
        />
      ) : null}
    </svg>
  );
}
