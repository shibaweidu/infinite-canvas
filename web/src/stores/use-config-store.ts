"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { apiGet } from "@/services/api/request";
import type { AdminModelType, AdminPublicSettings } from "@/services/api/admin";

export type AiConfig = {
    channelMode: "remote" | "local";
    baseUrl: string;
    apiKey: string;
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
};

export const CONFIG_STORE_KEY = "infinite-canvas:ai_config_store";
export type ModelCapability = "image" | "video" | "text" | "audio";

export const defaultConfig: AiConfig = {
    channelMode: "local",
    baseUrl: "https://api.openai.com",
    apiKey: "",
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
    if (channelMode === "local" || !modelChannel) return { ...config, channelMode };
    const models = modelChannel.availableModels || [];
    const modelTypes = new Map((modelChannel.modelCosts || []).map((item) => [item.model, item.type]));
    const modelAliases = new Map((modelChannel.modelCosts || []).map((item) => [item.upstreamModel, item.model]).filter(([upstream]) => upstream));
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
    if (!capability) return config.models;
    return config[modelListKey(capability)];
}

export function modelOptionName(value: string) {
    const parts = value.split("||");
    return (parts.length >= 3 ? parts[parts.length - 1] : value).trim();
}

export function normalizeModelOptionValue(value?: string) {
    return (value || "").trim();
}

export function resolveModelChannel(config: AiConfig, value: string) {
    return {
        id: config.channelMode,
        name: config.channelMode === "remote" ? "云端" : "本地直连",
        model: modelOptionName(value),
    };
}

function modelListKey(capability: ModelCapability) {
    return `${capability}Models` as "imageModels" | "videoModels" | "textModels" | "audioModels";
}

function isAiConfigReady(config: AiConfig, model: string) {
    return Boolean(model.trim()) && (config.channelMode === "remote" || Boolean(config.baseUrl.trim() && config.apiKey.trim()));
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
                const imageModels = Array.isArray(persistedConfig.imageModels) ? normalizeModelList(config.imageModels) : filterModelsByCapability(config.models, "image");
                const videoModels = Array.isArray(persistedConfig.videoModels) ? normalizeModelList(config.videoModels) : filterModelsByCapability(config.models, "video");
                const textModels = Array.isArray(persistedConfig.textModels) ? normalizeModelList(config.textModels) : filterModelsByCapability(config.models, "text");
                const audioModels = Array.isArray(persistedConfig.audioModels) ? normalizeModelList(config.audioModels) : filterModelsByCapability(config.models, "audio");
                return {
                    ...current,
                    config: {
                        ...config,
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
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/api/v3") || lowerBaseUrl.endsWith("/api/plan/v3") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
    return `${apiBaseUrl}${path}`;
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
