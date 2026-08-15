"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import {
  findCardAtWorldPoint,
  relationAnchors,
  taskCardCenter,
  taskCardRect,
  type Point,
} from "@/lib/connector-geometry";
import { canConnectSiblings, relationStroke } from "@/lib/task-relations";
import { relationArrowLabel, type TaskRelation } from "@/types/task-relation";
import type { TaskNode } from "@/types/task-node";

export type RelationEndpoint = "source" | "target";

export interface TaskConnectorsProps {
  nodes: TaskNode[];
  relations: TaskRelation[];
  roots: TaskNode[];
  selectedRelationId: string | null;
  relationDraftSourceId?: string | null;
  zoom: number;
  clientToWorld: (clientX: number, clientY: number) => Point;
  onSelectRelation: (id: string | null) => void;
  onReconnectRelation: (
    relationId: string,
    end: RelationEndpoint,
    newNodeId: string,
  ) => boolean;
}

interface ReconnectDrag {
  relationId: string;
  end: RelationEndpoint;
  cursor: Point;
  hoverNodeId: string | null;
}

function handleScreenRadius(zoom: number): number {
  return Math.max(6, 8 / Math.max(zoom, 0.25));
}

export function TaskConnectors({
  nodes,
  relations,
  roots,
  selectedRelationId,
  relationDraftSourceId,
  zoom,
  clientToWorld,
  onSelectRelation,
  onReconnectRelation,
}: TaskConnectorsProps) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const draftSource = relationDraftSourceId ? byId.get(relationDraftSourceId) : undefined;
  const [hoveredRelationId, setHoveredRelationId] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState<ReconnectDrag | null>(null);
  const reconnectRef = useRef<ReconnectDrag | null>(null);

  const resolveHoverTarget = useCallback(
    (
      relationId: string,
      end: RelationEndpoint,
      world: Point,
    ): string | null => {
      const rel = relations.find((r) => r.id === relationId);
      if (!rel) return null;
      const fixedNodeId = end === "source" ? rel.targetId : rel.sourceId;
      const hit = findCardAtWorldPoint(nodes, world.x, world.y, [fixedNodeId]);
      if (!hit) return null;
      const nextSource = end === "source" ? hit.id : rel.sourceId;
      const nextTarget = end === "target" ? hit.id : rel.targetId;
      if (nextSource === nextTarget) return null;
      if (!canConnectSiblings(roots, nextSource, nextTarget)) return null;
      if (
        relations.some(
          (r) =>
            r.id !== relationId &&
            r.sourceId === nextSource &&
            r.targetId === nextTarget,
        )
      ) {
        return null;
      }
      return hit.id;
    },
    [nodes, relations, roots],
  );

  const startEndpointDrag = (
    relationId: string,
    end: RelationEndpoint,
    e: ReactPointerEvent,
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectRelation(relationId);

    const world = clientToWorld(e.clientX, e.clientY);
    const initial: ReconnectDrag = {
      relationId,
      end,
      cursor: world,
      hoverNodeId: resolveHoverTarget(relationId, end, world),
    };
    reconnectRef.current = initial;
    setReconnect(initial);

    const onMove = (ev: PointerEvent) => {
      const nextWorld = clientToWorld(ev.clientX, ev.clientY);
      const prev = reconnectRef.current;
      if (!prev) return;
      const next: ReconnectDrag = {
        ...prev,
        cursor: nextWorld,
        hoverNodeId: resolveHoverTarget(prev.relationId, prev.end, nextWorld),
      };
      reconnectRef.current = next;
      setReconnect(next);
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const prev = reconnectRef.current;
      reconnectRef.current = null;
      setReconnect(null);
      if (!prev) return;
      const dropWorld = clientToWorld(ev.clientX, ev.clientY);
      const targetId = resolveHoverTarget(prev.relationId, prev.end, dropWorld);
      if (targetId) {
        onReconnectRelation(prev.relationId, prev.end, targetId);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleR = handleScreenRadius(zoom);
  const activeHandlesRelationId = reconnect?.relationId ?? selectedRelationId ?? hoveredRelationId;

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

      {reconnect?.hoverNodeId
        ? (() => {
            const node = byId.get(reconnect.hoverNodeId);
            if (!node) return null;
            const r = taskCardRect(node);
            return (
              <rect
                x={r.x - 4}
                y={r.y - 4}
                width={r.w + 8}
                height={r.h + 8}
                rx={10}
                fill="none"
                stroke="#0f766e"
                strokeWidth={2 / Math.max(zoom, 0.25)}
                strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                className="pointer-events-none"
              />
            );
          })()
        : null}

      {relations.map((rel) => {
        const src = byId.get(rel.sourceId);
        const tgt = byId.get(rel.targetId);
        if (!src || !tgt) return null;
        const { start, end } = relationAnchors(src, tgt);
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const selected = rel.id === selectedRelationId;
        const showHandles = rel.id === activeHandlesRelationId && !reconnect;
        const draggingThis = reconnect?.relationId === rel.id;
        const stroke = relationStroke(rel.type);
        const label = relationArrowLabel(rel);

        const drawStart = draggingThis && reconnect.end === "source" ? reconnect.cursor : start;
        const drawEnd = draggingThis && reconnect.end === "target" ? reconnect.cursor : end;

        return (
          <g
            key={rel.id}
            onPointerEnter={() => setHoveredRelationId(rel.id)}
            onPointerLeave={() =>
              setHoveredRelationId((id) => (id === rel.id ? null : id))
            }
          >
            <line
              x1={drawStart.x}
              y1={drawStart.y}
              x2={drawEnd.x}
              y2={drawEnd.y}
              stroke="transparent"
              strokeWidth={14}
              className="pointer-events-auto cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelectRelation(rel.id);
              }}
            />
            <line
              x1={drawStart.x}
              y1={drawStart.y}
              x2={drawEnd.x}
              y2={drawEnd.y}
              stroke={
                draggingThis
                  ? "#ca8a04"
                  : selected
                    ? "#0f766e"
                    : stroke.color
              }
              strokeWidth={selected || draggingThis ? 3 : 2}
              strokeDasharray={
                draggingThis ? "6 4" : stroke.dashed ? "6 4" : undefined
              }
              markerEnd={
                selected || draggingThis
                  ? "url(#et2-arrowhead-selected)"
                  : "url(#et2-arrowhead)"
              }
              className="pointer-events-none"
            />
            {label && !draggingThis ? (
              <text
                x={midX}
                y={midY - 8}
                textAnchor="middle"
                className="pointer-events-none fill-slate-500 text-[10px]"
              >
                {label}
              </text>
            ) : null}
            {showHandles ? (
              <>
                <circle
                  cx={start.x}
                  cy={start.y}
                  r={handleR}
                  fill="#fff"
                  stroke="#0f766e"
                  strokeWidth={2 / Math.max(zoom, 0.25)}
                  className="pointer-events-auto cursor-grab"
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => startEndpointDrag(rel.id, "source", e)}
                >
                  <title>Ansatzpunkt (Quelle) ziehen</title>
                </circle>
                <circle
                  cx={end.x}
                  cy={end.y}
                  r={handleR}
                  fill="#0f766e"
                  stroke="#fff"
                  strokeWidth={2 / Math.max(zoom, 0.25)}
                  className="pointer-events-auto cursor-grab"
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => startEndpointDrag(rel.id, "target", e)}
                >
                  <title>Ansatzpunkt (Ziel) ziehen</title>
                </circle>
              </>
            ) : null}
            {draggingThis ? (
              <circle
                cx={reconnect.cursor.x}
                cy={reconnect.cursor.y}
                r={handleR}
                fill={reconnect.end === "target" ? "#0f766e" : "#fff"}
                stroke={reconnect.end === "target" ? "#fff" : "#0f766e"}
                strokeWidth={2 / Math.max(zoom, 0.25)}
                className="pointer-events-none"
              />
            ) : null}
          </g>
        );
      })}

      {draftSource ? (
        <circle
          cx={taskCardCenter(draftSource).x}
          cy={taskCardCenter(draftSource).y}
          r={6}
          fill="#ca8a04"
          className="pointer-events-none"
        />
      ) : null}
    </svg>
  );
}
