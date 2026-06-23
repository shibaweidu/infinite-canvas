"use client";

import type { CSSProperties } from "react";
import { Image as ImageIcon, MessageSquare, Music2, Video } from "lucide-react";
import { Segmented } from "antd";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodePromptPanel, type CanvasNodeGenerationMode } from "./canvas-node-prompt-panel";
import type { NodeGenerationInput } from "./canvas-node-generation";
import type { InsertAssetPayload } from "./asset-picker-modal";
import type { CanvasResourceReference } from "../utils/canvas-resource-references";
import type { CanvasGenerationMode, CanvasNodeData, CanvasNodeMetadata } from "../types";

type CanvasConfigNodePanelProps = {
    node: CanvasNodeData;
    isRunning: boolean;
    inputs: NodeGenerationInput[];
    upstreamVideoRefs: { id: string; storageKey?: string; url: string }[];
    mentionReferences: CanvasResourceReference[];
    onPromptChange: (nodeId: string, prompt: string) => void;
    onConfigChange: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onGenerate: (nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => void;
    onReferenceUpload?: (nodeId: string, file: File, kind: "image" | "video") => void | Promise<void>;
    onReferenceInsert?: (nodeId: string, payload: InsertAssetPayload) => void | Promise<void>;
    onImageSettingsOpenChange?: (open: boolean) => void;
};

export function CanvasConfigNodePanel({ node, isRunning, inputs, upstreamVideoRefs, mentionReferences, onPromptChange, onConfigChange, onGenerate, onReferenceUpload, onReferenceInsert, onImageSettingsOpenChange }: CanvasConfigNodePanelProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const mode = node.metadata?.generationMode || "image";
    const chipStyle = { background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text };
    const inputSummary = {
        textCount: inputs.filter((input) => input.type === "text").length,
        imageCount: inputs.filter((input) => input.type === "image").length,
        videoCount: inputs.filter((input) => input.type === "video").length,
        audioCount: inputs.filter((input) => input.type === "audio").length,
    };

    const updateMode = (value: string | number) => {
        const generationMode = value as CanvasGenerationMode;
        onConfigChange(node.id, { generationMode, composerContent: "" });
    };

    const updatePrompt = (nodeId: string, prompt: string) => {
        onPromptChange(nodeId, prompt);
        onConfigChange(nodeId, { composerContent: "" });
    };

    return (
        <div className="thin-scrollbar flex h-full w-full cursor-move flex-col gap-2 overflow-y-auto px-3 pb-3 pt-11 text-sm" style={{ color: theme.node.text }} onWheel={(event) => event.stopPropagation()}>
            <div className="cursor-default" onMouseDown={(event) => event.stopPropagation()}>
                <Segmented
                    block
                    size="small"
                    className="canvas-config-mode w-full !rounded-lg !p-0.5"
                    value={mode}
                    onChange={updateMode}
                    options={[
                        {
                            value: "image",
                            label: (
                                <span className="inline-flex items-center gap-1">
                                    <ImageIcon className="size-3.5" />
                                    生图
                                </span>
                            ),
                        },
                        {
                            value: "text",
                            label: (
                                <span className="inline-flex items-center gap-1">
                                    <MessageSquare className="size-3.5" />
                                    文本
                                </span>
                            ),
                        },
                        {
                            value: "video",
                            label: (
                                <span className="inline-flex items-center gap-1">
                                    <Video className="size-3.5" />
                                    视频
                                </span>
                            ),
                        },
                        {
                            value: "audio",
                            label: (
                                <span className="inline-flex items-center gap-1">
                                    <Music2 className="size-3.5" />
                                    音频
                                </span>
                            ),
                        },
                    ]}
                />
            </div>
            <div className="flex flex-wrap gap-1.5">
                <InputChip label="提示词" value={`${inputSummary.textCount} 个`} style={chipStyle} />
                <InputChip label="参考图" value={`${inputSummary.imageCount} 张`} style={chipStyle} />
                <InputChip label="参考视频" value={`${inputSummary.videoCount} 个`} style={chipStyle} />
                <InputChip label="参考音频" value={`${inputSummary.audioCount} 个`} style={chipStyle} />
            </div>
            <CanvasNodePromptPanel
                node={node}
                isRunning={isRunning}
                modeOverride={mode}
                embedded
                keepPromptAfterSubmit
                upstreamInputs={inputs}
                upstreamVideoRefs={upstreamVideoRefs}
                mentionReferences={mentionReferences}
                onPromptChange={updatePrompt}
                onConfigChange={onConfigChange}
                onGenerate={onGenerate}
                onReferenceUpload={onReferenceUpload}
                onReferenceInsert={onReferenceInsert}
                onImageSettingsOpenChange={onImageSettingsOpenChange}
            />
        </div>
    );
}

function InputChip({ label, value, style }: { label: string; value: string; style: CSSProperties }) {
    return (
        <div className="inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px]" style={style}>
            <span>{label}</span>
            <span className="font-medium">{value}</span>
        </div>
    );
}
