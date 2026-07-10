"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check, ChevronDown } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { resolveModelBrand } from "@/lib/model-brand";
import { cn } from "@/lib/utils";
import { modelOptionName, selectableLocalModelOptions, useConfigStore, type AiConfig, type ModelCapability } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import type { AdminModelCost, AdminModelType } from "@/services/api/admin";

type ModelPickerProps = {
    config: AiConfig;
    value?: string;
    onChange: (model: string) => void;
    className?: string;
    fullWidth?: boolean;
    placeholder?: string;
    onMissingConfig?: () => void;
    capability?: ModelCapability;
    modelType?: AdminModelType;
};

type PickerModel = {
    model: string;
    upstreamModel?: string;
    name?: string;
    thumbnailUrl?: string;
    providerName?: string;
    providerDisplayName?: string;
    description?: string;
    tags?: string[];
    type?: AdminModelType;
    local?: boolean;
};

export function ModelPicker({ config, value, onChange, className, fullWidth = false, placeholder = "选择模型", onMissingConfig, capability, modelType }: ModelPickerProps) {
    const pickerId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const rawConfig = useConfigStore((state) => state.config);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const allowLocal = publicSettings?.modelChannel.allowCustomChannel !== false;
    const pickerType = modelType || capability;
    const cloudModels = useMemo(() => buildCloudModels(publicSettings?.modelChannel.modelCosts || [], publicSettings?.modelChannel.availableModels || config.models, pickerType), [publicSettings, config.models, pickerType]);
    const localModels = useMemo(() => (allowLocal ? buildLocalModels(rawConfig, pickerType) : []), [allowLocal, rawConfig, pickerType]);
    const current = value || "";
    const currentMeta = cloudModels.find((item) => item.model === current) || localModels.find((item) => item.model === current);
    const displayName = currentMeta ? displayModelName(currentMeta, current) : "";

    useEffect(() => {
        if (!open) return;
        const syncPosition = () => setButtonRect(rootRef.current?.getBoundingClientRect() || null);
        const closeOtherPicker = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== pickerId) setOpen(false);
        };
        const closeOnPointer = (event: MouseEvent | PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            setOpen(false);
        };
        syncPosition();
        window.addEventListener("model-picker-open", closeOtherPicker);
        window.addEventListener("resize", syncPosition);
        window.addEventListener("scroll", syncPosition, true);
        document.addEventListener("pointerdown", closeOnPointer);
        return () => {
            window.removeEventListener("model-picker-open", closeOtherPicker);
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
            document.removeEventListener("pointerdown", closeOnPointer);
        };
    }, [pickerId, open]);

    const openPicker = () => {
        if (!cloudModels.length && !localModels.length && config.channelMode === "local") {
            onMissingConfig?.();
            return;
        }
        window.dispatchEvent(new CustomEvent("model-picker-open", { detail: pickerId }));
        setButtonRect(rootRef.current?.getBoundingClientRect() || null);
        setOpen(true);
    };

    const selectModel = (model: string, mode: "remote" | "local") => {
        updateConfig("channelMode", mode);
        onChange(model);
        setOpen(false);
    };

    return (
        <div ref={rootRef} className={cn("relative", fullWidth ? "w-full" : "inline-flex max-w-full")}>
            <button
                type="button"
                className={cn(
                    "canvas-composer-model-picker flex h-8 w-fit max-w-full items-center gap-2 rounded-full border border-input bg-transparent px-3 text-sm font-normal shadow-sm transition-colors hover:bg-white/5",
                    fullWidth ? "w-full min-w-0 justify-start" : "min-w-[9rem] justify-start",
                    open ? "border-ring ring-2 ring-ring/20" : "",
                    className,
                )}
                onClick={() => {
                    if (open) {
                        setOpen(false);
                        return;
                    }
                    openPicker();
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                title={displayName || placeholder}
            >
                <ModelAvatar model={currentMeta} fallback={current} compact />
                <span className="canvas-model-picker-text min-w-0 flex-1 truncate text-left">{displayName || placeholder}</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </button>

            {open && buttonRect ? createPortal(<ModelPickerPortal buttonRect={buttonRect} panelRef={panelRef} theme={theme} cloudModels={cloudModels} localModels={localModels} allowLocal={allowLocal} config={config} current={current} onSelect={selectModel} />, document.body) : null}
        </div>
    );
}

function ModelPickerPortal({
    buttonRect,
    panelRef,
    theme,
    cloudModels,
    localModels,
    allowLocal,
    config,
    current,
    onSelect,
}: {
    buttonRect: DOMRect;
    panelRef: RefObject<HTMLDivElement | null>;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    cloudModels: PickerModel[];
    localModels: PickerModel[];
    allowLocal: boolean;
    config: AiConfig;
    current: string;
    onSelect: (model: string, mode: "remote" | "local") => void;
}) {
    const width = Math.min(520, window.innerWidth - 24);
    const margin = 12;
    const gap = 8;
    const openUp = window.innerHeight - buttonRect.bottom < 420 && buttonRect.top > 420;
    const left = Math.max(margin, Math.min(window.innerWidth - width - margin, buttonRect.left));
    const style = {
        position: "fixed",
        zIndex: 1200,
        width,
        left,
        ...(openUp ? { bottom: window.innerHeight - buttonRect.top + gap } : { top: buttonRect.bottom + gap }),
        maxHeight: "55dvh",
        overflow: "hidden",
        borderRadius: 18,
        background: theme.toolbar.panel,
        boxShadow: "0 18px 54px rgba(28, 25, 23, 0.16)",
        color: theme.node.text,
    } as const;

    return (
        <div ref={panelRef} data-canvas-no-zoom className="flex flex-col" style={style} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 border-b px-4 py-3 text-[14px] font-medium" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.muted }}>
                选择模型
            </div>
            <div className="max-h-[calc(55dvh-48px)] overflow-y-auto pb-2">
                <div className="grid grid-cols-1 gap-2 px-3 md:grid-cols-2 md:gap-3 md:px-4">
                    <ModelSection title="云端渠道" emptyText="暂无云端可用模型，请到后台模型选择中启用模型。">
                        {cloudModels.map((model) => (
                            <ModelCard key={`remote-${model.model}`} model={model} selected={config.channelMode === "remote" && current === model.model} onClick={() => onSelect(model.model, "remote")} />
                        ))}
                    </ModelSection>
                    {allowLocal ? (
                        <ModelSection title="本地直连" emptyText="还没有本地直连模型，可到设置中添加或拉取模型列表。">
                            {localModels.map((model) => (
                                <ModelCard key={`local-${model.model}`} model={model} selected={config.channelMode === "local" && current === model.model} onClick={() => onSelect(model.model, "local")} />
                            ))}
                        </ModelSection>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function ModelSection({ title, emptyText, children }: { title: string; emptyText: string; children: ReactNode[] }) {
    return (
        <div className="col-span-full">
            <div className="mb-2 mt-1 text-[10px] font-medium uppercase tracking-[0.16em] opacity-60">{title}</div>
            {children.length ? <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">{children}</div> : <div className="rounded-lg border border-dashed border-current/10 px-3 py-3 text-xs opacity-60">{emptyText}</div>}
        </div>
    );
}

function ModelCard({ model, selected, onClick }: { model: PickerModel; selected: boolean; onClick: () => void }) {
    const title = displayModelName(model, model.model);
    const provider = model.providerDisplayName || model.providerName;
    return (
        <button
            type="button"
            className={cn(
                "group grid min-h-[82px] grid-cols-[45px_minmax(0,1fr)] gap-2 rounded-[10px] border px-2 py-2 text-left transition-all",
                selected ? "border-current/35 bg-current/10 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]" : "border-current/10 hover:bg-current/5 active:border-current/35",
            )}
            onClick={onClick}
        >
            <ModelAvatar model={model} fallback={model.model} selected={selected} />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <div className="flex w-full min-w-0 items-center gap-1.5">
                    <div className="truncate text-[13px] font-medium">{title}</div>
                    {selected ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
                </div>
                {model.local ? (
                    <>
                        <div className="w-full truncate text-[10px] opacity-65">供应商：{provider || "本地供应商"}</div>
                        <div className="w-full truncate text-[10px] opacity-85">本地模型，不扣积分</div>
                    </>
                ) : model.tags?.length ? (
                    <div className="flex w-full min-w-0 flex-wrap items-center gap-1">
                        {model.tags.slice(0, 3).map((tag) => (
                            <div key={tag} className="max-w-full truncate rounded-full bg-current/10 px-1.5 py-0.5 text-[9px] opacity-80">{tag}</div>
                        ))}
                    </div>
                ) : null}
                {!model.local && model.description ? <div className="line-clamp-2 w-full text-[10px] leading-4 opacity-80">{model.description}</div> : null}
            </div>
        </button>
    );
}

function ModelAvatar({ model, fallback, selected = false, compact = false }: { model?: PickerModel; fallback: string; selected?: boolean; compact?: boolean }) {
    const brand = resolveModelBrand(model?.upstreamModel || fallback, model?.providerDisplayName || model?.providerName);
    const icon = model?.thumbnailUrl || brand.icon;
    if (compact) {
        if (icon) return <img src={icon} alt="" className={cn("size-4 shrink-0 rounded-md object-contain", !model?.thumbnailUrl && brand.invertInDark && "dark:invert")} />;
        if (!fallback.trim()) return null;
        return <span className="flex size-4 shrink-0 items-center justify-center rounded bg-current/10 text-[7px] font-semibold">{brand.initials}</span>;
    }
    return (
        <div className="flex h-full min-h-[45px] w-[45px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-current/10">
            {icon ? <img src={icon} alt="" className={cn("h-8 w-8 rounded-[9px] object-contain transition-all duration-300", selected ? "scale-[1.08]" : "group-hover:scale-[1.08]", !model?.thumbnailUrl && brand.invertInDark && "dark:invert")} /> : <span className="text-[11px] font-semibold opacity-75">{brand.initials}</span>}
        </div>
    );
}

function buildCloudModels(costs: AdminModelCost[], availableModels: string[], modelType?: AdminModelType) {
    const costByModel = new Map(costs.map((item) => [item.model, item]));
    const models = availableModels.length ? availableModels : costs.map((item) => item.model);
    return Array.from(new Set(models.map((item) => item.trim()).filter(Boolean)))
        .map((model) => costByModel.get(model) || ({ model, type: inferModelType(model) } as AdminModelCost))
        .filter((item) => !modelType || (item.type || inferModelType(item.upstreamModel || item.model)) === modelType)
        .map((item) => ({
            model: item.model,
            upstreamModel: item.upstreamModel,
            name: item.name,
            type: item.type || inferModelType(item.upstreamModel || item.model),
            thumbnailUrl: item.thumbnailUrl,
            providerName: item.providerName,
            providerDisplayName: item.providerDisplayName,
            description: item.description,
            tags: item.tags,
        }));
}

function buildLocalModels(config: AiConfig, modelType?: AdminModelType) {
    return selectableLocalModelOptions(config, modelType).map((item) => ({
        model: item.value,
        upstreamModel: item.model,
        name: item.name,
        type: item.type,
        providerName: item.providerName,
        providerDisplayName: item.providerName,
        description: "本地模型，不扣积分",
        tags: [],
        local: true,
    }));
}

function displayModelName(model: PickerModel | undefined, fallback: string) {
    return modelOptionName(model?.name?.trim() || model?.upstreamModel || fallback);
}

function inferModelType(model: string): AdminModelType {
    const name = model.toLowerCase();
    if (["audio", "tts", "speech", "voice", "music", "sound"].some((keyword) => name.includes(keyword))) return "audio";
    if (["video", "sora", "veo", "kling", "runway", "grok-imagine-video", "seedance", "wan", "hailuo"].some((keyword) => name.includes(keyword))) return "video";
    if (["image", "dall", "imagen", "flux", "sdxl", "stable", "midjourney", "gpt-image", "nano-banana", "seedream"].some((keyword) => name.includes(keyword))) return "image";
    return "text";
}
