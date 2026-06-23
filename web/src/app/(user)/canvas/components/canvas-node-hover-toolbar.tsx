"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { App, Modal, Segmented, Tooltip } from "antd";
import { Bold, ChevronsDownUp, ChevronsUpDown, Copy, Download, Ellipsis, FolderPlus, Heading1, Heading2, Heading3, Image as ImageIcon, Info, Italic, List, ListOrdered, MessageSquare, Minus, Music2, Palette, Pencil, Pilcrow, Plus, RefreshCw, Settings2, Trash2, Upload, Video } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { formatBytes, getDataUrlByteSize } from "@/lib/image-utils";
import { useCopyText } from "@/hooks/use-copy-text";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData, type CanvasNodeMetadata, type ViewportTransform } from "../types";
import { ImageToolSettingsModal, type ImageToolbarSettingsTool } from "./canvas-image-toolbar-settings-modal";
import { IMAGE_QUICK_TOOLS_STORAGE_KEY, buildImageToolbarTools, defaultImageQuickToolIds, readImageQuickToolsConfig, type ImageQuickToolId } from "./canvas-image-toolbar-tools";

type CanvasNodeHoverToolbarProps = {
    node: CanvasNodeData | null;
    viewport: ViewportTransform;
    onKeep: (nodeId: string) => void;
    onLeave: () => void;
    onInfo: (node: CanvasNodeData) => void;
    onEditText: (node: CanvasNodeData) => void;
    onDecreaseFont: (node: CanvasNodeData) => void;
    onIncreaseFont: (node: CanvasNodeData) => void;
    onMetadataChange: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onContentChange: (nodeId: string, content: string) => void;
    onToggleTextExpanded: (node: CanvasNodeData) => void;
    onToggleDialog: (node: CanvasNodeData) => void;
    onGenerateImage: (node: CanvasNodeData) => void;
    onUpload: (node: CanvasNodeData) => void;
    onDownload: (node: CanvasNodeData) => void;
    onSaveAsset: (node: CanvasNodeData) => void;
    onMaskEdit: (node: CanvasNodeData) => void;
    onCrop: (node: CanvasNodeData) => void;
    onUpscale: (node: CanvasNodeData) => void;
    onSuperResolve: (node: CanvasNodeData) => void;
    onAngle: (node: CanvasNodeData) => void;
    onViewImage: (node: CanvasNodeData) => void;
    onReversePrompt: (node: CanvasNodeData) => void;
    onRetry: (node: CanvasNodeData) => void;
    onToggleFreeResize: (node: CanvasNodeData) => void;
    onDelete: (node: CanvasNodeData) => void;
};

type ToolbarTool = {
    id: string;
    title: string;
    label: string;
    icon: ReactNode;
    onClick: () => void;
    active?: boolean;
    danger?: boolean;
};

export function CanvasNodeHoverToolbar({
    node,
    viewport,
    onKeep,
    onLeave,
    onInfo,
    onEditText,
    onDecreaseFont,
    onIncreaseFont,
    onMetadataChange,
    onContentChange,
    onToggleTextExpanded,
    onToggleDialog,
    onGenerateImage,
    onUpload,
    onDownload,
    onSaveAsset,
    onMaskEdit,
    onCrop,
    onUpscale,
    onSuperResolve,
    onAngle,
    onViewImage,
    onReversePrompt,
    onRetry,
    onToggleFreeResize,
    onDelete,
}: CanvasNodeHoverToolbarProps) {
    const [quickImageToolIds, setQuickImageToolIds] = useState<ImageQuickToolId[]>(defaultImageQuickToolIds);
    const [showImageToolLabels, setShowImageToolLabels] = useState(true);
    const [draftImageToolIds, setDraftImageToolIds] = useState<ImageQuickToolId[]>(defaultImageQuickToolIds);
    const [draftShowImageToolLabels, setDraftShowImageToolLabels] = useState(true);
    const [imageToolSettingsOpen, setImageToolSettingsOpen] = useState(false);
    const { message } = App.useApp();
    const copyText = useCopyText();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(IMAGE_QUICK_TOOLS_STORAGE_KEY);
            if (!stored) return;
            const parsed = JSON.parse(stored) as unknown;
            const config = readImageQuickToolsConfig(parsed);
            setQuickImageToolIds(config.ids);
            setShowImageToolLabels(config.showLabels);
        } catch {
            window.localStorage.removeItem(IMAGE_QUICK_TOOLS_STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        setImageToolSettingsOpen(false);
    }, [node?.id]);

    if (!node) return null;

    const isImage = node.type === CanvasNodeType.Image;
    const isVideo = node.type === CanvasNodeType.Video;
    const isAudio = node.type === CanvasNodeType.Audio;
    const hasImage = isImage && Boolean(node.metadata?.content);
    const hasVideo = isVideo && Boolean(node.metadata?.content);
    const hasAudio = isAudio && Boolean(node.metadata?.content);
    const isText = node.type === CanvasNodeType.Text;
    const isAgent = node.type === CanvasNodeType.Agent || node.type === CanvasNodeType.ScriptAgent || node.type === CanvasNodeType.CharacterAgent || node.type === CanvasNodeType.StoryboardAgent;
    const isConfig = node.type === CanvasNodeType.Config;
    const hasTextEditToolbar = isText && (node.metadata?.content?.trim() || node.metadata?.status === "loading");
    const left = viewport.x + (node.position.x + node.width / 2) * viewport.k;
    const top = viewport.y + node.position.y * viewport.k - (hasTextEditToolbar ? 128 : 56);
    const textToolbarTop = viewport.y + node.position.y * viewport.k - 56;
    const canOpenDialog = isText || isAgent || hasImage || isVideo;
    const canRetry = node.metadata?.status === "error";
    const quickImageToolIdSet = new Set(quickImageToolIds);
    const copyImagePrompt = (target: CanvasNodeData) => {
        const prompt = target.metadata?.prompt?.trim();
        if (!prompt) {
            message.warning("暂无可复制的提示词");
            return;
        }
        copyText(prompt, "提示词已复制");
    };
    const imageTools = buildImageToolbarTools(node, { onUpload, onToggleFreeResize, onMaskEdit, onCrop, onUpscale, onSuperResolve, onAngle, onViewImage, onCopyPrompt: copyImagePrompt, onReversePrompt });

    function openImageToolSettings() {
        onKeep(node.id);
        setDraftImageToolIds(quickImageToolIds);
        setDraftShowImageToolLabels(showImageToolLabels);
        setImageToolSettingsOpen(true);
    }

    const baseToolbarTools: ToolbarTool[] = [
        { id: "info", title: "查看节点信息", label: "信息", icon: <Info className="size-4" />, onClick: () => onInfo(node) },
        { id: "delete", title: "移除节点", label: "删除", icon: <Trash2 className="size-4" />, onClick: () => onDelete(node), danger: true },
    ];
    const nodeToolbarTools: ToolbarTool[] = [
        ...(canRetry ? [{ id: "retry", title: "重新生成", label: "重试", icon: <RefreshCw className="size-4" />, onClick: () => onRetry(node) }] : []),
        ...(hasImage || hasVideo || isText || isAgent ? [{ id: "saveAsset", title: "加入我的素材", label: "存素材", icon: <FolderPlus className="size-4" />, onClick: () => onSaveAsset(node) }] : []),
        ...(hasImage || hasVideo || hasAudio ? [{ id: "download", title: hasAudio ? "下载音频" : hasVideo ? "下载视频" : "下载图片", label: "下载", icon: <Download className="size-4" />, onClick: () => onDownload(node) }] : []),
        ...(canOpenDialog ? [{ id: "edit", title: "编辑", label: "编辑", icon: <MessageSquare className="size-4" />, onClick: () => onToggleDialog(node) }] : []),
        ...(isText ? [{ id: "editText", title: "编辑文本", label: "编辑文字", icon: <Pencil className="size-4" />, onClick: () => onEditText(node) }] : []),
        ...(isText ? [{ id: "generateImage", title: "用文本生图", label: "生图", icon: <ImageIcon className="size-4" />, onClick: () => onGenerateImage(node) }] : []),
        ...(isConfig ? [{ id: "config", title: "生成配置", label: "生成配置", icon: <Settings2 className="size-4" />, onClick: () => onToggleDialog(node) }] : []),
        ...(isText ? [{ id: "decreaseFont", title: "减小字号", label: "缩小", icon: <Minus className="size-4" />, onClick: () => onDecreaseFont(node) }] : []),
        ...(isText ? [{ id: "increaseFont", title: "增大字号", label: "放大", icon: <Plus className="size-4" />, onClick: () => onIncreaseFont(node) }] : []),
        ...(isImage && !hasImage ? [{ id: "uploadImage", title: "上传图片", label: "上传图片", icon: <Upload className="size-4" />, onClick: () => onUpload(node) }] : []),
        ...(isVideo ? [{ id: "uploadVideo", title: hasVideo ? "替换视频" : "上传视频", label: hasVideo ? "替换视频" : "上传视频", icon: <Video className="size-4" />, onClick: () => onUpload(node) }] : []),
        ...(isAudio ? [{ id: "uploadAudio", title: hasAudio ? "替换音频" : "上传音频", label: hasAudio ? "替换音频" : "上传音频", icon: <Music2 className="size-4" />, onClick: () => onUpload(node) }] : []),
        ...(hasImage ? imageTools.map((tool) => ({ id: tool.id, title: tool.title, label: tool.label, icon: tool.icon, active: tool.active, onClick: tool.onClick })) : []),
    ];
    const toolbarTools = hasImage ? [...baseToolbarTools, ...nodeToolbarTools].filter((tool) => quickImageToolIdSet.has(tool.id as ImageQuickToolId)) : [...baseToolbarTools, ...nodeToolbarTools];
    const selectableImageToolbarTools = [...baseToolbarTools, ...nodeToolbarTools].filter((tool) => tool.id !== "retry") as ImageToolbarSettingsTool[];

    const closeImageToolSettings = () => {
        setImageToolSettingsOpen(false);
        onLeave();
    };

    const setDraftImageToolVisible = (id: ImageQuickToolId, visible: boolean) => {
        setDraftImageToolIds((current) => {
            const selected = new Set(current);
            if (visible) selected.add(id);
            else selected.delete(id);
            return selectableImageToolbarTools.filter((tool) => selected.has(tool.id)).map((tool) => tool.id);
        });
    };

    const saveImageToolSettings = () => {
        const config = { ids: draftImageToolIds, showLabels: draftShowImageToolLabels };
        setQuickImageToolIds(config.ids);
        setShowImageToolLabels(config.showLabels);
        window.localStorage.setItem(IMAGE_QUICK_TOOLS_STORAGE_KEY, JSON.stringify(config));
        closeImageToolSettings();
    };

    return (
        <>
            <div
                className="absolute z-[70] flex -translate-x-1/2 -translate-y-full items-center gap-1 overflow-visible rounded-xl border px-2 py-2 text-xs font-medium shadow-xl backdrop-blur"
                style={{ left, top, background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.toolbar.item }}
                onMouseEnter={() => onKeep(node.id)}
                onMouseLeave={() => {
                    if (!imageToolSettingsOpen) onLeave();
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
            >
                {toolbarTools.map((tool) => (
                    <ToolbarAction key={tool.id} {...tool} showLabel={showImageToolLabels} theme={theme} />
                ))}
                {hasImage ? <ToolbarAction id="more" title="配置快捷工具" label="更多" icon={<Ellipsis className="size-4" />} active={imageToolSettingsOpen} onClick={openImageToolSettings} showLabel={showImageToolLabels} theme={theme} /> : null}
            </div>
            {hasImage ? (
                <ImageToolSettingsModal
                    open={imageToolSettingsOpen}
                    tools={selectableImageToolbarTools}
                    selectedIds={draftImageToolIds}
                    showLabels={draftShowImageToolLabels}
                    onToggle={setDraftImageToolVisible}
                    onShowLabelsChange={setDraftShowImageToolLabels}
                    onCancel={closeImageToolSettings}
                    onSave={saveImageToolSettings}
                />
            ) : null}
            {hasTextEditToolbar ? (
                <TextEditToolbar
                    node={node}
                    left={left}
                    top={textToolbarTop}
                    onKeep={onKeep}
                    onLeave={onLeave}
                    onMetadataChange={onMetadataChange}
                    onContentChange={onContentChange}
                    onToggleTextExpanded={onToggleTextExpanded}
                />
            ) : null}
        </>
    );
}

export function CanvasNodeInfoModal({ node, open, onClose }: { node: CanvasNodeData | null; open: boolean; onClose: () => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [view, setView] = useState<"info" | "json">("info");
    const imageBytes = node?.type === CanvasNodeType.Image && node.metadata?.content ? getDataUrlByteSize(node.metadata.content) : 0;
    const batchCount = node?.type === CanvasNodeType.Image ? node.metadata?.batchChildIds?.length || 0 : 0;
    const json = useMemo(() => {
        if (!node) return "";
        return JSON.stringify(
            node,
            (key, value) => {
                if (key === "title") return undefined;
                if (key === "content" && typeof value === "string" && value.startsWith("data:image/")) {
                    return "[base64 image]";
                }
                return value;
            },
            2,
        );
    }, [node]);

    useEffect(() => {
        if (open) setView("info");
    }, [node?.id, open]);

    const title = (
        <div className="flex items-center justify-between gap-4 pr-12">
            <span>节点信息</span>
            <Segmented
                size="small"
                value={view}
                onChange={(value) => setView(value as "info" | "json")}
                options={[
                    { label: "信息", value: "info" },
                    { label: "JSON", value: "json" },
                ]}
            />
        </div>
    );

    return (
        <Modal className="canvas-node-info-modal" title={title} open={open && Boolean(node)} centered footer={null} onCancel={onClose}>
            {node ? (
                <div className="h-[56vh] min-h-[360px] text-sm">
                    {view === "info" ? (
                        <div className="thin-scrollbar h-full space-y-3 overflow-auto pr-1">
                            <InfoRow label="ID" value={node.id} />
                            <InfoRow label="类型" value={nodeTypeLabel(node.type)} />
                            <InfoRow label="尺寸" value={`${Math.round(node.width)} x ${Math.round(node.height)}`} />
                            <InfoRow label="位置" value={`${Math.round(node.position.x)}, ${Math.round(node.position.y)}`} />
                            <InfoRow label="状态" value={node.metadata?.status || "idle"} />
                            {batchCount > 1 ? <InfoRow label="图片组" value={`${batchCount} 张`} /> : null}
                            {node.metadata?.prompt ? <InfoRow label="提示词" value={node.metadata.prompt} /> : null}
                            {imageBytes ? <InfoRow label="图片大小" value={formatBytes(imageBytes)} /> : null}
                            {node.metadata?.errorDetails ? (
                                <div className="rounded-lg border p-3 text-red-400" style={{ borderColor: theme.node.stroke }}>
                                    {node.metadata.errorDetails}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <pre className="thin-scrollbar h-full overflow-auto rounded-lg border p-3 text-xs leading-5" style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}>
                            {json}
                        </pre>
                    )}
                </div>
            ) : null}
        </Modal>
    );
}

function TextEditToolbar({
    node,
    left,
    top,
    onKeep,
    onLeave,
    onMetadataChange,
    onContentChange,
    onToggleTextExpanded,
}: {
    node: CanvasNodeData;
    left: number;
    top: number;
    onKeep: (nodeId: string) => void;
    onLeave: () => void;
    onMetadataChange: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onContentChange: (nodeId: string, content: string) => void;
    onToggleTextExpanded: (node: CanvasNodeData) => void;
}) {
    const content = node.metadata?.content || "";
    const textStyle = node.metadata?.textStyle || "body";
    const setTextStyle = (style: NonNullable<CanvasNodeMetadata["textStyle"]>, fontSize: number) => onMetadataChange(node.id, { textStyle: style, fontSize });
    const appendText = (value: string) => {
        const prefix = content && !content.endsWith("\n") ? "\n" : "";
        onContentChange(node.id, `${content}${prefix}${value}`);
    };

    return (
        <div
            className="absolute z-[75] flex h-16 -translate-x-1/2 -translate-y-full items-center overflow-visible rounded-[22px] border border-white/10 bg-[#181818] px-3 text-[#d7d7d7] shadow-[0_16px_42px_rgba(0,0,0,.35)]"
            style={{ left, top }}
            onMouseEnter={() => onKeep(node.id)}
            onMouseLeave={onLeave}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            <TextToolButton title="背景色" active={Boolean(node.metadata?.textBackground)} onClick={() => onMetadataChange(node.id, { textBackground: node.metadata?.textBackground ? "" : "rgba(255,255,255,0.08)" })}>
                <Palette className="size-5" />
            </TextToolButton>
            <DarkDivider />
            <TextToolButton title="标题 1" active={textStyle === "h1"} onClick={() => setTextStyle("h1", 26)}>
                <Heading1 className="size-5" />
            </TextToolButton>
            <TextToolButton title="标题 2" active={textStyle === "h2"} onClick={() => setTextStyle("h2", 22)}>
                <Heading2 className="size-5" />
            </TextToolButton>
            <TextToolButton title="标题 3" active={textStyle === "h3"} onClick={() => setTextStyle("h3", 18)}>
                <Heading3 className="size-5" />
            </TextToolButton>
            <TextToolButton title="正文" active={textStyle === "body"} onClick={() => setTextStyle("body", 14)}>
                <Pilcrow className="size-5" />
            </TextToolButton>
            <DarkDivider />
            <TextToolButton title="粗体" active={Boolean(node.metadata?.textBold)} onClick={() => onMetadataChange(node.id, { textBold: !node.metadata?.textBold })}>
                <Bold className="size-5" />
            </TextToolButton>
            <TextToolButton title="斜体" active={Boolean(node.metadata?.textItalic)} onClick={() => onMetadataChange(node.id, { textItalic: !node.metadata?.textItalic })}>
                <Italic className="size-5" />
            </TextToolButton>
            <DarkDivider />
            <TextToolButton title="无序列表" onClick={() => appendText("- ")}>
                <List className="size-5" />
            </TextToolButton>
            <TextToolButton title="有序列表" onClick={() => appendText("1. ")}>
                <ListOrdered className="size-5" />
            </TextToolButton>
            <DarkDivider />
            <TextToolButton title="分割线" onClick={() => appendText("---")}>
                <Minus className="size-5" />
            </TextToolButton>
            <DarkDivider />
            <TextToolButton title="复制内容" onClick={() => void navigator.clipboard?.writeText(content)}>
                <Copy className="size-5" />
            </TextToolButton>
            <TextToolButton title={node.metadata?.textExpanded ? "收起编辑" : "展开编辑"} active={Boolean(node.metadata?.textExpanded)} onClick={() => onToggleTextExpanded(node)}>
                {node.metadata?.textExpanded ? <ChevronsDownUp className="size-5" /> : <ChevronsUpDown className="size-5" />}
            </TextToolButton>
        </div>
    );
}

function TextToolButton({ title, active = false, children, onClick }: { title: string; active?: boolean; children: ReactNode; onClick: () => void }) {
    return (
        <Tooltip title={title} placement="bottom" mouseEnterDelay={0.2}>
            <button type="button" className={`grid size-12 place-items-center rounded-[15px] text-[#d7d7d7] transition hover:bg-white/10 ${active ? "bg-white/15 text-white" : "opacity-75"}`} onClick={onClick} aria-label={title}>
                {children}
            </button>
        </Tooltip>
    );
}

function DarkDivider() {
    return <span className="mx-2 h-8 w-px bg-white/12" />;
}

function ToolbarAction({ title, label, icon, onClick, showLabel = true, active = false, danger = false, theme }: ToolbarTool & { showLabel?: boolean; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    const hasText = showLabel && Boolean(label);
    return (
        <Tooltip title={title} placement="top" mouseEnterDelay={0.2} color={theme.toolbar.panel} styles={{ body: { color: theme.node.text, boxShadow: "0 8px 24px rgba(15,23,42,.16)", fontSize: 13, fontWeight: 500 } }}>
            <button type="button" className="group relative inline-flex h-8 items-center whitespace-nowrap rounded-lg transition hover:scale-[1.02]" style={{ color: danger ? "#f87171" : theme.toolbar.item }} onClick={onClick} aria-label={title}>
                <span
                    className={`flex h-8 items-center ${hasText ? "gap-1.5 px-2" : "justify-center px-2"} rounded-lg transition`}
                    style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : danger ? "#f87171" : theme.toolbar.item }}
                    onMouseEnter={(event) => {
                        if (!active) event.currentTarget.style.background = theme.toolbar.itemHover;
                    }}
                    onMouseLeave={(event) => {
                        if (!active) event.currentTarget.style.background = "transparent";
                    }}
                >
                    {icon}
                    {hasText ? <span>{label}</span> : null}
                </span>
            </button>
        </Tooltip>
    );
}

function nodeTypeLabel(type: CanvasNodeType) {
    if (type === CanvasNodeType.Text) return "文本";
    if (type === CanvasNodeType.Image) return "图片";
    if (type === CanvasNodeType.Video) return "视频";
    if (type === CanvasNodeType.Audio) return "音频";
    if (type === CanvasNodeType.Agent) return "智能体";
    if (type === CanvasNodeType.ScriptAgent) return "剧本Agent";
    if (type === CanvasNodeType.CharacterAgent) return "角色Agent";
    if (type === CanvasNodeType.StoryboardAgent) return "分镜Agent";
    if (type === CanvasNodeType.ProjectBrief) return "故事设定";
    if (type === CanvasNodeType.SubjectBoard) return "角色板";
    if (type === CanvasNodeType.Storyboard) return "分镜板";
    return "生成配置";
}
function InfoRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
            <span className="opacity-50">{label}</span>
            <span className="min-w-0 whitespace-pre-wrap break-words">{value}</span>
        </div>
    );
}
