"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, Circle, Download, Grid2x2, List, Menu, Play, Ungroup } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasArrangeMode, CanvasGroup } from "../types";

type CanvasGroupBounds = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type GroupResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const groupPadding = 34;
const toolbarHeight = 48;
const groupColors = ["#a3a3a3", "#ef4444", "#f59e0b", "#facc15", "#22c55e", "#2dd4bf", "#0ea5e9", "#6366f1", "#ec4899"];

export function CanvasGroupFrame({
    group,
    bounds,
    nodeCount,
    scale,
    selected,
    onSelect,
    onDragStart,
    onRename,
    onColorChange,
    onArrange,
    onRun,
    onBatchDownload,
    onUngroup,
    onResizeStart,
}: {
    group: CanvasGroup;
    bounds: CanvasGroupBounds;
    nodeCount: number;
    scale: number;
    selected: boolean;
    onSelect: () => void;
    onDragStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onRename: (title: string) => void;
    onColorChange: (color: string) => void;
    onArrange: (mode: CanvasArrangeMode) => void;
    onRun: () => void;
    onBatchDownload: () => void;
    onUngroup: () => void;
    onResizeStart: (event: ReactPointerEvent<HTMLElement>, corner: GroupResizeCorner) => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(group.title);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [arrangeOpen, setArrangeOpen] = useState(false);
    const color = group.color || groupColors[0];
    const toolbarScale = 1 / Math.max(scale, 0.05);
    const toolbarWorldHeight = toolbarHeight * toolbarScale;
    const outerTop = bounds.top - (selected ? toolbarWorldHeight + groupPadding + 18 : groupPadding + 22);
    const frameTop = selected ? toolbarWorldHeight + 18 : 22;
    const frameWidth = bounds.width + groupPadding * 2;
    const frameHeight = bounds.height + groupPadding * 2;

    useEffect(() => {
        if (!editing) setDraft(group.title);
    }, [editing, group.title]);

    const commit = () => {
        const title = draft.trim();
        if (title && title !== group.title) onRename(title);
        setEditing(false);
    };

    return (
        <div
            className="pointer-events-none absolute z-[2]"
            style={{
                left: bounds.left - groupPadding,
                top: outerTop,
                width: frameWidth,
                height: frameTop + frameHeight,
            }}
        >
            {selected ? (
                <GroupToolbar
                    color={color}
                    paletteOpen={paletteOpen}
                    arrangeOpen={arrangeOpen}
                    onPaletteOpenChange={setPaletteOpen}
                    onArrangeOpenChange={setArrangeOpen}
                    onColorChange={onColorChange}
                    onArrange={onArrange}
                    onRun={onRun}
                    onBatchDownload={onBatchDownload}
                    onUngroup={onUngroup}
                    scale={toolbarScale}
                />
            ) : null}

            <div
                className="pointer-events-auto absolute left-0 rounded-sm border"
                style={{
                    top: frameTop,
                    width: frameWidth,
                    height: frameHeight,
                    borderColor: selected ? color : colorToRgba(color, 0.62),
                    borderStyle: selected ? "solid" : "dashed",
                    background: colorToRgba(color, selected ? 0.12 : 0.08),
                    boxShadow: selected ? `0 0 0 1px ${colorToRgba(color, 0.22)}` : undefined,
                    cursor: "move",
                }}
                onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelect();
                    if ((event.target as HTMLElement).closest("[data-group-control]")) return;
                    onDragStart(event);
                }}
            >
                {selected ? <GroupHandles color={color} onResizeStart={onResizeStart} /> : null}
            </div>

            <div
                className="pointer-events-auto absolute left-0 flex h-6 max-w-[calc(100%-16px)] cursor-grab items-center gap-1 text-xs font-medium active:cursor-grabbing"
                style={{ top: frameTop - 25, color: theme.node.muted }}
                onPointerDown={(event) => {
                    if (editing) return;
                    onSelect();
                    onDragStart(event);
                }}
                onDoubleClick={(event) => {
                    event.stopPropagation();
                    setEditing(true);
                }}
            >
                {editing ? (
                    <input
                        autoFocus
                        className="h-6 min-w-28 rounded border bg-transparent px-1 text-xs outline-none"
                        style={{ borderColor: theme.node.stroke, color: theme.node.text, background: theme.toolbar.panel }}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onBlur={commit}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") commit();
                            if (event.key === "Escape") setEditing(false);
                        }}
                    />
                ) : (
                    <span className="truncate">{group.title || "分组"} {nodeCount} 个节点</span>
                )}
            </div>
        </div>
    );
}

function GroupToolbar({
    color,
    paletteOpen,
    arrangeOpen,
    onPaletteOpenChange,
    onArrangeOpenChange,
    onColorChange,
    onArrange,
    onRun,
    onBatchDownload,
    onUngroup,
    scale,
}: {
    color: string;
    paletteOpen: boolean;
    arrangeOpen: boolean;
    onPaletteOpenChange: (open: boolean) => void;
    onArrangeOpenChange: (open: boolean) => void;
    onColorChange: (color: string) => void;
    onArrange: (mode: CanvasArrangeMode) => void;
    onRun: () => void;
    onBatchDownload: () => void;
    onUngroup: () => void;
    scale: number;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    return (
        <div
            className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2"
        >
            <div
                data-canvas-no-zoom
                data-group-control
                className="pointer-events-auto flex items-center gap-1 rounded-xl border px-2 py-2 shadow-xl backdrop-blur"
                style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.toolbar.item, transform: `scale(${scale})`, transformOrigin: "top center" }}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <div className="relative">
                    <ToolbarButton title="分组颜色" onClick={() => onPaletteOpenChange(!paletteOpen)}>
                        <span className="grid size-6 place-items-center rounded-full border" style={{ borderColor: theme.toolbar.border, background: color }}>
                            <Circle className="size-3.5" style={{ color: theme.toolbar.panel }} />
                        </span>
                    </ToolbarButton>
                    {paletteOpen ? (
                        <div className="absolute bottom-10 left-0 z-30 grid w-[256px] grid-cols-5 gap-3 rounded-xl border p-3 shadow-xl backdrop-blur" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}>
                            {groupColors.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    className="size-7 rounded-full border transition hover:scale-105"
                                    style={{ background: item, borderColor: item === color ? theme.node.activeStroke : "transparent", boxShadow: item === color ? `0 0 0 2px ${theme.node.activeStroke}` : undefined }}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onColorChange(item);
                                        onPaletteOpenChange(false);
                                    }}
                                    aria-label="选择分组颜色"
                                />
                            ))}
                        </div>
                    ) : null}
                </div>

                <div className="relative">
                    <ToolbarButton title="排列" onClick={() => onArrangeOpenChange(!arrangeOpen)}>
                        <Grid2x2 className="size-4" />
                    </ToolbarButton>
                    {arrangeOpen ? (
                        <div className="absolute bottom-10 left-0 z-30 w-32 rounded-xl border p-1.5 shadow-xl backdrop-blur" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}>
                            <MenuItem icon={<Grid2x2 className="size-4" />} label="宫格排列" onClick={() => onArrange("grid")} />
                            <MenuItem icon={<Menu className="size-4" />} label="水平排列" onClick={() => onArrange("horizontal")} />
                            <MenuItem icon={<List className="size-4" />} label="垂直排列" onClick={() => onArrange("vertical")} />
                        </div>
                    ) : null}
                </div>

                <Divider />
                <ToolbarButton label="整组执行" onClick={onRun}>
                    <Play className="size-4" />
                </ToolbarButton>
                <ToolbarButton label="解组" onClick={onUngroup}>
                    <Ungroup className="size-4" />
                </ToolbarButton>
                <ToolbarButton label="批量下载" onClick={onBatchDownload}>
                    <Download className="size-4" />
                </ToolbarButton>
            </div>
        </div>
    );
}

const groupResizeHandles: { corner: GroupResizeCorner; className: string; cursor: string }[] = [
    { corner: "top-left", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
    { corner: "top-right", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
    { corner: "bottom-left", className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
    { corner: "bottom-right", className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
];

function GroupHandles({ color, onResizeStart }: { color: string; onResizeStart: (event: ReactPointerEvent<HTMLElement>, corner: GroupResizeCorner) => void }) {
    return (
        <>
            {groupResizeHandles.map((handle) => (
                <span
                    key={handle.corner}
                    data-group-control
                    className={`absolute size-3 rounded-sm border ${handle.className}`}
                    style={{ background: color, borderColor: colorToRgba(color, 0.85), cursor: handle.cursor }}
                    onPointerDown={(event) => onResizeStart(event, handle.corner)}
                />
            ))}
        </>
    );
}

function ToolbarButton({ children, label, title, onClick }: { children: ReactNode; label?: string; title?: string; onClick: () => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    return (
        <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition hover:scale-[1.02]"
            style={{ color: theme.toolbar.item }}
            title={title || label}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
        >
            {children}
            {label ? <span className="whitespace-nowrap">{label}</span> : null}
            {title === "排列" ? <ChevronDown className="size-3" /> : null}
        </button>
    );
}

function MenuItem({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    return (
        <button
            type="button"
            className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-medium transition hover:scale-[1.01]"
            style={{ color: theme.toolbar.item }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
        >
            {icon}
            {label}
        </button>
    );
}

function Divider() {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    return <span className="mx-1 h-6 w-px" style={{ background: theme.toolbar.border }} />;
}

function colorToRgba(color: string, alpha: number) {
    if (!color.startsWith("#") || color.length !== 7) return `rgba(163,163,163,${alpha})`;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
