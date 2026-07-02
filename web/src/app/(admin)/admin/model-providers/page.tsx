"use client";

import { App } from "antd";
import { Check, Edit2, ImageIcon, Plus, RefreshCw, Search, Server, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { fetchAdminSettings, fetchChannelModels, saveAdminSettings, type AdminModelChannel, type AdminModelType, type AdminProviderModel, type AdminSettings } from "@/services/api/admin";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

import { defaultProviderModel, imageCreditResolutions, mergeApiKeys, modelApiRouteLabels, modelApiRoutes, modelTypeLabels, normalizeChannel, normalizeProviderModel, normalizeSettings, setResolutionEnabled, syncPublicModelChannel, unique } from "../model-management";

type PageView = "providers" | "routing";
type ModelEditorTarget = { providerIndex: number; model: string };

const panelClass = "rounded-[24px] border border-white/[0.08] bg-[#11141b]";
const inputClass = "h-9 w-full rounded-xl border border-white/[0.08] bg-[#1b1f29] px-3 text-sm text-white outline-none placeholder:text-[#667085] focus:border-white/45";
const textareaClass = "w-full rounded-xl border border-white/[0.08] bg-[#1b1f29] px-3 py-2 text-sm text-white outline-none placeholder:text-[#667085] focus:border-white/45";
const primaryButtonClass = "inline-flex h-9 items-center justify-center rounded-xl border border-white/[0.16] bg-[#2b303b] px-4 text-sm font-medium text-white transition hover:bg-[#363d4a] disabled:cursor-not-allowed disabled:opacity-60";
const outlineButtonClass = "inline-flex h-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-[#cfd7e6] transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60";
const typeOrder: AdminModelType[] = ["text", "image", "video", "audio"];
const typeMeta: Record<AdminModelType, { label: string; short: string; box: string }> = {
    text: { label: "文本模型", short: "TXT", box: "border-white/[0.10] bg-white/[0.03]" },
    image: { label: "图片模型", short: "IMG", box: "border-white/[0.10] bg-white/[0.03]" },
    video: { label: "视频模型", short: "VID", box: "border-white/[0.10] bg-white/[0.03]" },
    audio: { label: "音频模型", short: "AUD", box: "border-white/[0.10] bg-white/[0.03]" },
};

const emptyChannel: AdminModelChannel = { protocol: "openai", name: "", baseUrl: "", apiKey: "", models: [], modelItems: [], weight: 1, enabled: true, remark: "" };

export default function AdminModelProvidersPage() {
    const token = useUserStore((state) => state.token);
    const loadPublicSettings = useConfigStore((state) => state.loadPublicSettings);
    const { message } = App.useApp();
    const [settings, setSettings] = useState<AdminSettings | null>(null);
    const [channels, setChannels] = useState<AdminModelChannel[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [view, setView] = useState<PageView>("providers");
    const [addOpen, setAddOpen] = useState(false);
    const [draft, setDraft] = useState(emptyChannel);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [fetchingIndex, setFetchingIndex] = useState<number | null>(null);
    const [editTarget, setEditTarget] = useState<ModelEditorTarget | null>(null);
    const [editProviderIndex, setEditProviderIndex] = useState(0);
    const [editDraft, setEditDraft] = useState<AdminProviderModel | null>(null);
    const selectedProvider = channels[selectedIndex] || null;
    const visibleModels = useMemo(() => filterModels(selectedProvider?.modelItems || [], search), [selectedProvider, search]);

    const loadSettings = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data = normalizeSettings(await fetchAdminSettings(token));
            setSettings(data);
            setChannels(data.private.channels);
            setSelectedIndex(0);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取模型供应商失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSettings();
    }, [token]);

    const persist = async (nextChannels: AdminModelChannel[]) => {
        if (!token || !settings) return;
        setSaving(true);
        try {
            const next = normalizeSettings({ ...settings, private: { ...settings.private, channels: nextChannels } });
            const saved = normalizeSettings(await saveAdminSettings(token, syncPublicModelChannel(next)));
            const mergedChannels = mergeApiKeys(nextChannels, saved.private.channels);
            setSettings({ ...saved, private: { ...saved.private, channels: mergedChannels } });
            setChannels(mergedChannels);
            setSelectedIndex((current) => Math.min(current, Math.max(0, mergedChannels.length - 1)));
            void loadPublicSettings();
            message.success("已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const createProvider = async () => {
        const channel = normalizeChannel(draft);
        if (!channel.name.trim() || !channel.baseUrl.trim()) {
            message.warning("请填写供应商名称和 Base URL");
            return;
        }
        const next = [...channels, channel];
        await persist(next);
        setSelectedIndex(next.length - 1);
        setDraft(emptyChannel);
        setAddOpen(false);
    };

    const deleteProvider = (index: number) => {
        if (!window.confirm("删除后该供应商下的模型也会从系统可用模型中移除。")) return;
        void persist(channels.filter((_, current) => current !== index));
    };

    const updateProvider = (index: number, patch: Partial<AdminModelChannel>, autoSave = false) => {
        const next = channels.map((item, current) => (current === index ? normalizeChannel({ ...item, ...patch }) : item));
        setChannels(next);
        if (autoSave) void persist(next);
    };

    const saveSelectedProvider = () => {
        void persist(channels);
    };

    const fetchModels = async (index: number) => {
        if (!token) return;
        setFetchingIndex(index);
        try {
            const channel = channels[index];
            const models = await fetchChannelModels(token, { index, channel });
            const existing = new Map((channel.modelItems || []).map((item) => [item.model, item]));
            const modelItems = unique([...(channel.modelItems || []).map((item) => item.model), ...models]).map((model) => normalizeProviderModel({ ...defaultProviderModel(model), ...existing.get(model), model }));
            const next = channels.map((item, current) => (current === index ? normalizeChannel({ ...item, modelItems }) : item));
            await persist(next);
            setSelectedIndex(index);
            message.success(`已获取 ${models.length} 个模型并完成分类`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "获取模型失败");
        } finally {
            setFetchingIndex(null);
        }
    };

    const updateModel = (model: string, patch: Partial<AdminProviderModel>, autoSave = true) => {
        if (!selectedProvider) return;
        const next = channels.map((channel, index) =>
            index === selectedIndex
                ? normalizeChannel({
                      ...channel,
                      modelItems: channel.modelItems.map((item) => (item.model === model ? normalizeProviderModel({ ...item, ...patch }) : item)),
                  })
                : channel,
        );
        setChannels(next);
        if (autoSave) void persist(next);
    };

    const updateModelInProvider = (providerIndex: number, model: string, patch: Partial<AdminProviderModel>) => {
        const next = channels.map((channel, index) =>
            index === providerIndex
                ? normalizeChannel({
                      ...channel,
                      modelItems: channel.modelItems.map((item) => (item.model === model ? normalizeProviderModel({ ...item, ...patch }) : item)),
                  })
                : channel,
        );
        setChannels(next);
        void persist(next);
    };

    const openModelEditor = (providerIndex: number, model: AdminProviderModel) => {
        setSelectedIndex(providerIndex);
        setEditProviderIndex(providerIndex);
        setEditTarget({ providerIndex, model: model.model });
        setEditDraft(normalizeProviderModel(model));
    };

    const closeModelEditor = () => {
        setEditTarget(null);
        setEditDraft(null);
    };

    const updateEditDraft = (patch: Partial<AdminProviderModel>) => {
        setEditDraft((current) => (current ? normalizeProviderModel({ ...current, ...patch }) : current));
    };

    const saveModelEditor = async () => {
        if (!editTarget || !editDraft) return;
        const draftModel = editDraft.model.trim();
        if (!draftModel) {
            message.warning("请填写模型 ID");
            return;
        }
        const draft = normalizeProviderModel({ ...editDraft, model: draftModel });
        const next = channels.map((channel, index) => {
            if (index !== editTarget.providerIndex && index !== editProviderIndex) return channel;
            let modelItems = channel.modelItems;
            if (index === editTarget.providerIndex) {
                modelItems = modelItems.filter((item) => item.model !== editTarget.model);
            }
            if (index === editProviderIndex) {
                const exists = modelItems.some((item) => item.model === draft.model);
                modelItems = exists ? modelItems.map((item) => (item.model === draft.model ? draft : item)) : [...modelItems, draft];
            }
            return normalizeChannel({ ...channel, modelItems });
        });
        await persist(next);
        closeModelEditor();
    };

    return (
        <main className="min-h-full bg-[#08090d] p-4 text-white md:p-6">
            {editDraft ? (
                <ModelEditModal
                    model={editDraft}
                    providerIndex={editProviderIndex}
                    providers={channels}
                    saving={saving}
                    onProviderChange={setEditProviderIndex}
                    onChange={updateEditDraft}
                    onClose={closeModelEditor}
                    onSave={() => void saveModelEditor()}
                />
            ) : null}
            <div className="mx-auto max-w-[1320px]">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-[26px] font-semibold tracking-tight text-white">模型管理</h1>
                    <p className="mt-2 text-sm text-[#8f97aa]">在后台统一管理模型供应商、模型列表，以及前台可选择的默认模型。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link className={outlineButtonClass} href="/admin/model-credits">
                        模型积分
                    </Link>
                    <button className={outlineButtonClass} onClick={() => void loadSettings()} disabled={loading}>
                        <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        刷新
                    </button>
                </div>
            </div>

            <div className="mb-4 flex gap-2">
                <button className={`${view === "providers" ? "border-white/[0.24] bg-white/[0.12] text-white" : "border-white/[0.08] bg-white/[0.03] text-[#cfd7e6] hover:bg-white/[0.06] hover:text-white"} h-9 rounded-xl border px-4 text-sm transition`} onClick={() => setView("providers")}>
                    模型供应商
                </button>
                <button className={`${view === "routing" ? "border-white/[0.24] bg-white/[0.12] text-white" : "border-white/[0.08] bg-white/[0.03] text-[#cfd7e6] hover:bg-white/[0.06] hover:text-white"} h-9 rounded-xl border px-4 text-sm transition`} onClick={() => setView("routing")}>
                    模型选择
                </button>
            </div>

            {view === "providers" ? (
                <div className="space-y-4">
                    {addOpen ? <ProviderEditor title="添加供应商" channel={draft} onChange={setDraft} onCancel={() => setAddOpen(false)} onSave={() => void createProvider()} /> : null}

                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-white">模型供应商</h2>
                        <button className={primaryButtonClass} onClick={() => setAddOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            添加供应商
                        </button>
                    </div>

                    {channels.length === 0 ? (
                        <section className={`${panelClass} py-10 text-center text-sm text-[#8f97aa]`}>还没有模型供应商，请先添加供应商。</section>
                    ) : (
                        <div className="grid min-h-[620px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                            <aside className={`${panelClass} p-3`}>
                                <div className="mb-3 px-2 text-xs uppercase tracking-[0.18em] text-[#687183]">供应商列表</div>
                                <div className="space-y-2">
                                    {channels.map((provider, index) => {
                                        const selected = index === selectedIndex;
                                        const hasApiKey = provider.hasApiKey || Boolean(provider.apiKey.trim());
                                        return (
                                            <button key={`${provider.name}-${provider.baseUrl}-${index}`} type="button" onClick={() => setSelectedIndex(index)} className={`${selected ? "border-white/35 bg-white/[0.10]" : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]"} w-full rounded-2xl border px-3 py-3 text-left transition`}>
                                                <div className="flex items-center gap-2">
                                                    <Server className={`h-4 w-4 ${selected ? "text-white" : "text-[#8f97aa]"}`} />
                                                    <div className="min-w-0 flex-1 truncate text-sm font-medium text-white">{provider.name || "未命名供应商"}</div>
                                                </div>
                                                <div className="mt-2 truncate text-xs text-[#8f97aa]">{provider.baseUrl || "尚未填写 Base URL"}</div>
                                                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[#8f97aa]">
                                                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{provider.modelItems.length} 个模型</span>
                                                    <span className={hasApiKey ? "rounded-full bg-white/[0.10] px-2 py-0.5 text-[#e5e7eb]" : "rounded-full bg-white/[0.05] px-2 py-0.5 text-[#9aa3b5]"}>{hasApiKey ? "已配置 Key" : "未配置 Key"}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </aside>

                            {selectedProvider ? (
                                <section className={`${panelClass} max-w-[1020px] overflow-hidden`}>
                                    <div className="p-5 pb-0">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-white">
                                                    <Server className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-base font-semibold text-white">{selectedProvider.name || "未命名供应商"}</h3>
                                                        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#8f97aa]">已添加 {selectedProvider.modelItems.length} 个模型</span>
                                                    </div>
                                                    <div className="truncate text-xs text-[#8f97aa]">{selectedProvider.baseUrl || "尚未填写 Base URL"}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button className={outlineButtonClass} onClick={() => void fetchModels(selectedIndex)} disabled={fetchingIndex === selectedIndex}>
                                                    <Search className="mr-1.5 h-4 w-4" />
                                                    获取模型
                                                </button>
                                                <button className={outlineButtonClass} onClick={() => deleteProvider(selectedIndex)}>
                                                    <Trash2 className="mr-1.5 h-4 w-4" />
                                                    删除
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-5 p-5 pt-4">
                                        <div className="grid max-w-[880px] gap-4 md:grid-cols-2 xl:grid-cols-3">
                                            <ProviderFields channel={selectedProvider} onChange={(patch) => updateProvider(selectedIndex, patch)} />
                                        </div>
                                        <div className="flex justify-end">
                                            <button className={primaryButtonClass} onClick={saveSelectedProvider} disabled={saving}>
                                                保存供应商
                                            </button>
                                        </div>

                                        <div className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
                                            <input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索当前供应商模型" />
                                        </div>

                                        <div className="grid max-w-[980px] gap-4 xl:grid-cols-2">
                                            {typeOrder.map((type) => (
                                                <ModelGroup key={type} type={type} models={visibleModels.filter((item) => item.type === type)} onChange={updateModel} onEdit={(model) => openModelEditor(selectedIndex, model)} />
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            ) : null}
                        </div>
                    )}
                </div>
            ) : (
                <section className={`${panelClass} w-fit max-w-full p-5`}>
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-white">模型选择</h2>
                            <p className="mt-1 text-xs text-[#8f97aa]">控制哪些模型进入前台可选列表。</p>
                        </div>
                    </div>
                    <div className="w-[min(900px,calc(100vw-3rem))] max-w-full space-y-5">
                        {typeOrder.map((type) => {
                            const meta = typeMeta[type];
                            const models = channels.flatMap((provider, providerIndex) => provider.modelItems.filter((model) => model.selected && model.type === type).map((model) => ({ ...model, providerName: model.providerDisplayName || provider.name || "未命名供应商", providerIndex })));
                            return (
                                <div key={type} className={`rounded-2xl border p-4 ${meta.box}`}>
                                    <div className="mb-4">
                                        <div className="text-base font-semibold text-white">{meta.label}</div>
                                        <div className="text-xs text-[#8f97aa]">已选择 {models.length} 个模型，可在这里启用后进入前台模型列表。</div>
                                    </div>
                                    {models.length ? (
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {models.map((model) => (
                                                <div key={`${model.providerIndex}-${model.model}`} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                                                    <div className="flex items-start gap-3">
                                                        <ModelThumb label={model.name || model.model} url={model.thumbnailUrl} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="truncate text-sm font-semibold text-white">{model.name || model.model}</div>
                                                            <div className="mt-1 truncate text-[11px] text-[#8f97aa]">{model.model}</div>
                                                            <div className="mt-1 truncate text-[11px] text-[#8f97aa]">{model.providerName}</div>
                                                            {model.credits > 0 ? <div className="mt-2 inline-flex rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] text-[#d6dce8]">{model.credits} 积分</div> : null}
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-2 text-xs text-[#8f97aa]">
                                                            <span>{model.enabled ? "已启用" : "未启用"}</span>
                                                            <Toggle checked={model.enabled} onChange={(enabled) => updateModelInProvider(model.providerIndex, model.model, { enabled })} />
                                                        </div>
                                                        <button className="rounded-full p-1 text-[#8f97aa] hover:bg-white/10 hover:text-white" onClick={() => openModelEditor(model.providerIndex, model)} title="编辑模型">
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-white/[0.10] px-3 py-4 text-sm text-[#8f97aa]">还没有可用的 {meta.label}。</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
            </div>
        </main>
    );
}

function ProviderEditor({ title, channel, onChange, onCancel, onSave }: { title: string; channel: AdminModelChannel; onChange: (channel: AdminModelChannel) => void; onCancel: () => void; onSave: () => void }) {
    return (
        <section className={`${panelClass} p-5`}>
            <h2 className="mb-4 text-base font-semibold text-white">{title}</h2>
            <div className="grid gap-4 md:grid-cols-2">
                <ProviderFields channel={channel} onChange={(patch) => onChange(normalizeChannel({ ...channel, ...patch }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
                <button className={outlineButtonClass} onClick={onCancel}>取消</button>
                <button className={primaryButtonClass} onClick={onSave}>
                    <Plus className="mr-2 h-4 w-4" />
                    添加供应商
                </button>
            </div>
        </section>
    );
}

function ProviderFields({ channel, onChange }: { channel: AdminModelChannel; onChange: (patch: Partial<AdminModelChannel>) => void }) {
    return (
        <>
            <Field label="供应商名称">
                <input className={inputClass} value={channel.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="例如 OpenRouter" />
            </Field>
            <Field label="Base URL">
                <input className={inputClass} value={channel.baseUrl} onChange={(event) => onChange({ baseUrl: event.target.value })} placeholder="https://api.example.com/v1" />
            </Field>
            <Field label="API Key">
                <textarea className={`${textareaClass} min-h-[92px] resize-y font-mono leading-5`} value={channel.apiKey} onChange={(event) => onChange({ apiKey: event.target.value })} placeholder="一行一个 API Key" />
                <p className="mt-1 text-xs text-[#8f97aa]">{channel.hasApiKey && !channel.apiKey.trim() ? "已保存密钥；留空保存会继续沿用原密钥。" : "多行时会随配置保存；代理请求仍由后端选择渠道。"}</p>
            </Field>
            <Field label="启用供应商">
                <Toggle checked={channel.enabled} onChange={(enabled) => onChange({ enabled })} />
            </Field>
        </>
    );
}

function ModelGroup({ type, models, onChange, onEdit }: { type: AdminModelType; models: AdminProviderModel[]; onChange: (model: string, patch: Partial<AdminProviderModel>, autoSave?: boolean) => void; onEdit: (model: AdminProviderModel) => void }) {
    const meta = typeMeta[type];
    const selectedCount = models.filter((model) => model.selected).length;
    return (
        <div className={`rounded-2xl border p-4 ${meta.box}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-white">{meta.label}</div>
                    <div className="text-xs text-[#8f97aa]">当前 {models.length} 个，已选择 {selectedCount} 个</div>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold tracking-[0.2em] text-[#8f97aa]">{meta.short}</span>
            </div>
            {models.length ? (
                <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                    {models.map((model) => (
                        <div key={model.model} className={`${model.selected ? "border-white/35 bg-white/[0.10]" : "border-white/[0.08] bg-white/[0.03]"} flex items-center gap-3 rounded-xl border px-3 py-3 transition`}>
                            <ModelThumb label={model.name || model.model} url={model.thumbnailUrl} />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-white">{model.name || model.model}</div>
                                <div className="mt-0.5 truncate text-[11px] text-[#8f97aa]">{model.model}</div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <select className="h-8 rounded-lg border border-white/[0.08] bg-[#1b1f29] px-2 text-xs text-white outline-none" value={model.type} onChange={(event) => {
                                        const nextType = event.target.value as AdminModelType;
                                        onChange(model.model, { type: nextType, apiRoutes: modelApiRoutes[nextType] });
                                    }}>
                                        {typeOrder.map((item) => (
                                            <option key={item} value={item}>{modelTypeLabels[item]}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[#cfd7e6] transition hover:bg-white/[0.10] hover:text-white" onClick={() => onEdit(model)} title="编辑模型">
                                <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                className={`${model.selected ? "border-white/[0.35] bg-white/[0.12] text-white" : "border-white/[0.10] bg-white/[0.04] text-[#8f97aa] hover:bg-white/[0.08] hover:text-white"} flex h-8 min-w-[64px] shrink-0 items-center justify-center gap-1 rounded-lg border px-2 text-xs transition`}
                                onClick={() => onChange(model.model, model.selected ? { selected: false, enabled: false } : { selected: true })}
                                title={model.selected ? "已选择" : "选择模型"}
                            >
                                {model.selected ? <Check className="h-3.5 w-3.5" /> : null}
                                {model.selected ? "已选" : "选择"}
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-white/[0.10] px-3 py-4 text-sm text-[#8f97aa]">还没有添加{meta.label}。</div>
            )}
        </div>
    );
}

function ModelEditModal({
    model,
    providers,
    providerIndex,
    saving,
    onProviderChange,
    onChange,
    onClose,
    onSave,
}: {
    model: AdminProviderModel;
    providers: AdminModelChannel[];
    providerIndex: number;
    saving: boolean;
    onProviderChange: (index: number) => void;
    onChange: (patch: Partial<AdminProviderModel>) => void;
    onClose: () => void;
    onSave: () => void;
}) {
    const [tagsText, setTagsText] = useState(model.tags.join("\n"));

    useEffect(() => {
        setTagsText(model.tags.join("\n"));
    }, [model.model]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="max-h-[92vh] w-[min(820px,100%)] overflow-y-auto rounded-[24px] border border-white/[0.08] bg-[#11141b] shadow-2xl shadow-black/50">
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
                    <div>
                        <h2 className="text-lg font-semibold text-white">编辑模型</h2>
                        <p className="mt-1 text-sm text-[#8f97aa]">完善模型展示信息、供应商归属、计费和 API 路由。</p>
                    </div>
                    <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-[#cfd7e6] transition hover:bg-white/[0.10] hover:text-white" onClick={onClose} title="关闭">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-5 px-6 py-5">
                    <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                        <div className="space-y-3">
                            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1b1f29]">
                                {model.thumbnailUrl ? <img src={model.thumbnailUrl} alt={model.name || model.model} className="h-full w-full object-cover" /> : <ImageIcon className="h-9 w-9 text-[#667085]" />}
                            </div>
                            <label className={`${outlineButtonClass} w-full cursor-pointer`}>
                                <Upload className="mr-1.5 h-4 w-4" />
                                上传缩略图
                                <input className="hidden" type="file" accept="image/*" onChange={(event) => readThumbnailFile(event.currentTarget.files?.[0], (thumbnailUrl) => onChange({ thumbnailUrl }))} />
                            </label>
                            {model.thumbnailUrl ? (
                                <button className={`${outlineButtonClass} w-full`} onClick={() => onChange({ thumbnailUrl: "" })}>
                                    移除缩略图
                                </button>
                            ) : null}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="模型类型">
                                <select className={inputClass} value={model.type} onChange={(event) => {
                                    const type = event.target.value as AdminModelType;
                                    onChange({ type, apiRoutes: modelApiRoutes[type] });
                                }}>
                                    {typeOrder.map((item) => (
                                        <option key={item} value={item}>{modelTypeLabels[item]}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="模型 ID">
                                <input className={inputClass} value={model.model} onChange={(event) => onChange({ model: event.target.value })} placeholder="例如 gpt-4o" />
                            </Field>
                            <Field label="模型名称">
                                <input className={inputClass} value={model.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="前台展示名称" />
                            </Field>
                            <Field label="供应商">
                                <select className={inputClass} value={providerIndex} onChange={(event) => onProviderChange(Number(event.target.value))}>
                                    {providers.map((provider, index) => (
                                        <option key={`${provider.name}-${index}`} value={index}>{provider.name || "未命名供应商"}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="显示供应商名称">
                                <input className={inputClass} value={model.providerDisplayName} onChange={(event) => onChange({ providerDisplayName: event.target.value })} placeholder={providers[providerIndex]?.name || "供应商名称"} />
                            </Field>
                            <Field label={model.type === "video" ? "每秒积分" : "积分"}>
                                <input className={inputClass} type="number" min={0} value={model.type === "video" ? model.secondCredits : model.credits} onChange={(event) => {
                                    const credits = Number(event.target.value) || 0;
                                    onChange(model.type === "video" ? { credits, secondCredits: credits } : { credits });
                                }} />
                            </Field>
                        </div>
                    </div>

                    <Field label="缩略图地址">
                        <input className={inputClass} value={model.thumbnailUrl} onChange={(event) => onChange({ thumbnailUrl: event.target.value })} placeholder="https://..." />
                    </Field>

                    <Field label="模型描述">
                        <textarea className={`${textareaClass} min-h-[88px] resize-y`} value={model.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="用于后台识别和前台展示的简短说明" />
                    </Field>

                    <Field label="标签">
                        <textarea
                            className={`${textareaClass} min-h-[72px] resize-y`}
                            value={tagsText}
                            onChange={(event) => {
                                setTagsText(event.target.value);
                                onChange({ tags: splitTags(event.target.value) });
                            }}
                            placeholder="每行一个标签，也可用逗号分隔"
                        />
                    </Field>

                    {model.type === "image" ? (
                        <div>
                            <div className="mb-2 text-sm font-medium text-white">分辨率启用</div>
                            <div className="grid gap-2 sm:grid-cols-3">
                                {imageCreditResolutions.map((option) => {
                                    const current = model.resolutionCosts.find((item) => item.resolution === option.resolution);
                                    const enabled = current?.enabled !== false;
                                    return (
                                        <button
                                            key={option.resolution}
                                            type="button"
                                            onClick={() => onChange({ resolutionCosts: setResolutionEnabled(model.resolutionCosts, option.resolution, !enabled) })}
                                            className={`${enabled ? "border-white/45 bg-white/[0.10] text-white" : "border-white/[0.08] bg-[#1b1f29] text-[#8f97aa] hover:bg-white/[0.06]"} rounded-xl border px-3 py-3 text-left text-sm transition`}
                                        >
                                            <div className="font-semibold">{option.resolution.toUpperCase()}</div>
                                            <div className="mt-1 text-xs opacity-75">{enabled ? "已启用" : "已关闭"}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}

                    <div>
                        <div className="mb-2 text-sm font-medium text-white">接口选择</div>
                        <div className="grid gap-2 md:grid-cols-2">
                            {model.apiRoutes.map((route) => (
                                <button key={route.path} type="button" onClick={() => onChange({ apiRoutes: model.apiRoutes.map((item) => (item.path === route.path ? { ...item, enabled: !item.enabled } : item)) })} className={`${route.enabled ? "border-white/45 bg-white/[0.10] text-white" : "border-white/[0.08] bg-[#1b1f29] text-[#8f97aa] hover:bg-white/[0.06]"} rounded-xl border px-3 py-3 text-left text-sm transition`}>
                                    <div className="font-medium">{modelApiRouteLabels[route.path] || route.path}</div>
                                    <div className="mt-1 font-mono text-[11px] opacity-70">{route.path}</div>
                                    <div className="mt-1 text-xs opacity-75">{route.enabled ? "已启用" : "未启用"}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
                    <button className={outlineButtonClass} onClick={onClose}>取消</button>
                    <button className={primaryButtonClass} onClick={onSave} disabled={saving}>保存</button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="space-y-2">
            <span className="block text-sm font-medium text-white">{label}</span>
            {children}
        </label>
    );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <button type="button" onClick={() => onChange(!checked)} className={`${checked ? "border-white/[0.28] bg-[#3a4250]" : "border-white/[0.10] bg-white/[0.08]"} relative inline-flex h-7 w-12 shrink-0 rounded-full border transition`} title={checked ? "已启用" : "未启用"}>
            <span className={`${checked ? "left-6 bg-white" : "left-1 bg-[#aab2c0]"} absolute top-1 h-5 w-5 rounded-full transition`} />
        </button>
    );
}

function ModelThumb({ label, url }: { label: string; url?: string }) {
    return (
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#161a22] text-xs text-[#8f97aa]">
            {url ? <img src={url} alt={label} className="h-full w-full object-cover" /> : label.slice(0, 3).toUpperCase()}
        </div>
    );
}

function filterModels(models: AdminProviderModel[], keyword: string) {
    const value = keyword.trim().toLowerCase();
    return value ? models.filter((model) => [model.model, model.name, model.providerDisplayName, model.tags.join(" ")].join(" ").toLowerCase().includes(value)) : models;
}

function splitTags(value: string) {
    return unique(value.split(/[\s,，;；]+/));
}

function readThumbnailFile(file: File | undefined, onChange: (url: string) => void) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ""));
    reader.readAsDataURL(file);
}
