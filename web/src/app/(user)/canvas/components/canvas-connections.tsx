import { useState, type PointerEvent } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasConnection, CanvasNodeData, ConnectionHandle, Position } from "../types";

export function ConnectionPath({ connection, from, to, active, onSelect, onDelete, onContextMenu }: { connection: CanvasConnection; from: CanvasNodeData; to: CanvasNodeData; active: boolean; onSelect: () => void; onDelete: () => void; onContextMenu?: (event: ReactMouseEvent<SVGPathElement>) => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [hovered, setHovered] = useState(false);
    const [cutPosition, setCutPosition] = useState<Position | null>(null);
    const startX = from.position.x + from.width;
    const startY = from.position.y + from.height / 2;
    const endX = to.position.x;
    const endY = to.position.y + to.height / 2;
    const dx = Math.abs(endX - startX);
    const curvature = Math.max(dx * 0.5, 50);
    const pathD = `M ${startX} ${startY} C ${startX + curvature} ${startY}, ${endX - curvature} ${endY}, ${endX} ${endY}`;
    const flowGradientId = `connection-flow-${connection.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const updateCutPosition = (event: PointerEvent<SVGElement>) => {
        const position = getSvgPointerPosition(event);
        if (position) setCutPosition(position);
    };

    return (
        <g
            onPointerLeave={() => {
                setHovered(false);
                setCutPosition(null);
            }}
        >
            <defs>
                <linearGradient id={flowGradientId} x1={startX} y1={startY} x2={endX} y2={endY} gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="28%" stopColor="#a78bfa" />
                    <stop offset="52%" stopColor="#34d399" />
                    <stop offset="76%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#fb7185" />
                </linearGradient>
            </defs>
            <path
                data-connection-id={connection.id}
                d={pathD}
                stroke="transparent"
                strokeWidth="16"
                fill="none"
                style={{ cursor: "pointer", pointerEvents: "stroke" }}
                onPointerEnter={(event) => {
                    setHovered(true);
                    updateCutPosition(event);
                }}
                onPointerMove={updateCutPosition}
                onClick={(event) => {
                    event.stopPropagation();
                    onSelect();
                }}
                onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onContextMenu?.(event);
                }}
            />
            <path
                d={pathD}
                stroke={active ? theme.node.activeStroke : theme.node.muted}
                strokeWidth={active ? 3 : 2}
                strokeOpacity={active ? 1 : 0.82}
                fill="none"
                style={{ filter: active ? `drop-shadow(0 0 8px ${theme.node.activeStroke}66)` : undefined, pointerEvents: "none" }}
            />
            <path d={pathD} stroke={`url(#${flowGradientId})`} strokeWidth={active ? 9 : 7} strokeOpacity={active || hovered ? 0.36 : 0.24} strokeLinecap="round" strokeDasharray="18 30" strokeDashoffset="48" fill="none" style={{ filter: "blur(4px)", pointerEvents: "none" }}>
                <animate attributeName="stroke-dashoffset" from="48" to="0" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.18;0.38;0.22" dur="1.6s" repeatCount="indefinite" />
            </path>
            <path d={pathD} stroke={`url(#${flowGradientId})`} strokeWidth={active ? 3.4 : 2.8} strokeOpacity={active || hovered ? 0.96 : 0.74} strokeLinecap="round" strokeDasharray="12 24" strokeDashoffset="36" fill="none" style={{ filter: "drop-shadow(0 0 5px #38bdf8) drop-shadow(0 0 8px #fb7185)", pointerEvents: "none" }}>
                <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.1s" repeatCount="indefinite" />
            </path>
            {hovered && cutPosition ? <ConnectionCutButton x={cutPosition.x} y={cutPosition.y} connectionId={connection.id} theme={theme} onDelete={onDelete} /> : null}
        </g>
    );
}

function ConnectionCutButton({ x, y, connectionId, theme, onDelete }: { x: number; y: number; connectionId: string; theme: CanvasTheme; onDelete: () => void }) {
    return (
        <g
            data-connection-id={connectionId}
            transform={`translate(${x} ${y})`}
            style={{ cursor: "pointer", pointerEvents: "all" }}
            onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
            }}
            onClick={(event) => {
                event.stopPropagation();
                onDelete();
            }}
        >
            <circle r="15" fill={theme.canvas.background} stroke={theme.node.stroke} strokeWidth="1.5" />
            <g transform="translate(-8 -8)" stroke={theme.node.text} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
                <circle cx="3" cy="12" r="2.2" />
                <circle cx="3" cy="4" r="2.2" />
                <line x1="4.8" y1="10.6" x2="13" y2="2.6" />
                <line x1="4.8" y1="5.4" x2="13" y2="13.4" />
                <line x1="8.5" y1="8" x2="13" y2="8" />
            </g>
        </g>
    );
}

function getSvgPointerPosition(event: PointerEvent<SVGElement>): Position | null {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const result = point.matrixTransform(matrix.inverse());
    return { x: result.x, y: result.y };
}

export function ActiveConnectionPath({ node, handle, mouseWorld, target }: { node?: CanvasNodeData; handle: ConnectionHandle; mouseWorld: Position; target?: CanvasNodeData }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    if (!node) return null;

    const startX = handle.handleType === "source" ? node.position.x + node.width : mouseWorld.x;
    const startY = handle.handleType === "source" ? node.position.y + node.height / 2 : mouseWorld.y;
    const endX = handle.handleType === "source" ? mouseWorld.x : node.position.x;
    const endY = handle.handleType === "source" ? mouseWorld.y : node.position.y + node.height / 2;
    const snappedStartX = handle.handleType === "target" && target ? target.position.x + target.width : startX;
    const snappedStartY = handle.handleType === "target" && target ? target.position.y + target.height / 2 : startY;
    const snappedEndX = handle.handleType === "source" && target ? target.position.x : endX;
    const snappedEndY = handle.handleType === "source" && target ? target.position.y + target.height / 2 : endY;
    const distance = Math.abs(snappedEndX - snappedStartX);
    const pathD = `M ${snappedStartX} ${snappedStartY} C ${snappedStartX + distance * 0.5} ${snappedStartY}, ${snappedEndX - distance * 0.5} ${snappedEndY}, ${snappedEndX} ${snappedEndY}`;

    return <path d={pathD} stroke={theme.node.activeStroke} strokeWidth="2" fill="none" strokeDasharray="5,5" />;
}
