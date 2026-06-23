"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Bot, Image as ImageIcon, LoaderCircle, Maximize2, Minimize2, Music2, Play, Type, Video } from "lucide-react";
import { Button, Input, Segmented } from "antd";

import { ModelPicker } from "@/components/model-picker";
import { CreditSymbol, requestCreditCost } from "@/constant/credits";
import { canvasThemes } from "@/lib/canvas-theme";
import { defaultConfig, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasFullscreenTextEditor } from "./canvas-fullscreen-text-editor";
import { CanvasPromptLibrary } from "./canvas-prompt-library";
import type { NodeGenerationInput } from "./canvas-node-generation";
import type { CanvasAgentOutputFormat, CanvasNodeData, CanvasNodeMetadata } from "../types";

type CanvasAgentNodePanelProps = {
    node: CanvasNodeData;
    isRunning: boolean;
    inputSummary: { textCount: number; imageCount: number; videoCount: number; audioCount: number };
    inputs: NodeGenerationInput[];
    onConfigChange: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onRun: (nodeId: string, prompt: string) => void;
};

const outputFormatOptions: { value: CanvasAgentOutputFormat; label: string }[] = [
    { value: "plain", label: "自由" },
    { value: "markdown", label: "Markdown" },
    { value: "json", label: "JSON" },
    { value: "promptList", label: "提示词组" },
];

export function CanvasAgentNodePanel({ node, isRunning, inputSummary, inputs, onConfigChange, onRun }: CanvasAgentNodePanelProps) {
    const globalConfig = useEffectiveConfig();
    const modelCosts = useConfigStore((state) => state.publicSettings?.modelChannel.modelCosts);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const config = buildAgentConfig(globalConfig, node);
    const [prompt, setPrompt] = useState(node.metadata?.prompt || "");
    const [instructionEditorOpen, setInstructionEditorOpen] = useState(false);
    const [promptExpanded, setPromptExpanded] = useState(false);
    const credits = requestCreditCost({ channelMode: config.channelMode, modelCosts, model: config.model, mode: "text", count: 1 });
    const chipStyle = { background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text };
    const imageInputs = inputs.filter((input) => input.image);
    const textInputs = inputs.filter((input) => input.type === "text");
    const otherInputs = inputs.filter((input) => input.type !== "text" && !input.image);
    const canRun = Boolean(prompt.trim() || node.metadata?.agentInstruction?.trim() || inputs.length);

    useEffect(() => {
        setPrompt(node.metadata?.prompt || "");
    }, [node.id, node.metadata?.prompt]);

    const updatePrompt = (value: string) => {
        setPrompt(value);
        onConfigChange(node.id, { prompt: value });
    };

    const submit = () => {
        if (!canRun || isRunning) return;
        onRun(node.id, prompt.trim() || "请根据智能体身份设定和上游输入完成本次任务。");
    };

    return (
        <div className="rounded-2xl border p-3 shadow-2xl backdrop-blur" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
            <div className="mb-2 rounded-xl border px-3 py-2 text-sm font-semibold" style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}>
                智能体身份设定
            </div>

            <div className="relative mb-2">
                <Input.TextArea
                    className="thin-scrollbar !h-20 !resize-none !rounded-xl !pr-10 !text-sm !leading-5"
                    value={node.metadata?.agentInstruction || ""}
                    placeholder="输入智能体身份、能力边界和输出要求"
                    onChange={(event) => onConfigChange(node.id, { agentInstruction: event.target.value })}
                />
                <FullscreenTextButton theme={theme} label="智能体身份设定" onClick={() => setInstructionEditorOpen(true)} />
            </div>

            <div className="relative">
                <textarea
                    value={prompt}
                    onChange={(event) => updatePrompt(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key !== "Enter" || event.ctrlKey || event.metaKey || event.shiftKey) return;
                        event.preventDefault();
                        submit();
                    }}
                    className={`thin-scrollbar w-full resize-none rounded-xl border py-2 pl-3 pr-10 text-sm leading-5 outline-none ${promptExpanded ? "h-48" : "h-24"}`}
                    style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}
                    placeholder="输入任务"
                />
                <ExpandTextButton theme={theme} expanded={promptExpanded} label="提示词" onClick={() => setPromptExpanded((value) => !value)} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <InputChip icon={<Type className="size-3.5" />} value={`${inputSummary.textCount} 文本`} style={chipStyle} />
                <InputChip icon={<ImageIcon className="size-3.5" />} value={`${inputSummary.imageCount} 图片`} style={chipStyle} />
                <InputChip icon={<Video className="size-3.5" />} value={`${inputSummary.videoCount} 视频`} style={chipStyle} />
                <InputChip icon={<Music2 className="size-3.5" />} value={`${inputSummary.audioCount} 音频`} style={chipStyle} />
                {imageInputs.map((input) => (
                    <img key={input.nodeId} src={input.image!.dataUrl} alt={input.title} title={input.title} className="h-9 w-9 rounded-md border object-cover" style={{ borderColor: theme.node.stroke }} />
                ))}
                {[...textInputs, ...otherInputs].slice(0, 3).map((input) => (
                    <span key={input.nodeId} className="inline-flex h-7 max-w-[150px] items-center rounded-md border px-2 text-[11px]" style={chipStyle}>
                        <span className="truncate">{input.title}</span>
                    </span>
                ))}
            </div>

            <div className="mt-2 grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: theme.node.text }}>
                    输出格式
                </span>
                <Segmented
                    className="w-full !rounded-xl !p-1 [&_.ant-segmented-group]:!grid [&_.ant-segmented-group]:!grid-cols-4 [&_.ant-segmented-item-label]:!min-h-8 [&_.ant-segmented-item-label]:!leading-8"
                    value={node.metadata?.agentOutputFormat || "plain"}
                    onChange={(value) => onConfigChange(node.id, { agentOutputFormat: value as CanvasAgentOutputFormat })}
                    options={outputFormatOptions}
                />
            </div>

            <div className="mt-2 flex min-w-0 items-center gap-2">
                <CanvasPromptLibrary onSelect={updatePrompt} />
                <ModelPicker className="h-10 max-w-[190px] shrink-0" config={config} value={config.model} onChange={(model) => onConfigChange(node.id, { model })} modelType="text" onMissingConfig={() => openConfigDialog(true)} />
                <Button type="primary" className="!ml-auto !h-10 !min-w-20 shrink-0 !rounded-full !px-3" disabled={isRunning || !canRun} onClick={submit}>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
                            <CreditSymbol />
                            {credits.toLocaleString()}
                        </span>
                        {isRunning ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
                        <Bot className="size-4" />
                    </span>
                </Button>
            </div>
            <CanvasFullscreenTextEditor open={instructionEditorOpen} title="智能体身份设定" value={node.metadata?.agentInstruction || ""} placeholder="输入智能体身份、能力边界和输出要求" theme={theme} onChange={(agentInstruction) => onConfigChange(node.id, { agentInstruction })} onClose={() => setInstructionEditorOpen(false)} />
        </div>
    );
}

function InputChip({ icon, value, style }: { icon: ReactNode; value: string; style: CSSProperties }) {
    return (
        <span className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px]" style={style}>
            {icon}
            {value}
        </span>
    );
}

function ExpandTextButton({ theme, expanded, label, onClick }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes]; expanded: boolean; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            className="absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-md border transition hover:scale-[1.03]"
            style={{ background: `${theme.toolbar.panel}e6`, borderColor: theme.toolbar.border, color: theme.node.text }}
            title={expanded ? `收起${label}` : `展开${label}`}
            aria-label={expanded ? `收起${label}` : `展开${label}`}
            onClick={onClick}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
    );
}

function FullscreenTextButton({ theme, label, onClick }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes]; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            className="absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-md border transition hover:scale-[1.03]"
            style={{ background: `${theme.toolbar.panel}e6`, borderColor: theme.toolbar.border, color: theme.node.text }}
            title={`全屏编辑${label}`}
            aria-label={`全屏编辑${label}`}
            onClick={onClick}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <Maximize2 className="size-3.5" />
        </button>
    );
}

function buildAgentConfig(globalConfig: AiConfig, node: CanvasNodeData): AiConfig {
    return {
        ...globalConfig,
        model: node.metadata?.model || globalConfig.textModel || globalConfig.model || defaultConfig.model,
    };
}
