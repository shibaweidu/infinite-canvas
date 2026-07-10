"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Input, Modal } from "antd";

import { GenerationStylePicker } from "@/components/generation-style-picker";
import { ImageSettingsPanel } from "@/components/image-settings-panel";
import { ModelPicker } from "@/components/model-picker";
import { VideoSettingsPanel } from "@/components/video-settings-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { modelOptionName, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasFullscreenTextEditor } from "./canvas-fullscreen-text-editor";
import { buildCanvasScopedConfig, normalizeCanvasGlobalSettings, resolveCanvasAgentDefaults, resolveCanvasStyleName, type CanvasAgentInstructionKey } from "../utils/canvas-global-settings";
import type { CanvasGlobalSettings } from "../types";

type CanvasGlobalSettingsModalProps = {
    open: boolean;
    settings?: CanvasGlobalSettings;
    onClose: () => void;
    onSave: (settings: CanvasGlobalSettings | undefined) => void;
};

const emptySettings: CanvasGlobalSettings = {};
const agentTitles: Record<CanvasAgentInstructionKey, string> = {
    scriptInstruction: "剧本 Agent",
    characterInstruction: "角色 Agent",
    storyboardInstruction: "分镜 Agent",
};

export function CanvasGlobalSettingsModal({ open, settings, onClose, onSave }: CanvasGlobalSettingsModalProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const effectiveConfig = useEffectiveConfig();
    const publicModelChannel = useConfigStore((state) => state.publicSettings?.modelChannel || null);
    const [draft, setDraft] = useState<CanvasGlobalSettings>(settings || emptySettings);
    const [fullscreenField, setFullscreenField] = useState<CanvasAgentInstructionKey | null>(null);

    useEffect(() => {
        if (!open) return;
        setDraft(settings || emptySettings);
        setFullscreenField(null);
    }, [open, settings]);

    const systemAgentInstructions = useMemo(() => resolveCanvasAgentDefaults(publicModelChannel), [publicModelChannel]);
    const imageConfig = useMemo(() => buildCanvasScopedConfig(effectiveConfig, draft, "image"), [draft, effectiveConfig]);
    const videoConfig = useMemo(() => buildCanvasScopedConfig(effectiveConfig, draft, "video"), [draft, effectiveConfig]);
    const resolvedStyleName = resolveCanvasStyleName(draft, effectiveConfig.defaultStyleName);
    const resolvedImageModelName = modelOptionName(imageConfig.imageModel || imageConfig.model || "");
    const resolvedVideoModelName = modelOptionName(videoConfig.videoModel || videoConfig.model || "");
    const modalOpen = open && !fullscreenField;

    const updateAgent = (key: CanvasAgentInstructionKey, value: string) => {
        setDraft((current) => ({ ...current, agents: { ...(current.agents || {}), [key]: value } }));
    };

    const openAgentEditor = (key: CanvasAgentInstructionKey) => {
        setDraft((current) => ({
            ...current,
            agents: {
                ...(current.agents || {}),
                [key]: current.agents?.[key] ?? systemAgentInstructions[key],
            },
        }));
        setFullscreenField(key);
    };

    const resetAgent = (key: CanvasAgentInstructionKey) => {
        setDraft((current) => {
            const nextAgents = { ...(current.agents || {}) };
            delete nextAgents[key];
            return {
                ...current,
                agents: nextAgents.scriptInstruction || nextAgents.characterInstruction || nextAgents.storyboardInstruction ? nextAgents : undefined,
            };
        });
    };

    const updateImage = (patch: Partial<NonNullable<CanvasGlobalSettings["image"]>>) => {
        setDraft((current) => ({ ...current, image: { ...current.image, ...patch } }));
    };

    const updateVideo = (patch: Partial<NonNullable<CanvasGlobalSettings["video"]>>) => {
        setDraft((current) => ({ ...current, video: { ...current.video, ...patch } }));
    };

    const resetAll = () => {
        setDraft(emptySettings);
        setFullscreenField(null);
    };

    const handleSave = () => {
        onSave(normalizeCanvasGlobalSettings(draft));
    };

    return (
        <>
            <Modal
                title={
                    <div>
                        <div className="text-lg font-semibold">当前画布全局设定</div>
                        <div className="mt-1 text-xs font-normal text-stone-500">节点内单独设置优先；未覆盖时使用这里，再回落到账户偏好与系统默认。</div>
                    </div>
                }
                open={modalOpen}
                onCancel={onClose}
                width={1040}
                centered
                styles={{ body: { maxHeight: "76vh", overflowY: "auto", paddingRight: 18 } }}
                footer={
                    <div className="flex items-center justify-between">
                        <Button onClick={resetAll}>清空当前画布覆盖</Button>
                        <div className="flex items-center gap-2">
                            <Button onClick={onClose}>取消</Button>
                            <Button type="primary" onClick={handleSave}>
                                保存当前画布设定
                            </Button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-5 pt-1">
                    <section className="rounded-2xl border p-4" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                        <div className="mb-4">
                            <div className="text-sm font-semibold" style={{ color: theme.node.text }}>
                                Agent 身份设定
                            </div>
                            <div className="mt-1 text-xs" style={{ color: theme.node.muted }}>
                                只影响当前画布里的剧本 Agent、角色 Agent、分镜 Agent。直接在系统默认的基础上编辑，恢复默认后会清除当前画布的修改。
                            </div>
                        </div>
                        <div className="grid gap-4">
                            {(Object.keys(agentTitles) as CanvasAgentInstructionKey[]).map((key) => (
                                <AgentInstructionField
                                    key={key}
                                    title={agentTitles[key]}
                                    value={draft.agents?.[key]?.trim() || systemAgentInstructions[key]}
                                    hasOverride={Boolean(draft.agents?.[key]?.trim())}
                                    theme={theme}
                                    onEdit={() => openAgentEditor(key)}
                                    onReset={() => resetAgent(key)}
                                />
                            ))}
                        </div>
                    </section>

                    <section className="rounded-2xl border p-4" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold" style={{ color: theme.node.text }}>
                                    默认风格与图片
                                </div>
                                <div className="mt-1 text-xs" style={{ color: theme.node.muted }}>
                                    默认继承账户偏好；这里只覆盖当前画布的风格、图片模型、分辨率和比例。
                                </div>
                            </div>
                            <Button size="small" onClick={() => setDraft((current) => ({ ...current, styleName: undefined, image: undefined }))}>
                                跟随账户默认
                            </Button>
                        </div>
                        <div className="mb-4 grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                            <FieldBlock label="默认风格" hint={resolvedStyleName ? `当前生效：${resolvedStyleName}` : "未设置时不附加默认风格"} theme={theme}>
                                <GenerationStylePicker value={resolvedStyleName} onChange={(value) => setDraft((current) => ({ ...current, styleName: value || undefined }))} compact className="inline-flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition hover:opacity-90" />
                            </FieldBlock>
                            <FieldBlock label="默认图片模型" hint={resolvedImageModelName ? `当前生效：${resolvedImageModelName}` : "未设置时跟随账户默认"} theme={theme}>
                                <ModelPicker className="!h-10 !w-full !rounded-lg !px-3" fullWidth config={imageConfig} value={draft.image?.model || ""} onChange={(model) => updateImage({ model })} capability="image" placeholder="跟随账户默认" />
                            </FieldBlock>
                        </div>
                        <ImageSettingsPanel
                            config={imageConfig}
                            onConfigChange={(key, value) => {
                                if (key === "count") return;
                                updateImage({ [key]: value });
                            }}
                            theme={theme}
                            showTitle={false}
                            showCount={false}
                            className="space-y-4"
                        />
                    </section>

                    <section className="rounded-2xl border p-4" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold" style={{ color: theme.node.text }}>
                                    默认视频
                                </div>
                                <div className="mt-1 text-xs" style={{ color: theme.node.muted }}>
                                    默认继承账户偏好；这里只覆盖当前画布的视频模型、分辨率、比例和时长。
                                </div>
                            </div>
                            <Button size="small" onClick={() => setDraft((current) => ({ ...current, video: undefined }))}>
                                跟随账户默认
                            </Button>
                        </div>
                        <FieldBlock label="默认视频模型" hint={resolvedVideoModelName ? `当前生效：${resolvedVideoModelName}` : "未设置时跟随账户默认"} theme={theme}>
                            <ModelPicker className="!h-10 !w-full !rounded-lg !px-3" fullWidth config={videoConfig} value={draft.video?.model || ""} onChange={(model) => updateVideo({ model })} capability="video" placeholder="跟随账户默认" />
                        </FieldBlock>
                        <div className="mt-4">
                            <VideoSettingsPanel
                                config={videoConfig}
                                onConfigChange={(key, value) => {
                                    if (key === "size") updateVideo({ size: value });
                                    else if (key === "vquality") updateVideo({ vquality: value });
                                    else if (key === "videoSeconds") updateVideo({ videoSeconds: value });
                                }}
                                theme={theme}
                                showTitle={false}
                                className="space-y-4"
                            />
                        </div>
                    </section>

                    <section className="rounded-2xl border px-4 py-3 text-xs leading-5" style={{ borderColor: theme.toolbar.border, background: `${theme.toolbar.panel}cc`, color: theme.node.muted }}>
                        账户级默认配置仍保留在原来的“配置与用户偏好”入口中。当前画布全局设定只作用于这个画布，用来区分同一账户下不同故事工作流的默认值。
                    </section>
                </div>
            </Modal>

            {open && fullscreenField ? (
                <CanvasFullscreenTextEditor
                    open
                    title={`${agentTitles[fullscreenField]}身份设定`}
                    value={draft.agents?.[fullscreenField] || systemAgentInstructions[fullscreenField]}
                    placeholder="输入身份设定、能力边界和输出要求"
                    theme={theme}
                    onChange={(value) => updateAgent(fullscreenField, value)}
                    onClose={() => setFullscreenField(null)}
                />
            ) : null}
        </>
    );
}

function AgentInstructionField({
    title,
    value,
    hasOverride,
    theme,
    onEdit,
    onReset,
}: {
    title: string;
    value: string;
    hasOverride: boolean;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    onEdit: () => void;
    onReset: () => void;
}) {
    return (
        <div className="rounded-xl border p-3" style={{ borderColor: theme.toolbar.border, background: theme.toolbar.panel }}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-xs font-semibold" style={{ color: theme.node.text }}>
                        {title}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: theme.node.muted }}>
                        {hasOverride ? "已在系统默认基础上修改当前画布的身份设定。" : "当前使用系统默认身份设定。"}
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <StatusPill label="系统默认" theme={theme} />
                    <Button size="small" type="text" onClick={onReset} disabled={!hasOverride}>
                        恢复默认
                    </Button>
                    <Button size="small" onClick={onEdit}>
                        编辑
                    </Button>
                </div>
            </div>
            <Input.TextArea rows={7} readOnly value={value} className="!rounded-xl !text-sm" />
        </div>
    );
}

function StatusPill({ label, theme }: { label: string; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return <span className="inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium" style={{ borderColor: theme.node.activeStroke, background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}>{label}</span>;
}

function FieldBlock({ label, hint, theme, children }: { label: string; hint?: string; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; children: ReactNode }) {
    return (
        <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium" style={{ color: theme.node.text }}>
                    {label}
                </span>
                {hint ? (
                    <span className="text-[11px]" style={{ color: theme.node.muted }}>
                        {hint}
                    </span>
                ) : null}
            </div>
            {children}
        </div>
    );
}
