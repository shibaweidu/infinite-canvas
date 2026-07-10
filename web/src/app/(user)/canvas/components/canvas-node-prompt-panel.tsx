"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Image as ImageIcon, LoaderCircle, Maximize2, Minimize2, Upload, Video } from "lucide-react";
import { Button } from "antd";

import { GenerationStylePicker } from "@/components/generation-style-picker";
import { ModelPicker } from "@/components/model-picker";
import { defaultConfig, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { CreditSymbol, requestCreditCost } from "@/constant/credits";
import { canvasThemes } from "@/lib/canvas-theme";
import { uploadImage } from "@/services/image-storage";
import { useThemeStore } from "@/stores/use-theme-store";
import { AssetPickerModal, type InsertAssetPayload } from "./asset-picker-modal";
import { CanvasImageSettingsPopover } from "./canvas-image-settings-popover";
import { CanvasPromptLibrary } from "./canvas-prompt-library";
import { CanvasAudioSettingsPopover, type CanvasAudioSettingKey } from "./canvas-audio-settings-popover";
import { CanvasResourceMentionTextarea } from "./canvas-resource-mention-textarea";
import { CanvasVideoReferencePanel } from "./canvas-video-reference-panel";
import { clampVideoReferences, type NodeGenerationInput } from "./canvas-node-generation";
import { CanvasVideoSettingsPopover } from "./canvas-video-settings-popover";
import { buildCanvasScopedConfig, resolveNodeStyleName } from "../utils/canvas-global-settings";
import { CanvasNodeType, type CanvasGenerationMode, type CanvasGlobalSettings, type CanvasNodeData, type CanvasNodeMetadata, type CanvasTextMode, type CanvasVideoRefMode } from "../types";
import type { CanvasResourceReference } from "../utils/canvas-resource-references";

export type CanvasNodeGenerationMode = CanvasGenerationMode;

export type CanvasStoryboardShotOption = {
    sourceNodeId: string;
    shotId: string;
    label: string;
    description: string;
    imagePrompt?: string;
    videoPrompt?: string;
    imageUrl?: string;
};

export type CanvasPromptSelectOption = {
    value: string;
    label: string;
    prompt?: string;
    imageUrl?: string;
};

type CanvasNodePromptPanelProps = {
    node: CanvasNodeData;
    isRunning: boolean;
    modeOverride?: CanvasNodeGenerationMode;
    embedded?: boolean;
    keepPromptAfterSubmit?: boolean;
    upstreamInputs?: NodeGenerationInput[];
    upstreamVideoRefs?: { id: string; storageKey?: string; url: string }[];
    storyboardShots?: CanvasStoryboardShotOption[];
    selectionLabel?: string;
    selectionOptions?: CanvasPromptSelectOption[];
    selectedSelectionValue?: string;
    promptCollapsedClassName?: string;
    promptExpandedClassName?: string;
    onSelectionChange?: (value: string, option?: CanvasPromptSelectOption) => void;
    onPromptChange: (nodeId: string, prompt: string) => void;
    onConfigChange: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onGenerate: (nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => void;
    mentionReferences?: CanvasResourceReference[];
    onReferenceUpload?: (nodeId: string, file: File, kind: "image" | "video") => void | Promise<void>;
    onReferenceInsert?: (nodeId: string, payload: InsertAssetPayload) => void | Promise<void>;
    onStoryboardShotSelect?: (sourceNodeId: string, shotId: string) => void;
    onImageSettingsOpenChange?: (open: boolean) => void;
    canvasGlobalSettings?: CanvasGlobalSettings;
};

export function CanvasNodePromptPanel({ node, isRunning, modeOverride, embedded = false, keepPromptAfterSubmit = false, upstreamInputs = [], upstreamVideoRefs = [], storyboardShots = [], selectionLabel, selectionOptions, selectedSelectionValue, promptCollapsedClassName, promptExpandedClassName, mentionReferences = [], onPromptChange, onConfigChange, onGenerate, onReferenceUpload, onReferenceInsert, onSelectionChange, onStoryboardShotSelect, onImageSettingsOpenChange, canvasGlobalSettings }: CanvasNodePromptPanelProps) {
    const globalConfig = useEffectiveConfig();
    const modelCosts = useConfigStore((state) => state.publicSettings?.modelChannel.modelCosts);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const mode = modeOverride || defaultMode(node.type);
    const config = buildNodeConfig(globalConfig, canvasGlobalSettings, node, mode);
    const effectiveStyleName = resolveNodeStyleName(node, canvasGlobalSettings, globalConfig.defaultStyleName);
    const hasTextContent = node.type === CanvasNodeType.Text && Boolean(node.metadata?.content?.trim());
    const hasImageContent = node.type === CanvasNodeType.Image && Boolean(node.metadata?.content);
    const isEditingExistingContent = hasTextContent || hasImageContent;
    const nodePrompt = node.metadata?.prompt || (node.type === CanvasNodeType.Config ? node.metadata?.composerContent || "" : "");
    const [prompt, setPrompt] = useState(isEditingExistingContent ? "" : nodePrompt);
    const [promptExpanded, setPromptExpanded] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [textAssetPickerOpen, setTextAssetPickerOpen] = useState(false);
    const credits = requestCreditCost({ channelMode: config.channelMode, modelCosts, model: config.model, mode, count: mode === "image" ? config.count : 1, size: config.size, resolution: config.quality, seconds: config.videoSeconds });

    const videoRefMode: CanvasVideoRefMode = node.metadata?.videoRefMode || "text";
    const videoReferences = node.metadata?.videoReferences || [];
    const storyboardShotOptions = mode === "image" || mode === "video" ? storyboardShots : [];
    const selectedStoryboardShotKey = node.metadata?.storyboardSourceNodeId && node.metadata?.storyboardShotId ? `${node.metadata.storyboardSourceNodeId}:${node.metadata.storyboardShotId}` : "";
    const promptSelectOptions =
        selectionOptions ||
        storyboardShotOptions.map((option) => ({
            value: `${option.sourceNodeId}:${option.shotId}`,
            label: option.label,
            prompt: mode === "image" ? option.imagePrompt || option.description : option.videoPrompt || option.description,
            imageUrl: option.imageUrl,
        }));
    const selectedPromptSelectValue = selectedSelectionValue ?? selectedStoryboardShotKey;
    const textMode = node.metadata?.textMode || "write";
    const imageReferences = upstreamInputs.map((input) => input.image).filter((image): image is NonNullable<NodeGenerationInput["image"]> => Boolean(image));
    const textImages = imageReferences;
    const textVideos = upstreamInputs.map((input) => input.video).filter((video): video is NonNullable<NodeGenerationInput["video"]> => Boolean(video));
    const promptBoxHeight = promptExpanded ? promptExpandedClassName || (embedded ? "!h-[520px]" : "!h-56") : promptCollapsedClassName || "!h-24";
    const panelWidthStyle = embedded ? undefined : { width: "max-content", minWidth: "min(560px, calc(100vw - 32px))", maxWidth: "calc(100vw - 32px)" };

    const setVideoRefMode = (next: CanvasVideoRefMode) => onConfigChange(node.id, { videoRefMode: next, videoReferences: clampVideoReferences(next, videoReferences) });
    const setVideoReferences = (next: string[]) => onConfigChange(node.id, { videoReferences: next });
    const insertPickedReference = async (payload: InsertAssetPayload) => {
        setAssetPickerOpen(false);
        if (payload.kind !== "image") return;
        const storageKey = payload.storageKey || (await uploadImage(payload.dataUrl)).storageKey;
        setVideoReferences(clampVideoReferences(videoRefMode, [...videoReferences, storageKey]));
    };

    useEffect(() => {
        setPrompt(isEditingExistingContent ? "" : nodePrompt);
    }, [isEditingExistingContent, node.id, nodePrompt, textMode]);

    const updatePrompt = (value: string) => {
        setPrompt(value);
        if (!isEditingExistingContent) onPromptChange(node.id, value);
    };
    const selectPromptOption = (value: string) => {
        const option = promptSelectOptions.find((item) => item.value === value);
        if (selectionOptions) {
            if (!option) return;
            onSelectionChange?.(value, option);
            if (option?.prompt !== undefined) setPrompt(option.prompt);
            return;
        }
        if (!option) {
            onConfigChange(node.id, { storyboardSourceNodeId: undefined, storyboardShotId: undefined });
            return;
        }
        const [sourceNodeId, shotId] = value.split(":");
        const nextPrompt = option.prompt || "";
        setPrompt(nextPrompt);
        onStoryboardShotSelect?.(sourceNodeId, shotId);
        onConfigChange(node.id, { storyboardSourceNodeId: sourceNodeId, storyboardShotId: shotId, prompt: nextPrompt, ...(mode === "video" && option.imageUrl ? { videoRefMode: "first" as CanvasVideoRefMode } : {}) });
    };

    const submit = () => {
        const text = prompt.trim() || defaultTextPrompt(textMode);
        if (!text || isRunning) return;
        onGenerate(node.id, mode, text);
        if (!keepPromptAfterSubmit) setPrompt("");
    };
    const canSubmit = Boolean(prompt.trim() || (mode === "text" && textMode !== "write"));

    return (
        <div
            className={embedded ? "thin-scrollbar flex max-h-full min-h-0 flex-col overflow-y-auto" : "rounded-2xl border p-3 shadow-2xl backdrop-blur"}
            style={embedded ? { color: theme.node.text } : { ...panelWidthStyle, background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            {mode === "video" ? (
                <CanvasVideoReferencePanel
                    mode={videoRefMode}
                    references={videoReferences}
                    upstreamRefs={upstreamVideoRefs}
                    theme={theme}
                    onModeChange={setVideoRefMode}
                    onReferencesChange={setVideoReferences}
                    onPickAsset={() => setAssetPickerOpen(true)}
                />
            ) : null}
            {mode === "text" && (textMode !== "write" || textImages.length > 0 || textVideos.length > 0) ? (
                <TextReferencePanel
                    mode={textMode}
                    images={textImages}
                    videos={textVideos}
                    theme={theme}
                    onUpload={(file) => void onReferenceUpload?.(node.id, file, textMode === "imagePrompt" ? "image" : "video")}
                    onPickAsset={() => setTextAssetPickerOpen(true)}
                />
            ) : null}
            {mode === "image" && imageReferences.length ? <ImageReferencePanel images={imageReferences} theme={theme} /> : null}
            {promptSelectOptions.length ? (
                <label className="mb-2 flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-xs" style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}>
                    <span className="shrink-0 font-medium" style={{ color: theme.node.muted }}>
                        {selectionLabel || "镜头选择"}
                    </span>
                    <select
                        className="h-8 min-w-0 flex-1 rounded-lg border bg-transparent px-2 text-xs outline-none"
                        style={{ borderColor: theme.toolbar.border, color: theme.node.text }}
                        value={selectedPromptSelectValue}
                        onChange={(event) => selectPromptOption(event.target.value)}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <option value="">{selectionLabel ? `选择${selectionLabel.replace("选择", "")}` : "选择分镜镜头"}</option>
                        {promptSelectOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            ) : null}

            <div className="relative shrink-0">
                <CanvasResourceMentionTextarea
                    value={prompt}
                    references={mentionReferences}
                    onChange={updatePrompt}
                    onSubmit={submit}
                    containerClassName={promptBoxHeight}
                    className="thin-scrollbar h-full w-full min-w-[536px] resize-none rounded-xl border py-2 pl-3 pr-10 text-sm leading-5 outline-none appearance-none select-text"
                    style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}
                    placeholder={promptPlaceholder(mode, hasImageContent, hasTextContent, textMode)}
                />
                <button
                    type="button"
                    className="absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-md border transition hover:scale-[1.03]"
                    style={{ background: `${theme.toolbar.panel}e6`, borderColor: theme.toolbar.border, color: theme.node.text }}
                    title={promptExpanded ? "收起提示词" : "展开提示词"}
                    aria-label={promptExpanded ? "收起提示词" : "展开提示词"}
                    onClick={() => setPromptExpanded((value) => !value)}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    {promptExpanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
                </button>
            </div>

            <div className="mt-2 flex min-w-max flex-nowrap items-center justify-between gap-2">
                <div className="flex min-w-max flex-nowrap items-center gap-2">
                    <CanvasPromptLibrary onSelect={updatePrompt} />
                    {mode === "image" ? (
                        <>
                            <ModelPicker config={config} value={config.model} onChange={(model) => onConfigChange(node.id, { model })} capability="image" onMissingConfig={() => openConfigDialog(true)} />
                            <GenerationStylePicker value={effectiveStyleName} onChange={(styleName) => onConfigChange(node.id, { styleName })} compact className="inline-flex h-10 max-w-[150px] shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm transition hover:opacity-90" />
                            <CanvasImageSettingsPopover
                                config={config}
                                placement="topLeft"
                                buttonClassName="!h-10 !max-w-[170px] !justify-start !rounded-full !px-3"
                                onConfigChange={(key, value) => onConfigChange(node.id, key === "count" ? { count: Number(value) || 1 } : { [key]: value })}
                                onMissingConfig={() => openConfigDialog(true)}
                                onOpenChange={onImageSettingsOpenChange}
                            />
                        </>
                    ) : mode === "video" ? (
                        <>
                            <ModelPicker config={config} value={config.model} onChange={(model) => onConfigChange(node.id, { model })} capability="video" onMissingConfig={() => openConfigDialog(true)} />
                            <GenerationStylePicker value={effectiveStyleName} onChange={(styleName) => onConfigChange(node.id, { styleName })} compact className="inline-flex h-10 max-w-[150px] shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm transition hover:opacity-90" />
                            <CanvasVideoSettingsPopover config={config} buttonClassName="!h-10 !max-w-[170px] !justify-start !rounded-full !px-3" onConfigChange={(key, value) => onConfigChange(node.id, videoConfigPatch(key, value))} />
                        </>
                    ) : mode === "audio" ? (
                        <>
                            <ModelPicker config={config} value={config.model} onChange={(model) => onConfigChange(node.id, { model })} capability="audio" onMissingConfig={() => openConfigDialog(true)} />
                            <CanvasAudioSettingsPopover config={config} buttonClassName="!h-10 !max-w-[170px] !justify-start !rounded-full !px-3" onConfigChange={(key, value) => onConfigChange(node.id, audioConfigPatch(key, value))} />
                        </>
                    ) : (
                        <ModelPicker config={config} value={config.model} onChange={(model) => onConfigChange(node.id, { model })} capability="text" onMissingConfig={() => openConfigDialog(true)} />
                    )}
                </div>
                <Button
                    type="primary"
                    className="!h-10 !min-w-16 shrink-0 !rounded-full !px-3"
                    disabled={isRunning || !canSubmit}
                    onClick={submit}
                    aria-label="生成"
                >
                    <span className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
                            <CreditSymbol />
                            {credits.toLocaleString()}
                        </span>
                        {isRunning ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
                    </span>
                </Button>
            </div>

            {mode === "video" ? <AssetPickerModal open={assetPickerOpen} defaultTab="my-assets" onInsert={(payload) => void insertPickedReference(payload)} onClose={() => setAssetPickerOpen(false)} /> : null}
            {mode === "text" ? (
                <AssetPickerModal
                    open={textAssetPickerOpen}
                    defaultTab="my-assets"
                    onInsert={(payload) => {
                        setTextAssetPickerOpen(false);
                        if (textMode === "imagePrompt" && payload.kind === "video") return;
                        if (textMode === "videoPrompt" && payload.kind === "image") return;
                        void onReferenceInsert?.(node.id, payload);
                    }}
                    onClose={() => setTextAssetPickerOpen(false)}
                />
            ) : null}
        </div>
    );
}

function TextReferencePanel({
    mode,
    images,
    videos,
    theme,
    onUpload,
    onPickAsset,
}: {
    mode: CanvasTextMode;
    images: NonNullable<NodeGenerationInput["image"]>[];
    videos: NonNullable<NodeGenerationInput["video"]>[];
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    onUpload: (file: File) => void;
    onPickAsset: () => void;
}) {
    const isImageMode = mode === "imagePrompt";
    const isVideoMode = mode === "videoPrompt";
    const items = isImageMode ? images : isVideoMode ? videos : [...images, ...videos];
    const accept = isImageMode ? "image/*" : "video/*";
    const showActions = isImageMode || isVideoMode;
    const title = isImageMode ? "上游图片占位" : isVideoMode ? "上游视频占位" : "上游参考";
    return (
        <div className="mb-2 rounded-xl border p-2" style={{ background: theme.node.fill, borderColor: theme.node.stroke }}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 text-xs font-medium" style={{ color: theme.node.muted }}>
                    {isVideoMode ? <Video className="size-3.5" /> : <ImageIcon className="size-3.5" />}
                    {title}
                    <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: theme.toolbar.activeBg, color: theme.node.text }}>{items.length}</span>
                </div>
                {showActions ? (
                    <div className="flex items-center gap-1.5">
                        <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2 text-xs transition hover:opacity-90" style={{ borderColor: theme.toolbar.border, color: theme.node.text }}>
                            <Upload className="size-3.5" />
                            上传
                            <input
                                type="file"
                                accept={accept}
                                className="hidden"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    if (file) onUpload(file);
                                }}
                            />
                        </label>
                        <button type="button" className="h-7 rounded-full border px-2 text-xs transition hover:opacity-90" style={{ borderColor: theme.toolbar.border, color: theme.node.text }} onClick={onPickAsset}>
                            素材
                        </button>
                    </div>
                ) : null}
            </div>
            {items.length ? (
                <div className="thin-scrollbar flex max-h-24 gap-2 overflow-x-auto pb-1">
                    {(isImageMode || !isVideoMode) ? images.map((image) => <img key={image.id} src={image.dataUrl} alt={image.name} className="h-20 w-20 shrink-0 rounded-lg object-cover" />) : null}
                    {(isVideoMode || !isImageMode) ? videos.map((video) => <video key={video.id} src={video.url} className="h-20 w-32 shrink-0 rounded-lg bg-black object-cover" muted playsInline />) : null}
                </div>
            ) : (
                <div className="flex min-h-10 items-center justify-center px-2 py-3 text-center text-xs" style={{ color: theme.node.placeholder }}>
                    {isImageMode ? "上传图片或连接上游图片节点后自动读取" : "上传视频或连接上游视频节点后自动读取"}
                </div>
            )}
        </div>
    );
}

function ImageReferencePanel({ images, theme }: { images: NonNullable<NodeGenerationInput["image"]>[]; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return (
        <div className="mb-2 space-y-2" onMouseDown={(event) => event.stopPropagation()}>
            <div className="thin-scrollbar flex items-center gap-2 overflow-x-auto py-0.5">
                {images.map((image, index) => (
                    <div key={image.id} className="relative size-14 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: theme.node.stroke }}>
                        <img src={image.dataUrl} alt={image.name} className="size-full object-cover" draggable={false} />
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] leading-tight text-white">图片{index + 1}</span>
                        <span className="pointer-events-none absolute left-0.5 top-0.5 rounded bg-black/55 px-1 text-[9px] leading-tight text-white">连线</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function defaultMode(type: CanvasNodeData["type"]): CanvasNodeGenerationMode {
    return type === CanvasNodeType.Text || type === CanvasNodeType.Agent || type === CanvasNodeType.ScriptAgent || type === CanvasNodeType.CharacterAgent || type === CanvasNodeType.StoryboardAgent ? "text" : type === CanvasNodeType.Video ? "video" : type === CanvasNodeType.Audio ? "audio" : "image";
}

function buildNodeConfig(globalConfig: AiConfig, canvasGlobalSettings: CanvasGlobalSettings | undefined, node: CanvasNodeData, mode: CanvasNodeGenerationMode): AiConfig {
    const scopedConfig = buildCanvasScopedConfig(globalConfig, canvasGlobalSettings, mode);
    const defaultModel = mode === "image" ? scopedConfig.imageModel : mode === "video" ? scopedConfig.videoModel : mode === "audio" ? scopedConfig.audioModel : scopedConfig.textModel;
    return {
        ...scopedConfig,
        model: node.metadata?.model || defaultModel || (mode === "audio" ? defaultConfig.audioModel : scopedConfig.model || defaultConfig.model),
        quality: node.metadata?.quality || scopedConfig.quality || defaultConfig.quality,
        size: node.metadata?.size || scopedConfig.size || defaultConfig.size,
        videoSeconds: node.metadata?.seconds || scopedConfig.videoSeconds || defaultConfig.videoSeconds,
        vquality: node.metadata?.vquality || scopedConfig.vquality || defaultConfig.vquality,
        videoGenerateAudio: node.metadata?.generateAudio || scopedConfig.videoGenerateAudio || defaultConfig.videoGenerateAudio,
        videoWatermark: node.metadata?.watermark || scopedConfig.videoWatermark || defaultConfig.videoWatermark,
        audioVoice: node.metadata?.audioVoice || scopedConfig.audioVoice || defaultConfig.audioVoice,
        audioFormat: node.metadata?.audioFormat || scopedConfig.audioFormat || defaultConfig.audioFormat,
        audioSpeed: node.metadata?.audioSpeed || scopedConfig.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: node.metadata?.audioInstructions || scopedConfig.audioInstructions || defaultConfig.audioInstructions,
        count: String(node.metadata?.count || (mode === "image" ? scopedConfig.canvasImageCount || scopedConfig.count : scopedConfig.count) || defaultConfig.count),
    };
}

function promptPlaceholder(mode: CanvasNodeGenerationMode, hasImageContent: boolean, hasTextContent: boolean, textMode?: CanvasTextMode) {
    if (mode === "video") return "描述要生成的视频内容";
    if (mode === "audio") return "描述要生成的音频内容";
    if (mode === "image") return hasImageContent ? "请输入你想要把这张图修改成什么" : "描述要生成的图片内容";
    if (textMode === "imagePrompt") return "补充图片提示词反推要求，可留空使用默认要求";
    if (textMode === "videoPrompt") return "补充视频提示词反推要求，可留空使用默认要求";
    return hasTextContent ? "请输入你想要将本段文本修改成什么" : "请输入你想要生成的文本内容";
}

function defaultTextPrompt(textMode?: CanvasTextMode) {
    if (textMode === "imagePrompt") return "请分析图片并反推出可用于 AI 生图的高质量中文提示词，包含主体、场景、构图、光线、风格、镜头、细节和负面约束。";
    if (textMode === "videoPrompt") return "请根据视频关键帧反推出可用于 AI 视频生成的高质量中文提示词，包含主体、动作、场景、镜头运动、光线、风格、节奏和画面变化。";
    return "";
}

function videoConfigPatch(key: keyof AiConfig, value: string) {
    if (key === "videoSeconds") return { seconds: value };
    if (key === "videoGenerateAudio") return { generateAudio: value };
    if (key === "videoWatermark") return { watermark: value };
    return { [key]: value };
}

function audioConfigPatch(key: CanvasAudioSettingKey, value: string) {
    if (key === "audioVoice") return { audioVoice: value };
    if (key === "audioFormat") return { audioFormat: value };
    if (key === "audioSpeed") return { audioSpeed: value };
    return { audioInstructions: value };
}
