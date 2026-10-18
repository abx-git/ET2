"use client";

import { useCallback, useState, type PointerEvent as ReactPointerEvent } from "react";

import { beginConnectorEndpointDrag } from "@/lib/connector-endpoint-drag";
import { connectorEndpointDragPreview } from "@/lib/connector-target-pick";
import {
  connectorEndpointHandleRadius,
  connectorHitStrokeWidth,
} from "@/lib/connector-style";
import {
  relationAnchors,
  taskCardCenter,
  taskCardRect,
  type Point,
} from "@/lib/connector-geometry";
import { canvasConnectorsCssZIndex } from "@/lib/canvas-stack";
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
  lineEnd: Point;
  hoverNodeId: string | null;
  valid: boolean;
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
  const [reconnect, setReconnect] = useState<ReconnectDrag | null>(null);

  const canAttachTo = useCallback(
    (relationId: string, end: RelationEndpoint, targetId: string): boolean => {
      const rel = relations.find((r) => r.id === relationId);
      if (!rel) return false;
      const nextSource = end === "source" ? targetId : rel.sourceId;
      const nextTarget = end === "target" ? targetId : rel.targetId;
      if (nextSource === nextTarget) return false;
      if (!canConnectSiblings(roots, nextSource, nextTarget)) return false;
      return !relations.some(
        (r) =>
          r.id !== relationId &&
          r.sourceId === nextSource &&
          r.targetId === nextTarget,
      );
    },
    [relations, roots],
  );

  const previewAt = useCallback(
    (relationId: string, end: RelationEndpoint, world: Point): ReconnectDrag => {
      const rel = relations.find((r) => r.id === relationId);
      if (!rel) {
        return { relationId, end, lineEnd: world, hoverNodeId: null, valid: false };
      }
      const fixedNodeId = end === "source" ? rel.targetId : rel.sourceId;
      const fixedNode = byId.get(fixedNodeId);
      const toward = fixedNode ? taskCardCenter(fixedNode) : world;
      const preview = connectorEndpointDragPreview(
        world,
        toward,
        nodes,
        [fixedNodeId],
        (target) => canAttachTo(relationId, end, target.id),
      );
      return {
        relationId,
        end,
        lineEnd: preview.lineEnd,
        hoverNodeId: preview.target?.id ?? null,
        valid: preview.valid,
      };
    },
    [byId, canAttachTo, nodes, relations],
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
    setReconnect(previewAt(relationId, end, world));

    beginConnectorEndpointDrag({
      clientToWorld,
      onMove: (nextWorld) => setReconnect(previewAt(relationId, end, nextWorld)),
      onCommit: (dropWorld) => {
        const preview = previewAt(relationId, end, dropWorld);
        setReconnect(null);
        if (preview.valid && preview.hoverNodeId) {
          onReconnectRelation(relationId, end, preview.hoverNodeId);
        }
      },
    });
  };

  const hitWidth = connectorHitStrokeWidth(zoom);
  const connectorZ = canvasConnectorsCssZIndex(nodes);

  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ zIndex: connectorZ }}
      data-et2-connectors=""
      data-relations={relations.map((r) => r.id).join(" ")}
    >
      <defs>
        <marker id="et2-arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#64748b" />
        </marker>
        <marker id="et2-arrowhead-selected" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#0f766e" />
        </marker>
      </defs>

      {reconnect?.valid && reconnect.hoverNodeId
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
        const showHandles = selected && !reconnect;
        const draggingThis = reconnect?.relationId === rel.id;
        const stroke = relationStroke(rel.type);
        const label = relationArrowLabel(rel);
        const handleR = connectorEndpointHandleRadius(selected);

        const drawStart =
          draggingThis && reconnect.end === "source" ? reconnect.lineEnd : start;
        const drawEnd =
          draggingThis && reconnect.end === "target" ? reconnect.lineEnd : end;

        return (
          <g key={rel.id} data-et2-relation={rel.id}>
            <line
              x1={drawStart.x}
              y1={drawStart.y}
              x2={drawEnd.x}
              y2={drawEnd.y}
              stroke="transparent"
              strokeWidth={hitWidth}
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
                draggingThis ? "#ca8a04" : selected ? "#0f766e" : stroke.color
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
                  fill="#fff"
                  stroke="#0f766e"
                  strokeWidth={2 / Math.max(zoom, 0.25)}
                  className="pointer-events-auto cursor-grab"
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => startEndpointDrag(rel.id, "target", e)}
                >
                  <title>Ansatzpunkt (Ziel) ziehen</title>
                </circle>
              </>
            ) : null}
          </g>
        );
      })}

      {draftSource
        ? nodes
            .filter((node) => node.id !== draftSource.id)
            .map((node) => {
              const { start } = relationAnchors(draftSource, node);
              const end = taskCardCenter(node);
              return (
                <line
                  key={`draft-${node.id}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#ca8a04"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  opacity={0.35}
                  className="pointer-events-none"
                />
              );
            })
        : null}
    </svg>
  );
}
