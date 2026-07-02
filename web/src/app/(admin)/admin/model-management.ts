import type { AdminModelApiRoute, AdminModelChannel, AdminModelCost, AdminModelType, AdminProviderModel, AdminResolutionCost, AdminSettings } from "@/services/api/admin";

export const modelTypeOptions: Array<{ label: string; value: AdminModelType }> = [
    { label: "文本", value: "text" },
    { label: "图片", value: "image" },
    { label: "视频", value: "video" },
    { label: "音频", value: "audio" },
];

export const modelTypeLabels: Record<AdminModelType, string> = {
    text: "文本",
    image: "图片",
    video: "视频",
    audio: "音频",
};

export const modelApiRouteLabels: Record<string, string> = {
    "/chat/completions": "Chat Completions",
    "/images/generations": "Images Generations",
    "/images/edits": "Images Edits",
    "/responses": "Responses",
    "/v1/async/generations": "Unified Async Generations",
    "/v1/videos": "Newtoken Async",
    "/video/generations": "Video Generations",
    "/v1/video/create": "Yunwu Video Create",
    "/videos": "Videos",
    "/async/generations": "Async Generations",
    "/video/create": "LNAPI Video Create",
    "/audio/speech": "Audio Speech",
};

export const defaultImageCosts: AdminResolutionCost[] = [
    { resolution: "1k", credits: 10, enabled: true },
    { resolution: "2k", credits: 20, enabled: true },
    { resolution: "4k", credits: 40, enabled: true },
];

export const modelApiRoutes: Record<AdminModelType, AdminModelApiRoute[]> = {
    text: [{ path: "/chat/completions", enabled: true }],
    image: [
        { path: "/images/generations", enabled: true },
        { path: "/images/edits", enabled: false },
        { path: "/chat/completions", enabled: false },
        { path: "/responses", enabled: false },
        { path: "/v1/async/generations", enabled: false },
        { path: "/v1/videos", enabled: false },
    ],
    video: [
        { path: "/chat/completions", enabled: false },
        { path: "/video/generations", enabled: true },
        { path: "/v1/video/create", enabled: false },
        { path: "/videos", enabled: false },
        { path: "/v1/async/generations", enabled: false },
        { path: "/async/generations", enabled: false },
        { path: "/video/create", enabled: false },
    ],
    audio: [{ path: "/audio/speech", enabled: true }],
};

export const imageCreditResolutions: AdminResolutionCost[] = [
    { resolution: "1k", credits: 10, enabled: true },
    { resolution: "2k", credits: 20, enabled: true },
    { resolution: "4k", credits: 40, enabled: true },
];

export function normalizeSettings(settings: AdminSettings): AdminSettings {
    const channels = (settings.private.channels || []).map(normalizeChannel);
    return syncPublicModelChannel({ ...settings, private: { ...settings.private, channels } });
}

export function syncPublicModelChannel(settings: AdminSettings): AdminSettings {
    const costs = new Map<string, AdminModelCost>();
    const availableModels: string[] = [];
    for (const channel of settings.private.channels) {
        if (!channel.enabled) continue;
        for (const item of channel.modelItems) {
            if (!item.selected || !item.enabled) continue;
            const modelId = publicModelId(channel, item);
            availableModels.push(modelId);
            const cost = modelToCost(item, channel);
            costs.set(modelId, costs.has(modelId) ? mergeModelCost(costs.get(modelId)!, cost) : cost);
        }
    }
    const models = unique(availableModels);
    const textModels = models.filter((model) => costs.get(model)?.type === "text");
    const imageModels = models.filter((model) => costs.get(model)?.type === "image");
    const videoModels = models.filter((model) => costs.get(model)?.type === "video");
    return {
        ...settings,
        public: {
            ...settings.public,
            modelChannel: {
                ...settings.public.modelChannel,
                availableModels: models,
                modelCosts: Array.from(costs.values()),
                defaultModel: pickDefault(settings.public.modelChannel.defaultModel, models),
                defaultTextModel: pickDefault(settings.public.modelChannel.defaultTextModel, textModels.length ? textModels : models),
                defaultImageModel: pickDefault(settings.public.modelChannel.defaultImageModel, imageModels.length ? imageModels : models),
                defaultVideoModel: pickDefault(settings.public.modelChannel.defaultVideoModel, videoModels.length ? videoModels : models),
            },
        },
    };
}

export function normalizeChannel(channel: Partial<AdminModelChannel>): AdminModelChannel {
    const modelItems = normalizeProviderModels(channel.modelItems?.length ? channel.modelItems : (channel.models || []).map((model) => ({ model, selected: true, enabled: true })));
    return {
        protocol: "openai",
        name: channel.name || "",
        baseUrl: channel.baseUrl || "",
        apiKey: channel.apiKey || "",
        hasApiKey: channel.hasApiKey === true || Boolean(channel.apiKey?.trim()),
        models: modelItems.filter((item) => item.selected && item.enabled).map((item) => item.model),
        modelItems,
        weight: Math.max(1, Number(channel.weight) || 1),
        enabled: channel.enabled !== false,
        remark: channel.remark || "",
    };
}

export function normalizeProviderModels(items: Array<Partial<AdminProviderModel>>) {
    return unique(items.map((item) => item.model || "")).map((model) => normalizeProviderModel({ ...defaultProviderModel(model), ...items.find((item) => item.model === model), model }));
}

export function normalizeProviderModel(item: Partial<AdminProviderModel>): AdminProviderModel {
    const model = item.model || "";
    const type = item.type || inferModelType(model);
    const defaultCredits = type === "text" ? 1 : type === "image" ? 10 : type === "video" ? 5 : 1;
    return {
        model,
        name: item.name?.trim() || model,
        type,
        selected: item.selected === true || item.enabled === true,
        enabled: item.enabled === true,
        thumbnailUrl: item.thumbnailUrl?.trim() || "",
        providerDisplayName: item.providerDisplayName?.trim() || "",
        description: item.description?.trim() || "",
        tags: unique(item.tags || []),
        credits: nonNegativeNumber(item.credits, defaultCredits),
        resolutionCosts: type === "image" ? normalizeResolutionCosts(item.resolutionCosts) : [],
        secondCredits: type === "video" ? nonNegativeNumber(item.secondCredits, 5) : 0,
        apiRoutes: normalizeModelApiRoutes(type, item.apiRoutes),
    };
}

export function defaultProviderModel(model: string): AdminProviderModel {
    const type = inferModelType(model);
    return normalizeProviderModel({ model, type, selected: false, enabled: false });
}

export function modelToCost(item: AdminProviderModel, channel: Pick<AdminModelChannel, "name" | "baseUrl">): AdminModelCost {
    const providerName = channel.name.trim();
    return { model: publicModelId(channel, item), upstreamModel: item.model, name: item.name, type: item.type, thumbnailUrl: item.thumbnailUrl, providerName, providerEndpoint: "", providerDisplayName: item.providerDisplayName || providerName, description: item.description, tags: item.tags, credits: item.credits, resolutionCosts: item.resolutionCosts, secondCredits: item.secondCredits, apiRoutes: item.apiRoutes };
}

function mergeModelCost(base: AdminModelCost, next: AdminModelCost): AdminModelCost {
    return {
        ...base,
        upstreamModel: base.upstreamModel || next.upstreamModel,
        name: base.name && base.name !== base.model ? base.name : next.name || base.name,
        type: base.type || next.type,
        thumbnailUrl: base.thumbnailUrl || next.thumbnailUrl,
        providerName: base.providerName || next.providerName,
        providerEndpoint: base.providerEndpoint || next.providerEndpoint,
        providerDisplayName: unique([...(base.providerDisplayName || "").split(" / "), ...(next.providerDisplayName || "").split(" / ")]).join(" / "),
        description: mergeDescription(base.description, next.description),
        tags: unique([...(base.tags || []), ...(next.tags || [])]),
        credits: base.credits > 0 ? base.credits : next.credits,
        resolutionCosts: base.resolutionCosts?.length ? base.resolutionCosts : next.resolutionCosts,
        secondCredits: base.secondCredits > 0 ? base.secondCredits : next.secondCredits,
    };
}

function mergeDescription(base: string, next: string) {
    if (!base) return next;
    if (!next || base.includes(next)) return base;
    return `${base}\n${next}`;
}

function publicModelId(channel: Pick<AdminModelChannel, "name" | "baseUrl">, item: Pick<AdminProviderModel, "model">) {
    return [channel.name.trim(), item.model.trim()].join("||");
}

function normalizeEndpoint(value: string) {
    const endpoint = value.trim().replace(/\/+$/, "");
    try {
        const url = new URL(endpoint);
        const marker = "/api/plan/v3";
        const index = url.pathname.toLowerCase().indexOf(marker);
        if (index >= 0) {
            const end = index + marker.length;
            if (url.pathname.length === end || url.pathname[end] === "/") {
                url.pathname = url.pathname.slice(0, end);
                url.search = "";
                url.hash = "";
                return url.toString().replace(/\/+$/, "");
            }
        }
    } catch {
        // Keep the manually entered endpoint when it is not a full URL.
    }
    return endpoint;
}

export function setResolutionCost(items: AdminResolutionCost[], resolution: string, credits: number) {
    const next = items.filter((item) => item.resolution !== resolution);
    next.push({ resolution, credits, enabled: items.find((item) => item.resolution === resolution)?.enabled !== false });
    return next;
}

export function setResolutionEnabled(items: AdminResolutionCost[], resolution: string, enabled: boolean) {
    return normalizeResolutionCosts(items).map((item) => (item.resolution === resolution ? { ...item, enabled } : item));
}

export function normalizeResolutionCosts(items: Partial<AdminResolutionCost>[] | undefined) {
    const existing = new Map((items || []).map((item) => [item.resolution?.toLowerCase(), item]));
    return defaultImageCosts.map((fallback) => {
        const item = existing.get(fallback.resolution);
        return {
            resolution: fallback.resolution,
            credits: nonNegativeNumber(item?.credits, fallback.credits),
            enabled: item?.enabled !== false,
        };
    });
}

export function updateModelInChannels(channels: AdminModelChannel[], model: string, patch: Partial<AdminProviderModel>) {
    return channels.map((channel) =>
        normalizeChannel({
            ...channel,
            modelItems: channel.modelItems.map((item) => (item.model === model ? normalizeProviderModel({ ...item, ...patch }) : item)),
        }),
    );
}

export function enabledModelsByType(channels: AdminModelChannel[], type: AdminModelType) {
    return channels
        .filter((channel) => channel.enabled)
        .flatMap((channel) => channel.modelItems.filter((item) => item.selected && item.enabled && item.type === type).map((item) => ({ ...item, providerName: item.providerDisplayName || channel.name || "未命名供应商" })));
}

export function selectedModelsByType(channels: AdminModelChannel[], type: AdminModelType) {
    return channels
        .filter((channel) => channel.enabled)
        .flatMap((channel) => channel.modelItems.filter((item) => item.selected && item.type === type).map((item) => ({ ...item, providerName: item.providerDisplayName || channel.name || "未命名供应商" })));
}

export function inferModelType(model: string): AdminModelType {
    const value = model.toLowerCase();
    if (["audio", "tts", "speech", "voice", "music", "sound"].some((key) => value.includes(key))) return "audio";
    if (["video", "sora", "veo", "kling", "runway", "grok-imagine-video", "seedance", "wan", "hailuo"].some((key) => value.includes(key))) return "video";
    if (["image", "dall", "imagen", "flux", "sdxl", "stable", "midjourney", "gpt-image", "nano-banana", "seedream"].some((key) => value.includes(key))) return "image";
    return "text";
}

export function unique(items: string[]) {
    return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export function nonNegativeNumber(value: unknown, fallback: number) {
    if (value === undefined || value === null || value === "") return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
}

export function mergeApiKeys(current: AdminModelChannel[], saved: AdminModelChannel[]) {
    return current.map((item, index) => ({ ...item, apiKey: item.apiKey || saved[index]?.apiKey || "" }));
}

function pickDefault(current: string, models: string[]) {
    return models.includes(current) ? current : models[0] || "";
}

function normalizeModelApiRoutes(type: AdminModelType, routes: AdminModelApiRoute[] | undefined) {
    const defaults = modelApiRoutes[type];
    const existing = new Map((routes || []).map((route) => [normalizeRoutePath(route.path), route.enabled === true]));
    const seen = new Set<string>();
    return defaults
        .map((route) => ({ path: route.path, enabled: existing.has(route.path) ? existing.get(route.path) === true : route.enabled === true }))
        .filter((route) => {
            if (!route.path || seen.has(route.path)) return false;
            seen.add(route.path);
            return true;
        });
}

function normalizeRoutePath(path: string) {
    const value = path.trim();
    if (value === "/v1/chat/completions") return "/chat/completions";
    if (value === "/v1/images/generations") return "/images/generations";
    if (value === "/v1/images/edits") return "/images/edits";
    if (value === "/v1/responses") return "/responses";
    if (value === "/v1/audio/speech") return "/audio/speech";
    if (value === "/v1/videos/generations" || value === "/v1/video/generations") return "/video/generations";
    return value;
}
