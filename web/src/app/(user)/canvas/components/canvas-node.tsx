"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Bot, ChevronRight, ChevronsDownUp, ChevronsUpDown, Image as ImageIcon, Maximize2, Music2, PenLine, RefreshCw, Star, Video } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { formatBytes } from "@/lib/image-utils";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasResourceMentionTextarea } from "./canvas-resource-mention-textarea";
import { StoryboardNodeContent, SubjectBoardNodeContent } from "./canvas-creative-board-node";
import { ProjectBriefNodeContent } from "./canvas-project-brief-node";
import { VIDEO_REF_MODES } from "./canvas-node-generation";
import { CanvasNodeType, type CanvasBoardMediaEditorTarget, type CanvasNodeData, type CanvasNodeMetadata, type CanvasStoryboardReference, type CanvasTextMode, type Position } from "../types";
import type { CanvasResourceReference } from "../utils/canvas-resource-references";

type ResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
const selectionBlue = "#60a5fa";

type CanvasNodeProps = {
    data: CanvasNodeData;
    scale: number;
    isSelected: boolean;
    isRelated: boolean;
    isFocusRelated: boolean;
    isConnectionTarget: boolean;
    isConnecting: boolean;
    isRunning?: boolean;
    editRequestNonce?: number;
    showPanel: boolean;
    showImageInfo: boolean;
    upstreamImagePreviews?: { id: string; url: string; title?: string }[];
    resourceLabel?: CanvasResourceReference;
    mentionReferences?: CanvasResourceReference[];
    storyboardSubjectReferences?: CanvasStoryboardReference[];
    renderPanel?: (node: CanvasNodeData) => ReactNode;
    renderNodeContent?: (node: CanvasNodeData) => ReactNode;
    batchCount?: number;
    batchExpanded?: boolean;
    batchClosing?: boolean;
    batchOpening?: boolean;
    batchRecovering?: boolean;
    batchMotion?: { x: number; y: number; index: number };
    onMouseDown: (event: React.MouseEvent, nodeId: string) => void;
    onHoverStart: (nodeId: string) => void;
    onHoverEnd: (nodeId: string) => void;
    onConnectStart: (event: React.MouseEvent, nodeId: string, handleType: "source" | "target") => void;
    onResize: (nodeId: string, width: number, height: number, position?: Position) => void;
    onRename: (nodeId: string, title: string) => void;
    onMetadataChange: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onContentChange: (nodeId: string, content: string) => void;
    onToggleBatch?: (nodeId: string) => void;
    onSetBatchPrimary?: (node: CanvasNodeData) => void;
    onRetry?: (node: CanvasNodeData) => void;
    onGenerateImage?: (node: CanvasNodeData) => void;
    onViewImage?: (node: CanvasNodeData) => void;
    onTextModeSelect?: (node: CanvasNodeData, mode: CanvasTextMode) => void;
    onToggleTextExpanded?: (node: CanvasNodeData) => void;
    onSendNode?: (node: CanvasNodeData) => void;
    shortDramaNextLabel?: string;
    onShortDramaNext?: (node: CanvasNodeData) => void;
    onOpenBoardMediaEditor?: (target: CanvasBoardMediaEditorTarget) => void;
    onOpenFullscreen?: (node: CanvasNodeData) => void;
    onContextMenu: (event: React.MouseEvent, nodeId: string) => void;
};

type NodeContentRendererProps = {
    node: CanvasNodeData;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    isRunning: boolean;
    isEditingContent: boolean;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    isBatchRoot: boolean;
    batchCount: number;
    batchExpanded: boolean;
    batchOpening: boolean;
    batchRecovering: boolean;
    renderNodeContent?: (node: CanvasNodeData) => ReactNode;
    onContentChange: (nodeId: string, content: string) => void;
    onMetadataChange?: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onStopEditing: () => void;
    mentionReferences: CanvasResourceReference[];
    storyboardSubjectReferences: CanvasStoryboardReference[];
    onRetry?: (node: CanvasNodeData) => void;
    onGenerateImage?: (node: CanvasNodeData) => void;
    onTextModeSelect?: (node: CanvasNodeData, mode: CanvasTextMode) => void;
    onToggleTextExpanded?: (node: CanvasNodeData) => void;
    onSendNode?: (node: CanvasNodeData) => void;
    onOpenBoardMediaEditor?: (target: CanvasBoardMediaEditorTarget) => void;
    onToggleBatch?: () => void;
    onSetBatchPrimary?: () => void;
};

export const CanvasNode = React.memo(function CanvasNode({
    data,
    scale,
    isSelected,
    isRelated,
    isFocusRelated,
    isConnectionTarget,
    isConnecting,
    isRunning = false,
    editRequestNonce = 0,
    showPanel,
    showImageInfo,
    upstreamImagePreviews = [],
    resourceLabel,
    mentionReferences = [],
    storyboardSubjectReferences = [],
    renderPanel,
    renderNodeContent,
    batchCount = 0,
    batchExpanded = false,
    batchClosing = false,
    batchOpening = false,
    batchRecovering = false,
    batchMotion,
    onMouseDown,
    onHoverStart,
    onHoverEnd,
    onConnectStart,
    onResize,
    onRename,
    onMetadataChange,
    onContentChange,
    onToggleBatch,
    onSetBatchPrimary,
    onRetry,
    onGenerateImage,
    onViewImage,
    onTextModeSelect,
    onToggleTextExpanded,
    onSendNode,
    shortDramaNextLabel,
    onShortDramaNext,
    onOpenBoardMediaEditor,
    onOpenFullscreen,
    onContextMenu,
}: CanvasNodeProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [hovered, setHovered] = useState(false);
    const [isEditingContent, setIsEditingContent] = useState(false);
    const hasImageContent = data.type === CanvasNodeType.Image && Boolean(data.metadata?.content);
    const hasVideoContent = data.type === CanvasNodeType.Video && Boolean(data.metadata?.content);
    const hasAudioContent = data.type === CanvasNodeType.Audio && Boolean(data.metadata?.content);
    const isBatchRoot = data.type === CanvasNodeType.Image && Boolean(data.metadata?.isBatchRoot) && batchCount > 1;
    const isBatchChild = data.type === CanvasNodeType.Image && Boolean(data.metadata?.batchRootId);
    const isActive = isConnectionTarget || isSelected || isFocusRelated;
    const hasStoryboardPanel = data.type === CanvasNodeType.Storyboard && Boolean(data.metadata?.storyboardPanelMode && data.metadata?.storyboardPanelShotId);
    const hasSubjectPanel = data.type === CanvasNodeType.SubjectBoard && Boolean(data.metadata?.subjectPanelGroupId && data.metadata?.subjectPanelItemId);
    const canRenderExternalPanel = data.type !== CanvasNodeType.Config && data.type !== CanvasNodeType.ProjectBrief;
    const shouldRenderExternalPanel = data.type === CanvasNodeType.Storyboard ? hasStoryboardPanel : data.type === CanvasNodeType.SubjectBoard ? hasSubjectPanel : showPanel;
    const canOpenFullscreen = data.type === CanvasNodeType.Text || data.type === CanvasNodeType.ProjectBrief || data.type === CanvasNodeType.SubjectBoard || data.type === CanvasNodeType.Storyboard;
    const safeScale = Math.max(scale, 0.05);
    const imageBorderColor = isActive ? selectionBlue : isRelated && !isBatchChild ? theme.node.muted : "transparent";
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const resizeRef = useRef({
        isResizing: false,
        corner: "bottom-right" as ResizeCorner,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        startWidth: 0,
        startHeight: 0,
        keepRatio: false,
        ratio: 1,
    });

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const handleWheel = (event: WheelEvent) => event.stopPropagation();
        textarea.addEventListener("wheel", handleWheel, { passive: false });
        return () => textarea.removeEventListener("wheel", handleWheel);
    }, [data.type, isEditingContent]);

    useEffect(() => {
        if (!isEditingContent) return;
        const textarea = textareaRef.current;
        textarea?.focus();
        textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
    }, [isEditingContent]);

    useEffect(() => {
        if (!editRequestNonce || data.type !== CanvasNodeType.Text) return;
        setIsEditingContent(true);
    }, [data.type, editRequestNonce]);

    useEffect(() => {
        if (!isEditingContent) return;

        const handleOutsidePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (isEditingContent && textareaRef.current?.contains(target)) return;

            setIsEditingContent(false);
        };

        window.addEventListener("pointerdown", handleOutsidePointerDown, true);
        return () => window.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    }, [isEditingContent]);

    const handleResizeMove = useCallback(
        (event: MouseEvent) => {
            if (!resizeRef.current.isResizing) return;

            const dx = (event.clientX - resizeRef.current.startX) / scale;
            const dy = (event.clientY - resizeRef.current.startY) / scale;
            const minWidth = 220;
            const minHeight = 160;
            const startRight = resizeRef.current.startLeft + resizeRef.current.startWidth;
            const startBottom = resizeRef.current.startTop + resizeRef.current.startHeight;
            const fromLeft = resizeRef.current.corner.includes("left");
            const fromTop = resizeRef.current.corner.includes("top");
            const rawWidth = Math.max(minWidth, resizeRef.current.startWidth + (fromLeft ? -dx : dx));
            const rawHeight = Math.max(minHeight, resizeRef.current.startHeight + (fromTop ? -dy : dy));
            let width = rawWidth;
            let height = rawHeight;
            if (resizeRef.current.keepRatio) {
                const ratio = resizeRef.current.ratio;
                if (Math.abs(dx) >= Math.abs(dy)) {
                    height = width / ratio;
                } else {
                    width = height * ratio;
                }
                if (height < minHeight) {
                    height = minHeight;
                    width = height * ratio;
                }
                if (width < minWidth) {
                    width = minWidth;
                    height = width / ratio;
                }
            }

            onResize(data.id, width, height, {
                x: fromLeft ? startRight - width : resizeRef.current.startLeft,
                y: fromTop ? startBottom - height : resizeRef.current.startTop,
            });
        },
        [data.id, onResize, scale],
    );

    const handleResizeUp = useCallback(() => {
        resizeRef.current.isResizing = false;
        window.removeEventListener("mousemove", handleResizeMove);
        window.removeEventListener("mouseup", handleResizeUp);
    }, [handleResizeMove]);

    const handleResizeMouseDown = (event: React.MouseEvent, corner: ResizeCorner) => {
        event.stopPropagation();
        event.preventDefault();
        resizeRef.current = {
            isResizing: true,
            corner,
            startX: event.clientX,
            startY: event.clientY,
            startLeft: data.position.x,
            startTop: data.position.y,
            startWidth: data.width,
            startHeight: data.height,
            keepRatio: (data.type === CanvasNodeType.Image && !data.metadata?.freeResize) || data.type === CanvasNodeType.Video,
            ratio: (data.metadata?.naturalWidth || data.width) / (data.metadata?.naturalHeight || data.height || 1),
        };
        window.addEventListener("mousemove", handleResizeMove);
        window.addEventListener("mouseup", handleResizeUp);
    };

    useEffect(() => {
        return () => {
            window.removeEventListener("mousemove", handleResizeMove);
            window.removeEventListener("mouseup", handleResizeUp);
        };
    }, [handleResizeMove, handleResizeUp]);

    return (
        <div
            data-node-id={data.id}
            className={`node-element absolute flex cursor-grab select-none flex-col transition-shadow duration-200 active:cursor-grabbing [&_button]:cursor-pointer [&_input]:cursor-text [&_select]:cursor-pointer [&_textarea]:cursor-text ${isSelected ? "z-50" : "z-10"}`}
            style={{
                transform: `translate(${data.position.x}px, ${data.position.y}px)`,
                width: data.width,
                height: data.height,
                transition: "box-shadow 200ms ease",
                contain: "layout style",
            }}
            onMouseEnter={() => {
                setHovered(true);
                onHoverStart(data.id);
            }}
            onMouseLeave={() => {
                setHovered(false);
                onHoverEnd(data.id);
            }}
            onContextMenu={(event) => {
                if (isCanvasNativeInput(event.target)) {
                    event.stopPropagation();
                    return;
                }
                onContextMenu(event, data.id);
            }}
        >
            <div
                className="relative h-full w-full overflow-visible rounded-3xl border-2"
                style={{
                    background: hasImageContent || hasVideoContent ? "transparent" : theme.node.fill,
                    borderColor: hasImageContent ? imageBorderColor : isActive ? selectionBlue : isRelated ? theme.node.muted : theme.node.stroke,
                    boxShadow: isActive ? `0 0 0 1px ${selectionBlue}55` : isRelated && !isBatchChild ? `0 0 0 1px ${theme.node.muted}55, 0 18px 48px rgba(0,0,0,.14)` : undefined,
                }}
                onMouseDown={(event) => {
                    if (isCanvasNativeInput(event.target)) {
                        event.stopPropagation();
                        return;
                    }
                    onMouseDown(event, data.id);
                }}
                onDoubleClick={(event) => {
                    if (isBatchRoot) {
                        event.stopPropagation();
                        onToggleBatch?.(data.id);
                        return;
                    }
                    if (data.type === CanvasNodeType.Image && hasImageContent) {
                        event.stopPropagation();
                        onViewImage?.(data);
                        return;
                    }
                    if (data.type !== CanvasNodeType.Text) return;
                    event.stopPropagation();
                    setIsEditingContent(true);
                }}
            >
                <NodeTitleBar node={data} scale={scale} theme={theme} onRename={onRename} />
                {shortDramaNextLabel ? (
                    <button
                        type="button"
                        className="absolute z-30 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold opacity-90 backdrop-blur-md transition hover:opacity-100"
                        style={{
                            top: `${-38 / safeScale}px`,
                            right: `${16 / safeScale}px`,
                            transform: `scale(${1 / safeScale})`,
                            transformOrigin: "right top",
                            background: `${theme.toolbar.panel}dd`,
                            borderColor: theme.node.stroke,
                            color: theme.node.text,
                        }}
                        title={shortDramaNextLabel}
                        aria-label={shortDramaNextLabel}
                        onClick={(event) => {
                            event.stopPropagation();
                            onShortDramaNext?.(data);
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <span>{shortDramaNextLabel}</span>
                        <ChevronRight className="size-3.5" />
                    </button>
                ) : null}
                <div
                    className={`relative flex h-full w-full items-center justify-center rounded-[inherit] ${isBatchRoot ? "overflow-visible" : "overflow-hidden"}`}
                    style={
                        {
                            background: hasImageContent || hasVideoContent ? "transparent" : theme.node.fill,
                            "--batch-from-x": `${batchMotion?.x || 0}px`,
                            "--batch-from-y": `${batchMotion?.y || 0}px`,
                            "--batch-from-rotate": `${6 + (batchMotion?.index || 0) * 4}deg`,
                            animation: data.metadata?.batchRootId ? (batchClosing ? "canvas-batch-child-out 260ms cubic-bezier(.4,0,.2,1) both" : "canvas-batch-child-in 340ms cubic-bezier(.2,.85,.18,1) both") : undefined,
                            animationDelay: data.metadata?.batchRootId ? `${batchClosing ? 0 : 45 + (batchMotion?.index || 0) * 24}ms` : undefined,
                        } as React.CSSProperties
                    }
                >
                    <NodeContent
                        node={data}
                        theme={theme}
                        isRunning={isRunning}
                        isEditingContent={isEditingContent}
                        textareaRef={textareaRef}
                        isBatchRoot={isBatchRoot}
                        batchCount={batchCount}
                        batchExpanded={batchExpanded}
                        batchOpening={batchOpening}
                        batchRecovering={batchRecovering}
                        renderNodeContent={renderNodeContent}
                        mentionReferences={mentionReferences}
                        storyboardSubjectReferences={storyboardSubjectReferences}
                        onContentChange={onContentChange}
                        onMetadataChange={onMetadataChange}
                        onStopEditing={() => setIsEditingContent(false)}
                        onRetry={onRetry}
                        onGenerateImage={onGenerateImage}
                        onTextModeSelect={onTextModeSelect}
                        onToggleTextExpanded={onToggleTextExpanded}
                        onSendNode={onSendNode}
                        onOpenBoardMediaEditor={onOpenBoardMediaEditor}
                        onToggleBatch={() => onToggleBatch?.(data.id)}
                        onSetBatchPrimary={() => onSetBatchPrimary?.(data)}
                    />
                    {canOpenFullscreen ? (
                        <button
                            type="button"
                            className="absolute right-3 top-3 z-40 grid size-8 place-items-center rounded-full border text-xs font-medium opacity-90 backdrop-blur-md transition hover:scale-[1.03] hover:opacity-100"
                            style={{ background: `${theme.toolbar.panel}dd`, borderColor: theme.node.stroke, color: theme.node.text }}
                            title="全屏编辑"
                            aria-label="全屏编辑"
                            onClick={(event) => {
                                event.stopPropagation();
                                onOpenFullscreen?.(data);
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                        >
                            <Maximize2 className="size-3.5" />
                        </button>
                    ) : null}
                </div>

                {showImageInfo && hasImageContent ? <ImageInfoBar node={data} /> : null}
                {data.type === CanvasNodeType.Image && upstreamImagePreviews.length > 0 ? <UpstreamReferenceBadge images={upstreamImagePreviews} theme={theme} /> : null}
                {resourceLabel && data.type !== CanvasNodeType.Text ? <ResourceLabelBadge reference={resourceLabel} right={canOpenFullscreen ? 56 : 8} /> : null}

                {!hasImageContent && !hasVideoContent && !hasAudioContent ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12" style={{ background: `linear-gradient(to top, ${theme.canvas.background}66, transparent)` }} /> : null}

                <ResizeHandle corner="top-left" onMouseDown={handleResizeMouseDown} />
                <ResizeHandle corner="top-right" onMouseDown={handleResizeMouseDown} />
                <ResizeHandle corner="bottom-left" onMouseDown={handleResizeMouseDown} />
                <ResizeHandle corner="bottom-right" onMouseDown={handleResizeMouseDown} />
            </div>

            <ConnectionHandleDot side="left" visible={hovered || isSelected || isConnecting} onMouseDown={(event) => onConnectStart(event, data.id, "target")} />
            <ConnectionHandleDot side="right" visible={data.type !== CanvasNodeType.Config && (hovered || isSelected || isConnecting)} onMouseDown={(event) => onConnectStart(event, data.id, "source")} />

            {shouldRenderExternalPanel && renderPanel && canRenderExternalPanel ? <div className={`absolute left-1/2 top-full z-[70] -translate-x-1/2 pt-4 ${data.type === CanvasNodeType.Storyboard || data.type === CanvasNodeType.SubjectBoard ? "w-[560px]" : "w-[500px]"}`}>{renderPanel(data)}</div> : null}
        </div>
    );
});

function NodeTitleBar({ node, scale, theme, onRename }: { node: CanvasNodeData; scale: number; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onRename: (nodeId: string, title: string) => void }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(node.title || "");
    const safeScale = Math.max(scale, 0.05);
    const title = node.title || "未命名节点";
    const titleMeasure = editing ? draft || title : title;
    const titleWidth = Math.max(72, Math.min(320, titleMeasure.length * 12 + 28));
    const titleStyle = {
        background: `${theme.toolbar.panel}dd`,
        borderColor: theme.node.stroke,
        color: theme.node.text,
        top: `${-34 / safeScale}px`,
        width: titleWidth,
        maxWidth: "calc(100vw - 24px)",
        transform: `scale(${1 / safeScale})`,
        transformOrigin: "left top",
    };

    useEffect(() => {
        if (!editing) setDraft(node.title || "");
    }, [editing, node.title]);

    const commit = () => {
        const next = draft.trim();
        if (next) onRename(node.id, next);
        setDraft(next || node.title || "");
        setEditing(false);
    };

    const cancel = () => {
        setDraft(node.title || "");
        setEditing(false);
    };

    if (editing) {
        return (
            <input
                autoFocus
                className="absolute left-0 z-30 h-7 rounded-lg border px-2 text-xs font-semibold outline-none backdrop-blur"
                style={titleStyle}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onFocus={(event) => event.currentTarget.select()}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        commit();
                    }
                    if (event.key === "Escape") {
                        event.preventDefault();
                        cancel();
                    }
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
            />
        );
    }

    return (
        <button
            type="button"
            className="absolute left-0 z-30 inline-flex h-7 items-center rounded-lg border px-2 text-xs font-semibold backdrop-blur transition hover:opacity-100"
            style={titleStyle}
            title={node.title}
            onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setEditing(true);
            }}
        >
            <span className="truncate">{title}</span>
        </button>
    );
}

function NodeContent(props: NodeContentRendererProps) {
    if (props.node.type === CanvasNodeType.Config && props.renderNodeContent) return props.renderNodeContent(props.node);
    if (props.isBatchRoot) return <ImageNodeContent {...props} />;
    if (props.node.metadata?.status === "loading" && props.node.type !== CanvasNodeType.Agent && props.node.type !== CanvasNodeType.ScriptAgent && props.node.type !== CanvasNodeType.CharacterAgent && props.node.type !== CanvasNodeType.StoryboardAgent && props.node.type !== CanvasNodeType.Text) return <LoadingContent theme={props.theme} />;
    if (props.node.metadata?.status === "error") return <ErrorContent node={props.node} theme={props.theme} onRetry={props.onRetry} />;

    const Renderer = nodeContentRenderers[props.node.type];
    return <Renderer {...props} />;
}

const nodeContentRenderers = {
    [CanvasNodeType.Text]: TextContent,
    [CanvasNodeType.Image]: ImageNodeContent,
    [CanvasNodeType.Config]: EmptyImageContent,
    [CanvasNodeType.Video]: VideoNodeContent,
    [CanvasNodeType.Audio]: AudioNodeContent,
    [CanvasNodeType.Agent]: AgentNodeContent,
    [CanvasNodeType.ScriptAgent]: AgentNodeContent,
    [CanvasNodeType.CharacterAgent]: AgentNodeContent,
    [CanvasNodeType.StoryboardAgent]: AgentNodeContent,
    [CanvasNodeType.ProjectBrief]: ProjectBriefContent,
    [CanvasNodeType.SubjectBoard]: SubjectBoardContent,
    [CanvasNodeType.Storyboard]: StoryboardContent,
} satisfies Record<CanvasNodeType, (props: NodeContentRendererProps) => ReactNode>;

function SubjectBoardContent({ node, theme, onMetadataChange, onOpenBoardMediaEditor }: NodeContentRendererProps) {
    return <SubjectBoardNodeContent node={node} theme={theme} onMetadataChange={onMetadataChange} onOpenMediaEditor={onOpenBoardMediaEditor} />;
}

function StoryboardContent({ node, theme, onMetadataChange, onOpenBoardMediaEditor, storyboardSubjectReferences }: NodeContentRendererProps) {
    return <StoryboardNodeContent node={node} theme={theme} onMetadataChange={onMetadataChange} onOpenMediaEditor={onOpenBoardMediaEditor} subjectReferences={storyboardSubjectReferences} />;
}

function ProjectBriefContent({ node, theme, onMetadataChange, onSendNode }: NodeContentRendererProps) {
    return <ProjectBriefNodeContent node={node} theme={theme} onMetadataChange={onMetadataChange} onSend={onSendNode} />;
}

function LoadingContent({ theme }: Pick<NodeContentRendererProps, "theme">) {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3" style={{ color: theme.node.activeStroke }}>
            <div className="size-10 animate-spin rounded-full border-2" style={{ borderColor: theme.node.stroke, borderTopColor: theme.node.activeStroke }} />
            <span className="text-[10px] tracking-[0.2em]">生成中</span>
        </div>
    );
}

function ErrorContent({ node, theme, onRetry }: Pick<NodeContentRendererProps, "node" | "theme" | "onRetry">) {
    return (
        <div className="flex max-w-[260px] flex-col items-center gap-3 px-5 text-center">
            <div className="text-xs leading-5 text-red-300">{node.metadata?.errorDetails || "生成失败"}</div>
            <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition hover:scale-[1.02]"
                style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
                onClick={(event) => {
                    event.stopPropagation();
                    onRetry?.(node);
                }}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <RefreshCw className="size-3.5" />
                重试
            </button>
        </div>
    );
}

function TextContent({ node, theme, isEditingContent, textareaRef, mentionReferences, onContentChange, onStopEditing, onTextModeSelect, onToggleTextExpanded }: NodeContentRendererProps) {
    const content = node.metadata?.content || "";
    const isLoading = node.metadata?.status === "loading";
    const hasContent = Boolean(content.trim());
    const isExpanded = Boolean(node.metadata?.textExpanded);
    const textMode = node.metadata?.textMode;
    const isScriptText = node.metadata?.textRole === "script";
    const [isWritingInline, setIsWritingInline] = useState(textMode === "write" && !hasContent && !isScriptText);
    const textSurfaceStyle: React.CSSProperties = {
        fontSize: `${node.metadata?.fontSize || 14}px`,
        color: theme.node.text,
        fontWeight: node.metadata?.textBold || node.metadata?.textStyle === "h1" || node.metadata?.textStyle === "h2" ? 700 : 400,
        fontStyle: node.metadata?.textItalic ? "italic" : "normal",
        background: node.metadata?.textBackground || "transparent",
    };

    useEffect(() => {
        if (isScriptText) {
            setIsWritingInline(false);
            return;
        }
        if (textMode === "write" && !hasContent) setIsWritingInline(true);
    }, [hasContent, isScriptText, textMode]);

    return (
        <div className="flex h-full w-full flex-col overflow-hidden pt-8">
            {hasContent ? (
                <div className="absolute right-14 top-3 z-20 flex items-center gap-1">
                    <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium opacity-85 backdrop-blur-md transition hover:scale-[1.02] hover:opacity-100"
                        style={{ background: `${theme.toolbar.panel}dd`, borderColor: theme.node.stroke, color: theme.node.text }}
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleTextExpanded?.(node);
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        title={isExpanded ? "收起文本框" : "展开文本框"}
                        aria-label={isExpanded ? "收起文本框" : "展开文本框"}
                    >
                        {isExpanded ? <ChevronsDownUp className="size-3.5" /> : <ChevronsUpDown className="size-3.5" />}
                        {isExpanded ? "收起" : "展开"}
                    </button>
                </div>
            ) : null}
            {isEditingContent ? (
                <CanvasResourceMentionTextarea
                    ref={textareaRef}
                    className="thin-scrollbar m-0 block h-full w-full resize-none overflow-y-auto whitespace-pre-wrap break-words rounded-[18px] border-none bg-transparent pb-4 pl-4 pr-14 pt-0 font-mono leading-relaxed outline-none appearance-none select-text"
                    style={textSurfaceStyle}
                    value={content}
                    references={mentionReferences}
                    onChange={(value) => onContentChange(node.id, value)}
                    onBlur={onStopEditing}
                    onKeyDown={(event) => {
                        if (event.key === "Escape") onStopEditing();
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onWheel={(event) => event.stopPropagation()}
                />
            ) : (
                <>
                    {textMode === "write" && !isLoading && !isScriptText && (!hasContent || isWritingInline) ? (
                        <textarea
                            autoFocus
                            className="thin-scrollbar block h-full w-full resize-none overflow-y-auto whitespace-pre-wrap break-words rounded-[18px] border-none bg-transparent px-4 pb-4 pt-1 font-mono leading-relaxed outline-none appearance-none select-text"
                            style={textSurfaceStyle}
                            value={content}
                            placeholder="在这里输入或粘贴文本内容"
                            onChange={(event) => onContentChange(node.id, event.target.value)}
                            onBlur={() => {
                                if (content.trim()) setIsWritingInline(false);
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                            onWheel={(event) => event.stopPropagation()}
                        />
                    ) : hasContent || isLoading ? (
                        <div
                            className="thin-scrollbar block h-full w-full overflow-y-auto whitespace-pre-wrap break-words rounded-[18px] bg-transparent pb-4 pl-4 pr-20 pt-0 font-mono leading-relaxed"
                            style={textSurfaceStyle}
                            onWheel={(event) => event.stopPropagation()}
                        >
                            {content || <span style={{ color: theme.node.placeholder }}>正在等待模型输出...</span>}
                        </div>
                    ) : textMode === "write" && isScriptText && !hasContent ? (
                        <div className="pointer-events-none flex h-full w-full items-center justify-center px-6 text-center text-sm font-medium" style={{ color: theme.node.placeholder }}>
                            双击编辑剧本内容
                        </div>
                    ) : textMode === "imagePrompt" || textMode === "videoPrompt" ? (
                        <TextModeBadge mode={textMode} theme={theme} />
                    ) : (
                        <TextPlaceholder node={node} theme={theme} onSelect={onTextModeSelect} />
                    )}
                </>
            )}
        </div>
    );
}

function ResourceLabelBadge({ reference, right }: { reference: CanvasResourceReference; right: number }) {
    return (
        <span className={`pointer-events-none absolute top-3 z-30 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${reference.active ? "bg-[#2f80ff] text-white shadow-sm" : "bg-black/35 text-white/75"}`} style={{ right }}>
            {reference.label}
        </span>
    );
}

function UpstreamReferenceBadge({ images, theme }: { images: { id: string; url: string; title?: string }[]; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    const shown = images.slice(0, 3);
    return (
        <div className="pointer-events-none absolute left-2 top-2 z-30 flex items-center gap-1">
            {shown.map((image, index) => (
                <span key={image.id} className="relative block size-9 overflow-hidden rounded-md border shadow-sm" style={{ borderColor: theme.toolbar.border, background: theme.toolbar.panel }} title={image.title}>
                    <img src={image.url} alt="" className="size-full object-cover" draggable={false} />
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 text-center text-[9px] leading-3 text-white">{index + 1}</span>
                </span>
            ))}
            {images.length > shown.length ? (
                <span className="grid size-9 place-items-center rounded-md border text-[10px] font-semibold shadow-sm" style={{ borderColor: theme.toolbar.border, background: `${theme.toolbar.panel}e6`, color: theme.node.text }}>
                    +{images.length - shown.length}
                </span>
            ) : null}
        </div>
    );
}

function TextModeBadge({ mode, theme }: { mode: CanvasTextMode; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    const isImageMode = mode === "imagePrompt";
    return (
        <div className="flex h-full w-full items-center justify-center px-4 text-center" style={{ color: theme.node.placeholder }}>
            <div className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: theme.node.text }}>
                {isImageMode ? <ImageIcon className="size-4 opacity-70" /> : <Video className="size-4 opacity-70" />}
                {isImageMode ? "图片提示词反推" : "视频提示词反推"}
            </div>
        </div>
    );
}

function TextPlaceholder({ node, theme, onSelect }: { node: CanvasNodeData; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onSelect?: (node: CanvasNodeData, mode: CanvasTextMode) => void }) {
    const options: Array<{ mode: CanvasTextMode; title: string; icon: ReactNode }> = [
        { mode: "write", title: "自己编写内容", icon: <PenLine className="size-3.5" /> },
        { mode: "imagePrompt", title: "图片提示词反推", icon: <ImageIcon className="size-3.5" /> },
        { mode: "videoPrompt", title: "视频提示词反推", icon: <Video className="size-3.5" /> },
    ];
    return (
        <div className="flex h-full w-full flex-col justify-center gap-1.5 px-6 pb-4 pt-0" style={{ color: theme.node.text }}>
            {options.map((option) => (
                <button
                    key={option.mode}
                    type="button"
                    className="group flex h-9 w-full items-center gap-2.5 rounded-lg px-1 text-left transition hover:translate-x-0.5"
                    style={{ color: theme.node.text }}
                    onClick={(event) => {
                        event.stopPropagation();
                        onSelect?.(node, option.mode);
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <span className="grid size-6 shrink-0 place-items-center" style={{ color: theme.node.activeStroke }}>
                        {option.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{option.title}</span>
                    <ChevronRight className="size-3.5 shrink-0 opacity-35 transition group-hover:translate-x-0.5 group-hover:opacity-70" />
                </button>
            ))}
        </div>
    );
}

function ImageNodeContent(props: NodeContentRendererProps) {
    if (!props.node.metadata?.content && props.isBatchRoot) {
        const content =
            props.node.metadata?.status === "loading" ? (
                <LoadingContent theme={props.theme} />
            ) : props.node.metadata?.status === "error" ? (
                <ErrorContent node={props.node} theme={props.theme} onRetry={props.onRetry} />
            ) : (
                <EmptyImageContent {...props} isBatchRoot={false} />
            );
        return (
            <BatchFrame batchCount={props.batchCount} batchExpanded={props.batchExpanded} batchOpening={props.batchOpening} batchRecovering={props.batchRecovering} onToggleBatch={props.onToggleBatch}>
                {content}
            </BatchFrame>
        );
    }
    if (!props.node.metadata?.content) return <EmptyImageContent {...props} />;

    return (
        <ImageContent
            node={props.node}
            isBatchRoot={props.isBatchRoot}
            batchCount={props.batchCount}
            batchExpanded={props.batchExpanded}
            batchOpening={props.batchOpening}
            batchRecovering={props.batchRecovering}
            onToggleBatch={props.onToggleBatch}
            onSetBatchPrimary={props.onSetBatchPrimary}
        />
    );
}

function EmptyImageContent({ theme, isBatchRoot, batchCount, batchExpanded, batchOpening, batchRecovering, onToggleBatch }: NodeContentRendererProps) {
    const content = (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3" style={{ color: theme.node.placeholder }}>
            <div className="flex size-14 items-center justify-center rounded-2xl" style={{ background: theme.toolbar.activeBg }}>
                <ImageIcon className="size-6 opacity-30" />
            </div>
            <span className="text-[10px] tracking-[0.18em] opacity-50">空图片节点</span>
        </div>
    );
    if (isBatchRoot)
        return (
            <BatchFrame batchCount={batchCount} batchExpanded={batchExpanded} batchOpening={batchOpening} batchRecovering={batchRecovering} onToggleBatch={onToggleBatch}>
                {content}
            </BatchFrame>
        );
    return content;
}

function VideoNodeContent({ node, theme }: NodeContentRendererProps) {
    if (!node.metadata?.content) {
        const modeLabel = VIDEO_REF_MODES.find((item) => item.value === (node.metadata?.videoRefMode || "text"))?.label;
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2.5" style={{ color: theme.node.placeholder }}>
                <Video className="size-7 opacity-35" />
                <span className="text-sm">视频节点</span>
                {modeLabel ? <span className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: theme.node.stroke }}>{modeLabel}</span> : null}
            </div>
        );
    }
    return <video src={node.metadata.content} controls className="h-full w-full rounded-[18px] bg-black object-contain" data-canvas-no-zoom />;
}

function AudioNodeContent({ node, theme }: NodeContentRendererProps) {
    if (!node.metadata?.content)
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ color: theme.node.placeholder }}>
                <Music2 className="size-7 opacity-35" />
                <span className="text-sm">音频节点</span>
            </div>
        );
    return (
        <div className="flex h-full w-full flex-col justify-center gap-3 px-4 pt-8" style={{ background: theme.node.fill, color: theme.node.text }}>
            <div className="flex min-w-0 items-center gap-2 text-sm opacity-70">
                <Music2 className="size-4 shrink-0" />
                <span className="truncate">{node.title || "音频"}</span>
            </div>
            <audio src={node.metadata.content} controls className="w-full" data-canvas-no-zoom />
        </div>
    );
}

function AgentNodeContent({ node, theme }: NodeContentRendererProps) {
    const tasks = node.metadata?.agentTasks?.length ? node.metadata.agentTasks : defaultAgentTasks(node);
    const progress = Math.max(0, Math.min(1, node.metadata?.agentProgress ?? (node.metadata?.status === "success" ? 1 : 0)));
    const currentStep = node.metadata?.agentCurrentStep || agentStatusLabel(node);
    const resultLabel = node.metadata?.agentResultNodeId ? `已输出到 ${node.metadata.agentResultNodeId.slice(0, 8)}` : "等待输出";
    return (
        <div className="flex h-full w-full flex-col overflow-hidden px-4 pb-4 pt-11">
            <div className="mb-3 flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl" style={{ background: theme.toolbar.activeBg, color: theme.node.text }}>
                    <Bot className="size-4" />
                </span>
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold" style={{ color: theme.node.text }}>
                        {node.metadata?.agentName || node.title || "智能体"}
                    </div>
                </div>
                {node.metadata?.status === "loading" ? <span className="ml-auto size-4 shrink-0 animate-spin rounded-full border-2" style={{ borderColor: theme.node.stroke, borderTopColor: theme.node.activeStroke }} /> : null}
            </div>

            <div className="mb-3 rounded-xl border px-3 py-2" style={{ borderColor: theme.node.stroke, background: theme.toolbar.panel }}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]" style={{ color: theme.node.muted }}>
                    <span className="truncate">{currentStep}</span>
                    <span className="tabular-nums">{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: theme.node.fill }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${progress * 100}%`, background: theme.node.activeStroke }} />
                </div>
            </div>

            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto pr-1" onWheel={(event) => event.stopPropagation()}>
                <div className="space-y-1.5">
                    {tasks.map((task, index) => (
                        <div key={task.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs" style={{ background: task.status === "running" ? theme.toolbar.activeBg : "transparent", color: theme.node.text }}>
                            <span className="grid size-5 shrink-0 place-items-center rounded-full text-[10px]" style={{ background: agentTaskColor(task.status, theme), color: theme.node.text }}>
                                {task.status === "success" ? "✓" : task.status === "error" ? "!" : index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{task.title}</span>
                            <span className="shrink-0 text-[10px]" style={{ color: theme.node.muted }}>
                                {agentTaskStatusText(task.status)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-2 truncate rounded-lg border px-2 py-1.5 text-[11px]" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                {node.metadata?.status === "error" ? node.metadata?.errorDetails || "执行失败" : resultLabel}
            </div>
        </div>
    );
}

function defaultAgentTasks(node: CanvasNodeData) {
    const generateTitle = node.type === CanvasNodeType.CharacterAgent ? "生成角色/场景/道具" : node.type === CanvasNodeType.StoryboardAgent ? "生成分镜镜头" : node.type === CanvasNodeType.ScriptAgent ? "生成剧本内容" : "执行智能体任务";
    const writeTitle = node.type === CanvasNodeType.CharacterAgent ? "写入角色板" : node.type === CanvasNodeType.StoryboardAgent ? "写入分镜板" : "写入结果节点";
    return [
        { id: "read-input", title: "读取上游输入", status: node.metadata?.status === "idle" ? "idle" : "success" },
        { id: "generate", title: generateTitle, status: node.metadata?.status === "loading" ? "running" : node.metadata?.status === "success" ? "success" : "idle" },
        { id: "write-output", title: writeTitle, status: node.metadata?.status === "success" ? "success" : "idle" },
    ] satisfies NonNullable<CanvasNodeMetadata["agentTasks"]>;
}

function agentStatusLabel(node: CanvasNodeData) {
    if (node.metadata?.status === "loading") return "执行中";
    if (node.metadata?.status === "success") return "已完成";
    if (node.metadata?.status === "error") return "执行失败";
    return "等待执行";
}

function agentTaskStatusText(status: NonNullable<CanvasNodeMetadata["agentTasks"]>[number]["status"]) {
    if (status === "running") return "执行中";
    if (status === "success") return "完成";
    if (status === "error") return "失败";
    return "等待";
}

function agentTaskColor(status: NonNullable<CanvasNodeMetadata["agentTasks"]>[number]["status"], theme: (typeof canvasThemes)[keyof typeof canvasThemes]) {
    if (status === "running") return theme.node.activeStroke;
    if (status === "success") return "rgba(34,197,94,.32)";
    if (status === "error") return "rgba(239,68,68,.35)";
    return theme.node.fill;
}

function ImageContent({
    node,
    isBatchRoot,
    batchCount,
    batchExpanded,
    batchOpening,
    batchRecovering,
    onToggleBatch,
    onSetBatchPrimary,
}: {
    node: CanvasNodeData;
    isBatchRoot: boolean;
    batchCount: number;
    batchExpanded: boolean;
    batchOpening: boolean;
    batchRecovering: boolean;
    onToggleBatch?: () => void;
    onSetBatchPrimary?: () => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const isBatchChild = Boolean(node.metadata?.batchRootId);

    return (
        <BatchFrame batchCount={isBatchRoot ? batchCount : 0} batchExpanded={batchExpanded} batchOpening={batchOpening} batchRecovering={batchRecovering} onToggleBatch={onToggleBatch}>
            <div className="h-full w-full overflow-hidden rounded-3xl">
                <img
                    src={node.metadata!.content!}
                    alt={node.title}
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    className={`pointer-events-none block h-full w-full select-none ${node.metadata?.freeResize ? "object-fill" : "object-contain"}`}
                />
            </div>
            {isBatchRoot ? (
                <button
                    type="button"
                    className="absolute right-2.5 top-2.5 z-30 flex h-8 items-center justify-center gap-1 rounded-full border px-2.5 text-xs font-semibold shadow-[0_6px_18px_rgba(15,23,42,.10)] backdrop-blur-md transition hover:scale-[1.02]"
                    style={{ background: `${theme.toolbar.panel}d9`, borderColor: `${theme.toolbar.border}cc`, color: theme.node.text }}
                    aria-label={batchExpanded ? "图片组已展开" : "图片组已收起"}
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggleBatch?.();
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <span className="leading-none text-[#2f80ff]">{batchCount}</span>
                    <ChevronRight className={`size-3.5 opacity-55 transition-transform ${batchExpanded ? "rotate-90" : ""}`} />
                </button>
            ) : null}
            {isBatchChild ? (
                <button
                    type="button"
                    className="absolute right-3 top-3 z-30 flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium opacity-0 shadow-[0_8px_20px_rgba(68,64,60,.13)] backdrop-blur-md transition group-hover/batch:opacity-100 hover:scale-[1.02]"
                    style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
                    onClick={(event) => {
                        event.stopPropagation();
                        onSetBatchPrimary?.();
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <Star className="size-3.5 text-[#2f80ff]" />
                    设为主图
                </button>
            ) : null}
        </BatchFrame>
    );
}

function ImageInfoBar({ node }: { node: CanvasNodeData }) {
    const width = Math.round(node.metadata?.naturalWidth || node.width);
    const height = Math.round(node.metadata?.naturalHeight || node.height);
    const size = formatBytes(node.metadata?.bytes || 0);
    return (
        <div className="pointer-events-none absolute bottom-3 right-3 z-40 max-w-[calc(100%-24px)]">
            <span className="max-w-full truncate rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium leading-none text-white backdrop-blur-sm">
                {width} x {height}
                {size ? ` · ${size}` : ""}
            </span>
        </div>
    );
}

function BatchFrame({ batchCount, batchExpanded, batchOpening, batchRecovering, onToggleBatch, children }: { batchCount: number; batchExpanded: boolean; batchOpening: boolean; batchRecovering: boolean; onToggleBatch?: () => void; children: ReactNode }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const isBatchRoot = batchCount > 1;
    return (
        <div
            className="group/batch relative h-full w-full overflow-visible"
            onDoubleClick={
                isBatchRoot
                    ? (event) => {
                          event.stopPropagation();
                          onToggleBatch?.();
                      }
                    : undefined
            }
        >
            {isBatchRoot ? (
                <div className="pointer-events-none absolute inset-0 overflow-visible">
                    {Array.from({ length: Math.min(batchCount - 1, 5) }).map((_, index) => (
                        <div
                            key={index}
                            className="absolute rounded-[inherit] border shadow-[0_14px_34px_rgba(68,64,60,.16)] transition-all duration-300 group-hover/batch:translate-x-2"
                            style={{
                                inset: 0,
                                background: `linear-gradient(135deg, ${theme.node.panel}, ${theme.node.fill})`,
                                borderColor: theme.node.stroke,
                                opacity: batchExpanded && !batchOpening ? 0.34 : 1,
                                transform:
                                    batchOpening || batchRecovering ? `translate(${54 + index * 22}px, ${20 + index * 12}px) rotate(${8 + index * 5}deg) scale(.98)` : `translate(${34 + index * 18}px, ${14 + index * 10}px) rotate(${6 + index * 4}deg)`,
                                zIndex: -index - 1,
                            }}
                        />
                    ))}
                </div>
            ) : null}
            {children}
        </div>
    );
}
function ResizeHandle({ corner, onMouseDown }: { corner: ResizeCorner; onMouseDown: (event: React.MouseEvent, corner: ResizeCorner) => void }) {
    const positionClass = {
        "top-left": "-left-[14px] -top-[14px] cursor-nwse-resize",
        "top-right": "-right-[14px] -top-[14px] cursor-nesw-resize",
        "bottom-left": "-bottom-[14px] -left-[14px] cursor-nesw-resize",
        "bottom-right": "-bottom-[14px] -right-[14px] cursor-nwse-resize",
    }[corner];

    return <div className={`absolute z-50 size-7 ${positionClass}`} onMouseDown={(event) => onMouseDown(event, corner)} />;
}

function ConnectionHandleDot({ side, visible, onMouseDown }: { side: "left" | "right"; visible: boolean; onMouseDown: (event: React.MouseEvent) => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <div
            className={`absolute top-1/2 z-30 flex size-12 -translate-y-1/2 cursor-crosshair items-center justify-center transition-opacity duration-150 ${
                side === "left" ? "-left-6" : "-right-6"
            } ${visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
            onMouseDown={onMouseDown}
        >
            <div className="size-3 rounded-full border-2 transition-all hover:scale-125" style={{ background: theme.node.panel, borderColor: theme.node.muted }} />
        </div>
    );
}

function isCanvasNativeInput(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("input,textarea,select,[contenteditable='true']"));
}
