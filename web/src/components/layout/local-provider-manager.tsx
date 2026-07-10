"use client";

import { App, Button, Input, Modal, Segmented, Select, Switch } from "antd";
import { Cable, Check, Cpu, Edit2, Plus, RefreshCw, Search, Server, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { resolveModelBrand } from "@/lib/model-brand";
import { defaultModelApiRoutes, modelApiRouteLabels, modelTypeLabels, modelTypeOptions } from "@/lib/model-api-routes";
import { fetchLocalProviderModels } from "@/services/api/image";
import {
    createLocalProviderModel,
    localModelOptionValue,
    localProviderModelIds,
    normalizeLocalProviders,
    parseLocalModelOptionValue,
    useConfigStore,
    type LocalModelProvider,
    type LocalProviderModel,
    type ModelCapability,
} from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";

const modelTabs: Array<{ label: string; value: "all" | ModelCapability }> = [
    { label: "全部", value: "all" },
    { label: "文本", value: "text" },
    { label: "图片", value: "image" },
    { label: "视频", value: "video" },
    { label: "音频", value: "audio" },
];

const modelKeys: Array<{ type: ModelCapability; key: "imageModel" | "videoModel" | "textModel" | "audioModel" }> = [
    { type: "image", key: "imageModel" },
    { type: "video", key: "videoModel" },
    { type: "text", key: "textModel" },
    { type: "audio", key: "audioModel" },
];

type ProviderDraft = Pick<LocalModelProvider, "name" | "baseUrl" | "apiKey" | "enabled">;
type ModelEditorState = { providerId: string; originalModel: string; model: LocalProviderModel };

const emptyProviderDraft: ProviderDraft = { name: "", baseUrl: "", apiKey: "", enabled: true };

export function LocalProviderManager() {
    const { message, modal } = App.useApp();
    const config = useConfigStore((state) => state.config);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const dark = useThemeStore((state) => state.theme === "dark");
    const providers = useMemo(() => normalizeLocalProviders(config.localProviders), [config.localProviders]);
    const activeProvider = providers.find((provider) => provider.id === config.localProviderId) || providers[0] || null;
    const [providerSearch, setProviderSearch] = useState("");
    const [modelSearch, setModelSearch] = useState("");
    const [modelTab, setModelTab] = useState<"all" | ModelCapability>("all");
    const [loadingProviderId, setLoadingProviderId] = useState("");
    const [testingProviderId, setTestingProviderId] = useState("");
    const [providerModalOpen, setProviderModalOpen] = useState(false);
    const [providerDraft, setProviderDraft] = useState<ProviderDraft>(emptyProviderDraft);
    const [manualModelId, setManualModelId] = useState("");
    const [modelEditor, setModelEditor] = useState<ModelEditorState | null>(null);

    const saveProviders = (items: LocalModelProvider[], activeId = config.localProviderId) => {
        const nextProviders = normalizeLocalProviders(items);
        const nextActive = nextProviders.find((provider) => provider.id === activeId) || nextProviders[0] || null;
        updateConfig("localProviders", nextProviders);
        updateConfig("localProviderId", nextActive?.id || "");
        syncLegacyFields(nextActive);
        syncDefaultModels(nextProviders);
    };

    const syncLegacyFields = (provider: LocalModelProvider | null) => {
        if (!provider) {
            updateConfig("baseUrl", "");
            updateConfig("apiKey", "");
            updateConfig("models", []);
            updateConfig("imageModels", []);
            updateConfig("videoModels", []);
            updateConfig("textModels", []);
            updateConfig("audioModels", []);
            return;
        }
        const enabledModels = provider.models.filter((model) => model.enabled);
        updateConfig("baseUrl", provider.baseUrl);
        updateConfig("apiKey", provider.apiKey);
        updateConfig("models", localProviderModelIds(enabledModels));
        updateConfig("imageModels", enabledModels.filter((model) => model.type === "image").map((model) => model.model));
        updateConfig("videoModels", enabledModels.filter((model) => model.type === "video").map((model) => model.model));
        updateConfig("textModels", enabledModels.filter((model) => model.type === "text").map((model) => model.model));
        updateConfig("audioModels", enabledModels.filter((model) => model.type === "audio").map((model) => model.model));
    };

    const syncDefaultModels = (items: LocalModelProvider[]) => {
        for (const group of modelKeys) {
            const current = parseLocalModelOptionValue(config[group.key]);
            const valid = items.some((provider) => provider.enabled && provider.id === current.providerId && provider.models.some((model) => model.model === current.model && model.type === group.type && model.enabled && model.apiRoutes.some((route) => route.enabled)));
            if (valid) continue;
            const provider = items.find((item) => item.enabled && item.models.some((model) => model.type === group.type && model.enabled && model.apiRoutes.some((route) => route.enabled)));
            const model = provider?.models.find((item) => item.type === group.type && item.enabled && item.apiRoutes.some((route) => route.enabled));
            updateConfig(group.key, provider && model ? localModelOptionValue(provider.id, model.model) : "");
        }
    };

    const patchProvider = (id: string, patch: Partial<LocalModelProvider>) => {
        saveProviders(providers.map((provider) => (provider.id === id ? { ...provider, ...patch } : provider)), id);
    };

    const createProvider = () => {
        if (!providerDraft.name.trim()) {
            message.error("请输入供应商名称");
            return;
        }
        if (!providerDraft.baseUrl.trim()) {
            message.error("请输入 Base URL");
            return;
        }
        const id = createLocalProviderId();
        const provider: LocalModelProvider = {
            id,
            name: providerDraft.name.trim(),
            protocol: "openai",
            baseUrl: providerDraft.baseUrl.trim(),
            apiKey: providerDraft.apiKey,
            enabled: providerDraft.enabled,
            models: [],
        };
        saveProviders([...providers, provider], id);
        setProviderDraft(emptyProviderDraft);
        setProviderModalOpen(false);
        message.success("供应商已创建");
    };

    const removeProvider = (provider: LocalModelProvider) => {
        modal.confirm({
            title: `删除 ${provider.name}？`,
            content: "该供应商下的本地模型配置会一并移除。",
            okText: "删除",
            cancelText: "取消",
            okButtonProps: { danger: true },
            onOk: () => saveProviders(providers.filter((item) => item.id !== provider.id), providers.find((item) => item.id !== provider.id)?.id || ""),
        });
    };

    const testProvider = async (provider: LocalModelProvider) => {
        if (!provider.baseUrl.trim()) {
            message.error("请先填写 Base URL");
            return;
        }
        setTestingProviderId(provider.id);
        try {
            await fetchLocalProviderModels(provider.baseUrl, provider.apiKey);
            message.success(`${provider.name} 连接成功`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "连接失败");
        } finally {
            setTestingProviderId("");
        }
    };

    const refreshProviderModels = async (provider: LocalModelProvider) => {
        if (!provider.baseUrl.trim()) {
            message.error("请先填写 Base URL");
            return;
        }
        setLoadingProviderId(provider.id);
        try {
            const models = await fetchLocalProviderModels(provider.baseUrl, provider.apiKey);
            const existing = new Map(provider.models.map((model) => [model.model, model]));
            const fetched = models.map((model) => ({ ...(existing.get(model) || createLocalProviderModel(model)), source: "fetched" as const }));
            const fetchedIds = new Set(models);
            const manual = provider.models.filter((model) => model.source === "manual" && !fetchedIds.has(model.model));
            const nextModels = [...fetched, ...manual];
            patchProvider(provider.id, { models: nextModels });
            message.success(`${provider.name} 已获取 ${models.length} 个模型，新增模型需要手动启用`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取模型失败");
        } finally {
            setLoadingProviderId("");
        }
    };

    const addManualModel = () => {
        if (!activeProvider) return;
        const modelId = manualModelId.trim();
        if (!modelId) {
            message.error("请输入模型 ID");
            return;
        }
        if (activeProvider.models.some((model) => model.model === modelId)) {
            message.warning("该模型已经存在");
            return;
        }
        const model = createLocalProviderModel(modelId, false, "manual");
        patchProvider(activeProvider.id, { models: [...activeProvider.models, model] });
        setManualModelId("");
        setModelEditor({ providerId: activeProvider.id, originalModel: modelId, model });
    };

    const patchModel = (providerId: string, modelId: string, patch: Partial<LocalProviderModel>) => {
        const provider = providers.find((item) => item.id === providerId);
        if (!provider) return;
        patchProvider(providerId, { models: provider.models.map((model) => (model.model === modelId ? { ...model, ...patch } : model)) });
    };

    const saveModelEditor = () => {
        if (!modelEditor) return;
        const provider = providers.find((item) => item.id === modelEditor.providerId);
        const modelId = modelEditor.model.model.trim();
        if (!provider || !modelId) {
            message.error("请输入模型 ID");
            return;
        }
        if (provider.models.some((model) => model.model === modelId && model.model !== modelEditor.originalModel)) {
            message.error("该模型 ID 已存在");
            return;
        }
        patchProvider(provider.id, {
            models: provider.models.map((model) =>
                model.model === modelEditor.originalModel
                    ? { ...modelEditor.model, model: modelId, name: modelEditor.model.name.trim() || modelId }
                    : model,
            ),
        });
        setModelEditor(null);
        message.success("模型配置已保存");
    };

    const removeModel = (provider: LocalModelProvider, model: LocalProviderModel) => {
        modal.confirm({
            title: `删除 ${model.name || model.model}？`,
            content: "删除后可通过获取模型列表重新添加。",
            okText: "删除",
            cancelText: "取消",
            okButtonProps: { danger: true },
            onOk: () => patchProvider(provider.id, { models: provider.models.filter((item) => item.model !== model.model) }),
        });
    };

    const visibleProviders = providers.filter((provider) => provider.name.toLowerCase().includes(providerSearch.trim().toLowerCase()));
    const visibleModels = (activeProvider?.models || []).filter((model) => {
        const keyword = modelSearch.trim().toLowerCase();
        return (modelTab === "all" || model.type === modelTab) && (!keyword || `${model.name} ${model.model}`.toLowerCase().includes(keyword));
    });

    return (
        <section className="mb-5 overflow-hidden rounded-xl border border-stone-200 bg-stone-50/70 dark:border-[#4a4a4a] dark:bg-[#2b2b2b]">
            <div className="grid min-h-[590px] grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)]">
                <aside className="border-b border-stone-200 bg-white/75 p-3 dark:border-[#4a4a4a] dark:bg-[#333333] lg:border-b-0 lg:border-r">
                    <div className="flex items-center gap-2">
                        <Input prefix={<Search className="size-3.5 text-stone-400" />} value={providerSearch} placeholder="搜索供应商" onChange={(event) => setProviderSearch(event.target.value)} />
                        <Button className="shrink-0" icon={<Plus className="size-4" />} onClick={() => setProviderModalOpen(true)} title="新增供应商" />
                    </div>
                    <ProviderGroup
                        title="已启用"
                        providers={visibleProviders.filter((provider) => provider.enabled)}
                        activeId={activeProvider?.id}
                        onSelect={(provider) => {
                            updateConfig("localProviderId", provider.id);
                            syncLegacyFields(provider);
                        }}
                    />
                    <ProviderGroup
                        title="未启用"
                        providers={visibleProviders.filter((provider) => !provider.enabled)}
                        activeId={activeProvider?.id}
                        onSelect={(provider) => {
                            updateConfig("localProviderId", provider.id);
                            syncLegacyFields(provider);
                        }}
                    />
                </aside>

                <div className="min-w-0 bg-white p-4 dark:bg-[#2d2d2d] md:p-5">
                    {activeProvider ? (
                        <>
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-4 dark:border-[#4a4a4a]">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-white dark:bg-[#505050] dark:text-white">
                                        <Server className="size-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate text-base font-semibold text-stone-950 dark:text-stone-100">{activeProvider.name}</div>
                                        <div className="mt-0.5 text-xs text-stone-500">OpenAI 兼容 · {activeProvider.models.filter((model) => model.enabled).length}/{activeProvider.models.length} 个模型已启用</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                                    <span>{activeProvider.enabled ? "已启用" : "未启用"}</span>
                                    <Switch checked={activeProvider.enabled} onChange={(enabled) => patchProvider(activeProvider.id, { enabled })} />
                                </div>
                            </div>

                            <div className="grid gap-x-6 gap-y-4 border-b border-stone-200 py-5 md:grid-cols-2 dark:border-[#4a4a4a]">
                                <Field label="供应商名称">
                                    <Input value={activeProvider.name} onChange={(event) => patchProvider(activeProvider.id, { name: event.target.value })} />
                                </Field>
                                <Field label="请求格式">
                                    <Select className="w-full" value={activeProvider.protocol} options={[{ label: "OpenAI 兼容", value: "openai" }]} />
                                </Field>
                                <Field label="API 代理地址" hint="请填写包含 http:// 或 https:// 的完整地址">
                                    <Input value={activeProvider.baseUrl} placeholder="https://api.example.com/v1" onChange={(event) => patchProvider(activeProvider.id, { baseUrl: event.target.value })} />
                                </Field>
                                <Field label="API Key" hint="仅保存在当前浏览器，不会显示在模型选择器和任务日志中">
                                    <Input.Password value={activeProvider.apiKey} placeholder="请输入 API Key" onChange={(event) => patchProvider(activeProvider.id, { apiKey: event.target.value })} />
                                </Field>
                                <div className="flex flex-wrap items-end gap-2 md:col-span-2">
                                    <Button icon={<Cable className="size-4" />} loading={testingProviderId === activeProvider.id} onClick={() => void testProvider(activeProvider)}>测试连接</Button>
                                    <Button icon={<RefreshCw className="size-4" />} loading={loadingProviderId === activeProvider.id} onClick={() => void refreshProviderModels(activeProvider)}>获取模型列表</Button>
                                    <Button danger icon={<Trash2 className="size-4" />} onClick={() => removeProvider(activeProvider)}>删除供应商</Button>
                                </div>
                            </div>

                            <div className="pt-5">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="text-base font-semibold text-stone-950 dark:text-stone-100">模型列表</div>
                                        <div className="mt-1 text-xs text-stone-500">获取到的新模型默认关闭，启用并配置接口后才会出现在前台。</div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Input className="w-[190px]" prefix={<Search className="size-3.5 text-stone-400" />} value={modelSearch} placeholder="搜索模型" onChange={(event) => setModelSearch(event.target.value)} />
                                        <Input className="w-[190px]" value={manualModelId} placeholder="手动输入模型 ID" onChange={(event) => setManualModelId(event.target.value)} onPressEnter={addManualModel} />
                                        <Button icon={<Plus className="size-4" />} onClick={addManualModel}>添加</Button>
                                    </div>
                                </div>
                                <Segmented className="mt-4" value={modelTab} options={modelTabs} onChange={(value) => setModelTab(value as "all" | ModelCapability)} />
                                <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                                    {visibleModels.length ? visibleModels.map((model) => (
                                        <ModelRow
                                            key={model.model}
                                            model={model}
                                            providerName={activeProvider.name}
                                            onEdit={() => setModelEditor({ providerId: activeProvider.id, originalModel: model.model, model: cloneModel(model) })}
                                            onDelete={() => removeModel(activeProvider, model)}
                                            onEnabledChange={(enabled) => patchModel(activeProvider.id, model.model, { enabled })}
                                        />
                                    )) : <div className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700">当前分类还没有模型</div>}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex min-h-[540px] flex-col items-center justify-center text-center">
                            <div className="flex size-14 items-center justify-center rounded-xl bg-stone-100 text-stone-500 dark:bg-[#3a3a3a] dark:text-stone-200"><Server className="size-6" /></div>
                            <div className="mt-4 text-base font-semibold text-stone-900 dark:text-stone-100">还没有本地供应商</div>
                            <div className="mt-1 text-sm text-stone-500">创建供应商后，可获取并启用它下面的模型。</div>
                            <Button className="mt-4" type="primary" icon={<Plus className="size-4" />} onClick={() => setProviderModalOpen(true)}>新增供应商</Button>
                        </div>
                    )}
                </div>
            </div>

            <Modal title="创建自定义 AI 供应商" open={providerModalOpen} width={640} okText="创建" cancelText="取消" styles={localModalStyles(dark)} onOk={createProvider} onCancel={() => setProviderModalOpen(false)}>
                <div className="space-y-4 pt-2">
                    <Field label="供应商名称" required><Input value={providerDraft.name} placeholder="例如：OpenAI、本地代理" onChange={(event) => setProviderDraft((current) => ({ ...current, name: event.target.value }))} /></Field>
                    <Field label="请求格式" required><Select className="w-full" value="openai" options={[{ label: "OpenAI 兼容", value: "openai" }]} /></Field>
                    <Field label="代理地址" required hint="例如：https://api.example.com/v1"><Input value={providerDraft.baseUrl} placeholder="https://api.example.com/v1" onChange={(event) => setProviderDraft((current) => ({ ...current, baseUrl: event.target.value }))} /></Field>
                    <Field label="API Key"><Input.Password value={providerDraft.apiKey} placeholder="请输入 API Key" onChange={(event) => setProviderDraft((current) => ({ ...current, apiKey: event.target.value }))} /></Field>
                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-3 dark:border-[#505050] dark:bg-[#343434]">
                        <div><div className="text-sm font-medium text-stone-900 dark:text-stone-100">创建后启用</div><div className="mt-0.5 text-xs text-stone-500">模型仍需单独启用后才会显示。</div></div>
                        <Switch checked={providerDraft.enabled} onChange={(enabled) => setProviderDraft((current) => ({ ...current, enabled }))} />
                    </div>
                </div>
            </Modal>

            <Modal title="编辑本地模型" open={Boolean(modelEditor)} width={720} okText="保存" cancelText="取消" styles={localModalStyles(dark)} onOk={saveModelEditor} onCancel={() => setModelEditor(null)}>
                {modelEditor ? (
                    <div className="space-y-5 pt-2">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="模型 ID" required><Input value={modelEditor.model.model} onChange={(event) => setModelEditor((current) => current ? { ...current, model: { ...current.model, model: event.target.value } } : null)} /></Field>
                            <Field label="显示名称"><Input value={modelEditor.model.name} onChange={(event) => setModelEditor((current) => current ? { ...current, model: { ...current.model, name: event.target.value } } : null)} /></Field>
                            <Field label="模型类型" required>
                                <Select className="w-full" value={modelEditor.model.type} options={modelTypeOptions} onChange={(type) => setModelEditor((current) => current ? { ...current, model: { ...current.model, type, apiRoutes: defaultModelApiRoutes(type) } } : null)} />
                            </Field>
                            <div className="flex items-end justify-between rounded-lg border border-stone-200 px-3 py-2.5 dark:border-[#505050] dark:bg-[#343434]">
                                <div><div className="text-sm font-medium text-stone-900 dark:text-stone-100">启用模型</div><div className="mt-0.5 text-xs text-stone-500">启用后参与前台模型选择。</div></div>
                                <Switch checked={modelEditor.model.enabled} onChange={(enabled) => setModelEditor((current) => current ? { ...current, model: { ...current.model, enabled } } : null)} />
                            </div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-stone-900 dark:text-stone-100">接口路径</div>
                            <div className="mt-1 text-xs text-stone-500">接口选项与后台模型配置保持一致，可启用多个，生成时会按当前操作匹配路径。</div>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                                {modelEditor.model.apiRoutes.map((route) => (
                                    <button
                                        key={route.path}
                                        type="button"
                                        className={`cursor-pointer rounded-lg border px-3 py-3 text-left transition ${route.enabled ? "border-stone-400 bg-stone-200 !text-stone-950 dark:border-[#777777] dark:bg-[#505050] dark:!text-white" : "border-stone-200 bg-stone-50 !text-stone-700 hover:border-stone-400 dark:border-[#4b4b4b] dark:bg-[#363636] dark:!text-stone-200 dark:hover:bg-[#404040]"}`}
                                        onClick={() => setModelEditor((current) => current ? { ...current, model: { ...current.model, apiRoutes: current.model.apiRoutes.map((item) => item.path === route.path ? { ...item, enabled: !item.enabled } : item) } } : null)}
                                    >
                                        <div className="flex items-center justify-between gap-2 text-sm font-medium"><span>{modelApiRouteLabels[route.path] || route.path}</span>{route.enabled ? <Check className="size-4" /> : null}</div>
                                        <div className="mt-1 truncate font-mono text-[11px] opacity-70">{route.path}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : null}
            </Modal>
        </section>
    );
}

function ProviderGroup({ title, providers, activeId, onSelect }: { title: string; providers: LocalModelProvider[]; activeId?: string; onSelect: (provider: LocalModelProvider) => void }) {
    if (!providers.length) return null;
    return (
        <div className="mt-5">
            <div className="mb-2 px-2 text-[11px] font-medium text-stone-400">{title}</div>
            <div className="space-y-1">
                {providers.map((provider) => (
                    <button key={provider.id} type="button" className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${provider.id === activeId ? "bg-stone-200 !text-stone-950 shadow-sm dark:bg-[#505050] dark:!text-white" : "!text-stone-700 hover:bg-stone-100 dark:!text-stone-200 dark:hover:bg-[#404040]"}`} onClick={() => onSelect(provider)}>
                        <Cpu className="size-4 shrink-0 opacity-75" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{provider.name}</span>
                        <span className={`size-1.5 shrink-0 rounded-full ${provider.enabled ? "bg-emerald-500" : "bg-stone-400"}`} />
                    </button>
                ))}
            </div>
        </div>
    );
}

function ModelRow({ model, providerName, onEdit, onDelete, onEnabledChange }: { model: LocalProviderModel; providerName: string; onEdit: () => void; onDelete: () => void; onEnabledChange: (enabled: boolean) => void }) {
    const routes = model.apiRoutes.filter((route) => route.enabled);
    const brand = resolveModelBrand(model.model, providerName);
    return (
        <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-3 dark:border-[#4b4b4b] dark:bg-[#343434]">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-100 text-stone-600 dark:bg-[#414141] dark:text-stone-200">
                {brand.icon ? <img src={brand.icon} alt={brand.name} className={`size-6 object-contain ${brand.invertInDark ? "dark:invert" : ""}`} /> : <span className="text-[10px] font-semibold">{brand.initials}</span>}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2"><span className="truncate text-sm font-medium text-stone-950 dark:text-stone-100">{model.name || model.model}</span><span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 dark:bg-[#454545] dark:text-stone-200">{modelTypeLabels[model.type]}</span></div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-stone-400">{model.model}</div>
                <div className={`mt-1 truncate text-xs ${routes.length ? "text-stone-500" : "text-red-500"}`}>{routes.length ? routes.map((route) => modelApiRouteLabels[route.path] || route.path).join(" · ") : "未配置接口路径"}</div>
            </div>
            <Button type="text" icon={<Edit2 className="size-4" />} onClick={onEdit} title="编辑模型" />
            <Button type="text" danger icon={<Trash2 className="size-4" />} onClick={onDelete} title="删除模型" />
            <Switch size="small" checked={model.enabled} onChange={onEnabledChange} />
        </div>
    );
}

function Field({ label, hint, required = false, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-stone-100">{required ? <span className="mr-1 text-red-500">*</span> : null}{label}</span>
            {children}
            {hint ? <span className="mt-1 block text-xs text-stone-400">{hint}</span> : null}
        </label>
    );
}

function cloneModel(model: LocalProviderModel): LocalProviderModel {
    return { ...model, apiRoutes: model.apiRoutes.map((route) => ({ ...route })) };
}

function localModalStyles(dark: boolean) {
    if (!dark) return undefined;
    const background = "#2d2d2d";
    return {
        content: { background },
        header: { background },
        body: { background },
        footer: { background, borderTopColor: "#4a4a4a" },
    };
}

function createLocalProviderId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `local-provider-${Date.now()}`;
}
