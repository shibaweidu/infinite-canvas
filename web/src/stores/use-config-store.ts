"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { defaultModelApiRoutes, normalizeModelApiRoutes } from "@/lib/model-api-routes";
import { apiGet } from "@/services/api/request";
import type { AdminModelApiRoute, AdminModelType, AdminPublicSettings } from "@/services/api/admin";

export type AiConfig = {
    channelMode: "remote" | "local";
    baseUrl: string;
    apiKey: string;
    localProviderId: string;
    localProviders: LocalModelProvider[];
    model: string;
    imageModel: string;
    videoModel: string;
    textModel: string;
    audioModel: string;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
    videoSeconds: string;
    vquality: string;
    videoGenerateAudio: string;
    videoWatermark: string;
    systemPrompt: string;
    models: string[];
    imageModels: string[];
    videoModels: string[];
    textModels: string[];
    audioModels: string[];
    quality: string;
    size: string;
    count: string;
    canvasImageCount: string;
    defaultStyleName: string;
};

export const CONFIG_STORE_KEY = "infinite-canvas:ai_config_store";
export type ModelCapability = "image" | "video" | "text" | "audio";
export type LocalModelProvider = {
    id: string;
    name: string;
    protocol: "openai";
    baseUrl: string;
    apiKey: string;
    enabled: boolean;
    models: LocalProviderModel[];
};

export type LocalProviderModel = {
    model: string;
    name: string;
    type: ModelCapability;
    enabled: boolean;
    source: "fetched" | "manual";
    apiRoutes: AdminModelApiRoute[];
};

export type LocalModelOption = {
    value: string;
    model: string;
    name: string;
    providerId: string;
    providerName: string;
    type: ModelCapability;
};

export const defaultConfig: AiConfig = {
    channelMode: "local",
    baseUrl: "https://api.openai.com",
    apiKey: "",
    localProviderId: "",
    localProviders: [],
    model: "",
    imageModel: "",
    videoModel: "",
    textModel: "",
    audioModel: "",
    audioVoice: "alloy",
    audioFormat: "mp3",
    audioSpeed: "1",
    audioInstructions: "",
    videoSeconds: "6",
    vquality: "720",
    videoGenerateAudio: "true",
    videoWatermark: "false",
    systemPrompt: "",
    models: [],
    imageModels: [],
    videoModels: [],
    textModels: [],
    audioModels: [],
    quality: "low",
    size: "1:1",
    count: "1",
    canvasImageCount: "3",
    defaultStyleName: "",
};

const legacyBuiltInLocalModels = new Set(["gpt-image-2", "grok-imagine-video", "gpt-5.5", "gpt-4o-mini-tts"]);

type ConfigStore = {
    config: AiConfig;
    publicSettings: AdminPublicSettings | null;
    isPublicSettingsLoading: boolean;
    isConfigOpen: boolean;
    shouldPromptContinue: boolean;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
    loadPublicSettings: () => Promise<void>;
    isAiConfigReady: (config: AiConfig, model: string) => boolean;
    openConfigDialog: (shouldPromptContinue?: boolean) => void;
    setConfigDialogOpen: (isOpen: boolean) => void;
    clearPromptContinue: () => void;
};

function resolveEffectiveConfig(config: AiConfig, modelChannel: AdminPublicSettings["modelChannel"] | null) {
    const channelMode = modelChannel?.allowCustomChannel ? config.channelMode : "remote";
    if (channelMode === "local" || !modelChannel) return { ...resolveActiveLocalProviderConfig(config), channelMode };
    const models = modelChannel.availableModels || [];
    const modelTypes = new Map<string, AdminModelType>((modelChannel.modelCosts || []).map((item) => [item.model, item.type] as const));
    const modelAliases = new Map<string, string>(
        (modelChannel.modelCosts || [])
            .flatMap((item) => (item.upstreamModel ? [[item.upstreamModel, item.model] as const] : [])),
    );
    const textModels = filterModelsByCapability(models, "text", modelTypes);
    const imageModels = filterModelsByCapability(models, "image", modelTypes);
    const videoModels = filterModelsByCapability(models, "video", modelTypes);
    const audioModels = filterModelsByCapability(models, "audio", modelTypes);
    const currentModel = resolvePublicModel(config.model, models, modelAliases);
    const currentImageModel = resolvePublicModel(config.imageModel, imageModels, modelAliases);
    const currentVideoModel = resolvePublicModel(config.videoModel, videoModels, modelAliases);
    const currentTextModel = resolvePublicModel(config.textModel, textModels, modelAliases);
    const currentAudioModel = resolvePublicModel(config.audioModel, audioModels, modelAliases);
    const fallbackTextModel = validDefault(modelChannel.defaultTextModel, textModels) || preferredModel(textModels, isTextModelName);
    const fallbackModel = validDefault(modelChannel.defaultModel, textModels) || fallbackTextModel;
    const fallbackImageModel = validDefault(modelChannel.defaultImageModel, imageModels) || preferredModel(imageModels, isImageModelName);
    const fallbackVideoModel = validDefault(modelChannel.defaultVideoModel, videoModels) || preferredModel(videoModels, isVideoModelName);
    const fallbackAudioModel = preferredModel(audioModels, isAudioModelName);
    return {
        ...config,
        channelMode,
        models,
        imageModels,
        videoModels,
        textModels,
        audioModels,
        model: textModels.includes(currentModel) ? currentModel : fallbackModel,
        imageModel: imageModels.includes(currentImageModel) ? currentImageModel : fallbackImageModel,
        videoModel: videoModels.includes(currentVideoModel) ? currentVideoModel : fallbackVideoModel,
        textModel: textModels.includes(currentTextModel) ? currentTextModel : fallbackTextModel || fallbackModel,
        audioModel: audioModels.includes(currentAudioModel) ? currentAudioModel : fallbackAudioModel,
        systemPrompt: modelChannel.systemPrompt,
    };
}

function validDefault(model: string, models: string[]) {
    return models.includes(model) ? model : "";
}

function resolvePublicModel(model: string, models: string[], aliases: Map<string, string>) {
    return models.includes(model) ? model : aliases.get(model) || model;
}

function preferredModel(models: string[], predicate: (model: string) => boolean) {
    return models.find(predicate) || "";
}

function isVideoModelName(model: string) {
    const value = model.toLowerCase();
    return value.includes("seedance") || value.includes("video") || value.includes("sora") || value.includes("veo") || value.includes("kling") || value.includes("wan") || value.includes("hailuo");
}

function isImageModelName(model: string) {
    const value = model.toLowerCase();
    return !isVideoModelName(model) && !isAudioModelName(model) && (value.includes("seedream") || value.includes("gpt-image") || value.includes("image") || value.includes("dall-e") || value.includes("dalle") || value.includes("imagen") || value.includes("flux") || value.includes("sdxl") || value.includes("stable-diffusion") || value.includes("midjourney"));
}

function isAudioModelName(model: string) {
    const value = model.toLowerCase();
    return value.includes("audio") || value.includes("tts") || value.includes("speech") || value.includes("voice") || value.includes("music") || value.includes("sound");
}

function isTextModelName(model: string) {
    return !isImageModelName(model) && !isVideoModelName(model) && !isAudioModelName(model);
}

export function inferLocalModelType(model: string): ModelCapability {
    if (isImageModelName(model)) return "image";
    if (isVideoModelName(model)) return "video";
    if (isAudioModelName(model)) return "audio";
    return "text";
}

export function modelMatchesCapability(model: string, capability?: ModelCapability) {
    if (!capability) return true;
    if (capability === "image") return isImageModelName(model);
    if (capability === "video") return isVideoModelName(model);
    if (capability === "audio") return isAudioModelName(model);
    return isTextModelName(model);
}

function modelMatchesRemoteCapability(model: string, capability: ModelCapability | undefined, modelTypes: Map<string, AdminModelType>) {
    const type = modelTypes.get(model);
    return type ? !capability || type === capability : modelMatchesCapability(model, capability);
}

export function filterModelsByCapability(models: string[], capability?: ModelCapability, modelTypes = new Map<string, AdminModelType>()) {
    return capability ? models.filter((model) => modelMatchesRemoteCapability(model, capability, modelTypes)) : models;
}

export function selectableModelsByCapability(config: AiConfig, capability?: ModelCapability) {
    if (config.channelMode === "local" && config.localProviders.length) return selectableLocalModelOptions(config, capability).map((item) => item.value);
    if (!capability) return config.models;
    return config[modelListKey(capability)];
}

export function selectableLocalModelOptions(config: AiConfig, capability?: ModelCapability): LocalModelOption[] {
    const providers = normalizedLocalProviders(config);
    if (!providers.length) {
        return selectableLegacyLocalModels(config, capability).map((model) => ({
            value: model,
            model,
            name: model,
            providerId: "",
            providerName: "本地直连",
            type: inferLocalModelType(model),
        }));
    }
    const options = providers
        .filter((provider) => provider.enabled !== false)
        .flatMap((provider, providerIndex) =>
            provider.models.filter((model) => model.enabled && model.apiRoutes.some((route) => route.enabled)).map((model) => ({
                value: localModelOptionValue(provider.id, model.model),
                model: model.model,
                name: model.name || model.model,
                providerId: provider.id,
                providerName: localProviderPublicName(provider.name, providerIndex),
                type: model.type,
            })),
        );
    if (!capability) return options;
    return options.filter((item) => item.type === capability);
}

function localProviderPublicName(name: string, index: number) {
    const value = name.trim();
    return !value || /^https?:\/\//i.test(value) ? `本地供应商 ${index + 1}` : value;
}

export function modelOptionName(value: string) {
    const text = value.trim();
    const parts = text.split("||");
    if (parts.length > 1) return parts[parts.length - 1].trim();
    if (/^https?:\/\//i.test(text)) {
        try {
            const url = new URL(text);
            return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "").trim() || url.hostname;
        } catch {
            return text.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] || text;
        }
    }
    return text;
}

export function normalizeModelOptionValue(value?: string) {
    return (value || "").trim();
}

export function localModelOptionValue(providerId: string, model: string) {
    return `local:${providerId}||${model.trim()}`;
}

export function parseLocalModelOptionValue(value?: string) {
    const text = (value || "").trim();
    const match = text.match(/^local:([^|]+)\|\|(.+)$/);
    return match ? { providerId: match[1], model: match[2].trim() } : { providerId: "", model: modelOptionName(text) };
}

export function resolveLocalModelConfig(config: AiConfig, selectedModel?: string): AiConfig {
    if (config.channelMode !== "local") return config;
    const providers = normalizedLocalProviders(config);
    if (!providers.length) return config;
    const parsed = parseLocalModelOptionValue(selectedModel || config.model || config.imageModel || config.videoModel || config.textModel || config.audioModel);
    const provider = providers.find((item) => item.id === parsed.providerId) || providers.find((item) => item.id === config.localProviderId) || providers[0];
    const model = provider.models.find((item) => item.model === parsed.model)?.model || parsed.model;
    return {
        ...config,
        localProviderId: provider.id,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: model || parseLocalModelOptionValue(config.model).model || config.model,
        imageModel: parseLocalModelOptionValue(config.imageModel).model || config.imageModel,
        videoModel: parseLocalModelOptionValue(config.videoModel).model || config.videoModel,
        textModel: parseLocalModelOptionValue(config.textModel).model || config.textModel,
        audioModel: parseLocalModelOptionValue(config.audioModel).model || config.audioModel,
    };
}

export function resolveLocalProviderModel(config: AiConfig, selectedModel?: string) {
    if (config.channelMode !== "local") return null;
    const parsed = parseLocalModelOptionValue(selectedModel || config.model || config.imageModel || config.videoModel || config.textModel || config.audioModel);
    const providers = normalizedLocalProviders(config);
    const provider = providers.find((item) => item.id === parsed.providerId) || providers.find((item) => item.id === config.localProviderId) || providers[0];
    if (!provider) return null;
    const model = provider.models.find((item) => item.model === parsed.model);
    return model ? { provider, model } : null;
}

export function resolveLocalModelApiRoute(config: AiConfig, selectedModel: string | undefined, allowedPaths: string[], fallbackPath: string) {
    if (config.channelMode !== "local") return fallbackPath;
    const resolved = resolveLocalProviderModel(config, selectedModel);
    if (!resolved) return fallbackPath;
    return allowedPaths.find((path) => resolved.model.apiRoutes.some((route) => route.path === path && route.enabled)) || fallbackPath;
}

export function resolveModelChannel(config: AiConfig, value: string) {
    const parsedLocal = config.channelMode === "local" ? parseLocalModelOptionValue(value) : null;
    const provider = parsedLocal?.providerId ? normalizedLocalProviders(config).find((item) => item.id === parsedLocal.providerId) : null;
    return {
        id: config.channelMode,
        name: config.channelMode === "remote" ? "云端" : provider?.name || "本地直连",
        model: parsedLocal?.model || modelOptionName(value),
    };
}

function modelListKey(capability: ModelCapability) {
    return `${capability}Models` as "imageModels" | "videoModels" | "textModels" | "audioModels";
}

function isAiConfigReady(config: AiConfig, model: string) {
    if (!model.trim()) return false;
    if (config.channelMode === "remote") return true;
    const resolved = resolveLocalProviderModel(config, model);
    return resolved ? resolved.provider.enabled && resolved.model.enabled && resolved.model.apiRoutes.some((route) => route.enabled) && Boolean(resolved.provider.baseUrl.trim()) : Boolean(resolveLocalModelConfig(config, model).baseUrl.trim());
}

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set, get) => ({
            config: defaultConfig,
            publicSettings: null,
            isPublicSettingsLoading: false,
            isConfigOpen: false,
            shouldPromptContinue: false,
            updateConfig: (key, value) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        [key]: value,
                    },
                })),
            loadPublicSettings: async () => {
                if (get().isPublicSettingsLoading) return;
                set({ isPublicSettingsLoading: true });
                try {
                    set({ publicSettings: await apiGet<AdminPublicSettings>("/api/settings") });
                } finally {
                    set({ isPublicSettingsLoading: false });
                }
            },
            isAiConfigReady: (config, model) => isAiConfigReady(config, model),
            openConfigDialog: (shouldPromptContinue = false) => set({ isConfigOpen: true, shouldPromptContinue }),
            setConfigDialogOpen: (isConfigOpen) => set({ isConfigOpen }),
            clearPromptContinue: () => set({ shouldPromptContinue: false }),
        }),
        {
            name: CONFIG_STORE_KEY,
            partialize: (state) => ({ config: state.config }),
            merge: (persisted, current) => {
                const persistedConfig = ((persisted as Partial<ConfigStore>).config || {}) as Partial<AiConfig>;
                const config = { ...defaultConfig, ...persistedConfig };
                const localProviders = normalizeLocalProviders(config.localProviders?.length ? config.localProviders : legacyLocalProviders(config));
                const imageModels = Array.isArray(persistedConfig.imageModels) ? normalizeModelList(config.imageModels) : filterModelsByCapability(config.models, "image");
                const videoModels = Array.isArray(persistedConfig.videoModels) ? normalizeModelList(config.videoModels) : filterModelsByCapability(config.models, "video");
                const textModels = Array.isArray(persistedConfig.textModels) ? normalizeModelList(config.textModels) : filterModelsByCapability(config.models, "text");
                const audioModels = Array.isArray(persistedConfig.audioModels) ? normalizeModelList(config.audioModels) : filterModelsByCapability(config.models, "audio");
                return {
                    ...current,
                    config: {
                        ...config,
                        localProviders,
                        localProviderId: config.localProviderId || localProviders[0]?.id || "",
                        channelMode: config.channelMode || "remote",
                        model: clearLegacyBuiltInLocalModel(config.model, config.models),
                        imageModel: clearLegacyBuiltInLocalModel(config.imageModel || config.model, imageModels.length ? imageModels : config.models),
                        videoModel: clearLegacyBuiltInLocalModel(config.videoModel, videoModels.length ? videoModels : config.models),
                        textModel: clearLegacyBuiltInLocalModel(config.textModel || config.model, textModels.length ? textModels : config.models),
                        audioModel: clearLegacyBuiltInLocalModel(config.audioModel, audioModels.length ? audioModels : config.models),
                        audioVoice: config.audioVoice || defaultConfig.audioVoice,
                        audioFormat: config.audioFormat || defaultConfig.audioFormat,
                        audioSpeed: config.audioSpeed || defaultConfig.audioSpeed,
                        audioInstructions: config.audioInstructions || "",
                        videoSeconds: config.videoSeconds || "6",
                        vquality: config.vquality || "720",
                        videoGenerateAudio: config.videoGenerateAudio || "true",
                        videoWatermark: config.videoWatermark || "false",
                        quality: config.quality === "auto" ? "low" : config.quality || "low",
                        canvasImageCount: config.canvasImageCount || "3",
                        defaultStyleName: config.defaultStyleName || "",
                        imageModels,
                        videoModels,
                        textModels,
                        audioModels,
                    },
                };
            },
        },
    ),
);

function normalizeModelList(models: string[]) {
    return Array.from(new Set((models || []).map((model) => model.trim()).filter(Boolean)));
}

export function createLocalProviderModel(model: string, enabled = false, source: LocalProviderModel["source"] = "fetched"): LocalProviderModel {
    const id = model.trim();
    const type = inferLocalModelType(id);
    return { model: id, name: id, type, enabled, source, apiRoutes: defaultModelApiRoutes(type) };
}

export function normalizeLocalProviderModels(models?: Array<Partial<LocalProviderModel>>) {
    const seen = new Set<string>();
    return (models || [])
        .map((item) => {
            const model = item.model?.trim() || "";
            const type = item.type || inferLocalModelType(model);
            return {
                model,
                name: item.name?.trim() || model,
                type,
                enabled: item.enabled === true,
                source: item.source === "manual" ? "manual" : "fetched",
                apiRoutes: normalizeModelApiRoutes(type, item.apiRoutes),
            };
        })
        .filter((item) => {
            if (!item.model || seen.has(item.model)) return false;
            seen.add(item.model);
            return true;
        });
}

export function localProviderModelIds(models: LocalProviderModel[], enabledOnly = false) {
    return models.filter((model) => !enabledOnly || model.enabled).map((model) => model.model);
}

export function normalizeLocalProviders(providers?: Partial<LocalModelProvider>[]) {
    return (providers || [])
        .map((provider, index) => ({
            id: provider.id?.trim() || `local-provider-${index + 1}`,
            name: provider.name?.trim() || `本地供应商 ${index + 1}`,
            protocol: "openai" as const,
            baseUrl: provider.baseUrl?.trim() || "",
            apiKey: provider.apiKey || "",
            enabled: provider.enabled !== false,
            models: normalizeLocalProviderModels(provider.models),
        }))
        .filter((provider) => provider.baseUrl || provider.models.length || provider.name);
}

function normalizedLocalProviders(config: AiConfig) {
    return normalizeLocalProviders(config.localProviders);
}

function legacyLocalProviders(config: Partial<AiConfig>): LocalModelProvider[] {
    const baseUrl = config.baseUrl?.trim() || "";
    const apiKey = config.apiKey || "";
    const models = normalizeModelList([...(config.models || []), ...(config.imageModels || []), ...(config.videoModels || []), ...(config.textModels || []), ...(config.audioModels || [])]).map((model) => createLocalProviderModel(model, true));
    if (!baseUrl && !models.length) return [];
    return [
        {
            id: "legacy-local",
            name: "本地直连",
            protocol: "openai",
            baseUrl,
            apiKey,
            enabled: true,
            models,
        },
    ];
}

function resolveActiveLocalProviderConfig(config: AiConfig) {
    const providers = normalizedLocalProviders(config);
    const provider = providers.find((item) => item.id === config.localProviderId) || providers[0];
    return provider ? { ...config, localProviderId: provider.id, baseUrl: provider.baseUrl, apiKey: provider.apiKey } : config;
}

function selectableLegacyLocalModels(config: AiConfig, capability?: ModelCapability) {
    if (capability) return config[modelListKey(capability)];
    return normalizeModelList([...config.imageModels, ...config.videoModels, ...config.textModels, ...config.audioModels, ...config.models]);
}

function clearLegacyBuiltInLocalModel(model: string, availableModels: string[]) {
    const value = model.trim();
    if (!legacyBuiltInLocalModels.has(value)) return value;
    return normalizeModelList(availableModels).includes(value) ? value : "";
}

export function useEffectiveConfig() {
    const config = useConfigStore((state) => state.config);
    const modelChannel = useConfigStore((state) => state.publicSettings?.modelChannel || null);
    return useMemo(() => resolveEffectiveConfig(config, modelChannel), [config, modelChannel]);
}

export function buildApiUrl(baseUrl: string, path: string) {
    let normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    normalizedBaseUrl = normalizeArkPlanBaseUrl(normalizedBaseUrl);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    if (normalizedPath.startsWith("/v1/")) {
        return lowerBaseUrl.endsWith("/v1") ? `${normalizedBaseUrl}${normalizedPath.slice(3)}` : `${normalizedBaseUrl}${normalizedPath}`;
    }
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/api/v3") || lowerBaseUrl.endsWith("/api/plan/v3") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
    return `${apiBaseUrl}${normalizedPath}`;
}

function normalizeArkPlanBaseUrl(baseUrl: string) {
    try {
        const url = new URL(baseUrl);
        const path = url.pathname.replace(/\/+$/, "");
        const lowerPath = path.toLowerCase();
        const arkPlanIndex = lowerPath.indexOf("/api/plan/v3");
        if (arkPlanIndex < 0) return baseUrl;
        const end = arkPlanIndex + "/api/plan/v3".length;
        if (lowerPath.length !== end && lowerPath[end] !== "/") return baseUrl;
        url.pathname = path.slice(0, end);
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/+$/, "");
    } catch {
        return baseUrl;
    }
}
