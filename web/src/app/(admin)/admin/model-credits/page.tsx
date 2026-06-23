"use client";

import { App } from "antd";
import { ChevronDown, Coins, RefreshCw, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchAdminSettings, saveAdminSettings, type AdminModelChannel, type AdminProviderModel, type AdminSettings } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

import { imageCreditResolutions, mergeApiKeys, nonNegativeNumber, normalizeSettings, selectedModelsByType, setResolutionCost, syncPublicModelChannel, updateModelInChannels } from "../model-management";

type ModelRow = AdminProviderModel & { providerName: string };
type CreditOption = { value: string; label: string; fallback: number };

const inputClass = "h-8 rounded-lg border border-white/[0.08] bg-white/[0.035] px-2 text-sm text-white outline-none placeholder:text-[#667085] focus:border-white/45";
const primaryButtonClass = "inline-flex h-9 items-center justify-center rounded-xl border border-white/[0.16] bg-[#2b303b] px-4 text-sm font-medium text-white transition hover:bg-[#363d4a] disabled:cursor-not-allowed disabled:opacity-60";
const outlineButtonClass = "inline-flex h-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-[#cfd7e6] transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60";
const videoCreditOptions: CreditOption[] = [{ value: "perSecond", label: "每秒", fallback: 5 }];

export default function AdminModelCreditsPage() {
    const token = useUserStore((state) => state.token);
    const { message } = App.useApp();
    const [settings, setSettings] = useState<AdminSettings | null>(null);
    const [channels, setChannels] = useState<AdminModelChannel[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const rules = useMemo(() => channels.flatMap((channel) => channel.modelItems).filter((model) => model.selected && hasCreditRule(model)), [channels]);
    const textModels = useMemo(() => selectedModelsByType(channels, "text"), [channels]);
    const imageModels = useMemo(() => selectedModelsByType(channels, "image"), [channels]);
    const videoModels = useMemo(() => selectedModelsByType(channels, "video"), [channels]);

    const loadSettings = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data = normalizeSettings(await fetchAdminSettings(token));
            setSettings(data);
            setChannels(data.private.channels);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取模型积分失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSettings();
    }, [token]);

    const updateModel = (model: string, patch: Partial<AdminProviderModel>) => {
        setChannels((current) => updateModelInChannels(current, model, patch));
    };

    const clearRule = (model: string) => {
        updateModel(model, { credits: 0, resolutionCosts: [], secondCredits: 0 });
    };

    const saveCredits = async () => {
        if (!token || !settings) return;
        setSaving(true);
        try {
            const next = normalizeSettings({ ...settings, private: { ...settings.private, channels } });
            const saved = normalizeSettings(await saveAdminSettings(token, syncPublicModelChannel(next)));
            const mergedChannels = mergeApiKeys(channels, saved.private.channels);
            setSettings({ ...saved, private: { ...saved.private, channels: mergedChannels } });
            setChannels(mergedChannels);
            message.success("模型积分已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="min-h-full bg-[#08090d] p-4 text-white md:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">模型积分设置</h1>
                    <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#8f97aa]">为同一个模型配置不同图片分辨率下的消耗积分；文本模型按次计算，视频模型按每秒积分计算。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3">
                        <span className="text-lg font-semibold text-white">{rules.length}</span>
                        <span className="text-xs text-[#8f97aa]">已配置规则</span>
                    </div>
                    <button className={outlineButtonClass} onClick={() => void loadSettings()} disabled={loading}>
                        <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        刷新
                    </button>
                    <button className={primaryButtonClass} onClick={() => void saveCredits()} disabled={saving}>
                        <Save className="mr-1.5 h-4 w-4" />
                        保存
                    </button>
                </div>
            </div>

            <div className="w-fit max-w-full space-y-4">
                <CreditSection
                    title="文本模型积分"
                    iconClassName="text-white"
                    models={textModels}
                    options={[{ value: "perRequest", label: "每次", fallback: 1 }]}
                    emptyText="暂无文本模型，请先到模型管理选择模型。"
                    defaultText={(model) => `默认 ${model.credits ?? 0} 积分`}
                    getValue={(model) => model.credits}
                    onChange={(model, _option, credits) => updateModel(model, { credits })}
                    onClear={clearRule}
                />

                <CreditSection
                    title="图片模型积分"
                    iconClassName="text-white"
                    models={imageModels}
                    options={imageCreditResolutions.map((item) => ({ value: item.resolution, label: item.resolution.toUpperCase(), fallback: item.credits }))}
                    emptyText="暂无图片模型，请先到模型管理选择模型。"
                    defaultText={(model) => `默认 ${model.credits ?? 0} 积分`}
                    getValue={(model, optionValue, fallback) => model.resolutionCosts.find((item) => item.resolution === optionValue)?.credits ?? fallback}
                    onChange={(model, optionValue, credits) => {
                        const target = imageModels.find((item) => item.model === model);
                        updateModel(model, { resolutionCosts: setResolutionCost(target?.resolutionCosts || [], optionValue, credits), credits: optionValue === "1k" ? credits : target?.credits });
                    }}
                    onClear={clearRule}
                />

                <CreditSection
                    title="视频模型每秒积分"
                    iconClassName="text-white"
                    models={videoModels}
                    options={videoCreditOptions}
                    emptyText="暂无视频模型，请先到模型管理选择模型。"
                    defaultText={(model) => `默认每秒 ${model.secondCredits || model.credits || 0} 积分`}
                    getValue={(model) => model.secondCredits}
                    onChange={(model, _optionValue, credits) => updateModel(model, { secondCredits: credits, credits })}
                    onClear={clearRule}
                />
            </div>
        </main>
    );
}

function CreditSection({
    title,
    iconClassName,
    models,
    options,
    emptyText,
    defaultText,
    getValue,
    onChange,
    onClear,
}: {
    title: string;
    iconClassName: string;
    models: ModelRow[];
    options: CreditOption[];
    emptyText: string;
    defaultText: (model: ModelRow) => string;
    getValue: (model: ModelRow, optionValue: string, fallback: number) => number | undefined;
    onChange: (model: string, optionValue: string, credits: number) => void;
    onClear: (model: string) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const gridTemplateColumns = `minmax(240px, 340px) repeat(${options.length}, 112px) 36px`;
    return (
        <section className="w-fit max-w-full rounded-2xl border border-white/[0.08] bg-[#11141b]">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-2">
                    <Coins className={`h-4 w-4 ${iconClassName}`} />
                    <h2 className="text-base font-semibold">{title}</h2>
                </div>
                <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-2 py-1 text-xs text-[#8f97aa]">{models.length} 个模型</span>
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white transition hover:bg-white/[0.10]" onClick={() => setExpanded((value) => !value)} title={expanded ? "收起" : "展开"}>
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                </div>
            </div>

            {expanded ? (
                <div className="overflow-x-auto">
                    {models.length ? (
                        <div className="min-w-[620px]">
                            <div className="grid items-center gap-2 border-b border-white/[0.06] bg-white/[0.025] px-4 py-2 text-xs font-medium text-[#8f97aa]" style={{ gridTemplateColumns }}>
                                <div>模型</div>
                                {options.map((option) => (
                                    <div key={option.value}>{option.label}</div>
                                ))}
                                <div className="sr-only">操作</div>
                            </div>
                            {models.map((model) => (
                                <div key={`${model.providerName}-${model.model}`} className="grid items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 last:border-b-0 hover:bg-white/[0.025]" style={{ gridTemplateColumns }}>
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-white">{model.name || model.model}</div>
                                        <div className="mt-0.5 truncate text-xs text-[#8f97aa]">{model.model} · {model.providerName} · {defaultText(model)}</div>
                                    </div>
                                    {options.map((option) => (
                                        <label key={option.value} className="block">
                                            <span className="sr-only">{`${model.model} ${option.label} 积分`}</span>
                                            <input className={inputClass} type="number" min={0} value={getValue(model, option.value, option.fallback) ?? ""} onChange={(event) => onChange(model.model, option.value, nonNegativeNumber(event.target.value, 0))} placeholder={`${option.fallback}`} />
                                        </label>
                                    ))}
                                    <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white transition hover:bg-white/[0.10]" onClick={() => onClear(model.model)} title="清空规则">
                                        <RotateCcw className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="px-4 py-8 text-center text-sm text-[#8f97aa]">{emptyText}</div>
                    )}
                </div>
            ) : null}
        </section>
    );
}

function hasCreditRule(model: AdminProviderModel) {
    if (model.type === "image") return model.resolutionCosts.length > 0;
    if (model.type === "video") return model.secondCredits > 0;
    if (model.type === "text") return model.credits > 0;
    return false;
}
