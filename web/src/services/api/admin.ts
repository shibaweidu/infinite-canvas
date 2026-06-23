import { apiDelete, apiGet, apiPost, compactApiParams } from "@/services/api/request";
import type { Prompt, PromptListResponse } from "@/services/api/prompts";

export type AdminPromptCategory = {
    category: string;
    name: string;
    description: string;
    file: string;
    githubUrl: string;
    remote: boolean;
};

export type AdminUser = {
    id: string;
    username: string;
    email: string;
    displayName: string;
    avatarUrl: string;
    role: "user" | "admin";
    credits: number;
    affCode: string;
    affCount: number;
    inviterId: string;
    googleId: string;
    linuxDoId: string;
    status: "active" | "ban";
    lastLoginAt: string;
    createdAt: string;
    updatedAt: string;
};

export type AdminUserListResponse = {
    items: AdminUser[];
    total: number;
};

export type AdminCreditLog = {
    id: string;
    userId: string;
    type: string;
    amount: number;
    balance: number;
    relatedId: string;
    remark: string;
    extra: string;
    createdAt: string;
};

export type AdminCreditLogListResponse = {
    items: AdminCreditLog[];
    total: number;
};

export type AdminUserQuery = {
    keyword?: string;
    page?: number;
    pageSize?: number;
};

export async function fetchAdminUsers(token: string, query: AdminUserQuery = {}) {
    return apiGet<AdminUserListResponse>("/api/admin/users", compactApiParams(query), token);
}

export async function saveAdminUser(token: string, user: Partial<AdminUser> & { password?: string }) {
    return apiPost<AdminUser>("/api/admin/users", user, token);
}

export async function adjustAdminUserCredits(token: string, id: string, credits: number) {
    return apiPost<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}/credits`, { credits }, token);
}

export async function deleteAdminUser(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/users/${encodeURIComponent(id)}`, token);
}

export async function fetchAdminCreditLogs(token: string, query: AdminUserQuery = {}) {
    return apiGet<AdminCreditLogListResponse>("/api/admin/credit-logs", compactApiParams(query), token);
}

export async function saveAdminCreditLog(token: string, log: Partial<AdminCreditLog>) {
    return apiPost<AdminCreditLog>("/api/admin/credit-logs", log, token);
}

export async function deleteAdminCreditLog(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/credit-logs/${encodeURIComponent(id)}`, token);
}

export async function fetchAdminPromptCategories(token: string) {
    return apiGet<AdminPromptCategory[]>("/api/admin/prompt-categories", undefined, token);
}

export async function syncAdminPromptCategory(token: string, category: string) {
    return apiPost<AdminPromptCategory[]>("/api/admin/prompt-categories/sync", { category }, token);
}

export type AdminPromptQuery = {
    keyword?: string;
    category?: string;
    tag?: string[];
    page?: number;
    pageSize?: number;
};

export type AdminAsset = {
    id: string;
    title: string;
    type: "text" | "image" | "video";
    coverUrl: string;
    tags: string[];
    category: string;
    description: string;
    content: string;
    url: string;
    createdAt: string;
    updatedAt: string;
};

export type AdminAssetListResponse = {
    items: AdminAsset[];
    tags: string[];
    total: number;
};

export async function fetchAdminPrompts(token: string, query: AdminPromptQuery = {}) {
    return apiGet<PromptListResponse>("/api/admin/prompts", compactApiParams(query), token);
}

export async function saveAdminPrompt(token: string, prompt: Partial<Prompt>) {
    return apiPost<Prompt>("/api/admin/prompts", prompt, token);
}

export async function deleteAdminPrompt(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/prompts/${encodeURIComponent(id)}`, token);
}

export async function deleteAdminPrompts(token: string, ids: string[]) {
    return apiPost<boolean>("/api/admin/prompts/batch-delete", { ids }, token);
}

export type AdminAssetQuery = {
    keyword?: string;
    type?: string;
    tag?: string[];
    page?: number;
    pageSize?: number;
};

export async function fetchAdminAssets(token: string, query: AdminAssetQuery = {}) {
    return apiGet<AdminAssetListResponse>("/api/admin/assets", compactApiParams(query), token);
}

export async function saveAdminAsset(token: string, asset: Partial<AdminAsset>) {
    return apiPost<AdminAsset>("/api/admin/assets", asset, token);
}

export async function deleteAdminAsset(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/assets/${encodeURIComponent(id)}`, token);
}

export type AdminModelChannel = {
    protocol: "openai";
    name: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
    modelItems: AdminProviderModel[];
    weight: number;
    enabled: boolean;
    remark: string;
};

export type AdminModelType = "text" | "image" | "video" | "audio";

export type AdminResolutionCost = {
    resolution: string;
    credits: number;
};

export type AdminModelApiRoute = {
    path: string;
    enabled: boolean;
};

export type AdminProviderModel = {
    model: string;
    name: string;
    type: AdminModelType;
    selected: boolean;
    enabled: boolean;
    thumbnailUrl: string;
    providerDisplayName: string;
    description: string;
    tags: string[];
    credits: number;
    resolutionCosts: AdminResolutionCost[];
    secondCredits: number;
    apiRoutes: AdminModelApiRoute[];
};

export type AdminPublicModelChannelSettings = {
    availableModels: string[];
    modelCosts: AdminModelCost[];
    defaultModel: string;
    defaultImageModel: string;
    defaultVideoModel: string;
    defaultTextModel: string;
    systemPrompt: string;
    allowCustomChannel: boolean;
};

export type AdminProjectVisualStyle = {
    category: string;
    name: string;
    prompt: string;
    coverUrl: string;
    previewUrls?: string[];
};

export type AdminProjectStoryPreset = {
    title: string;
    text: string;
};

export type AdminProjectBriefSettings = {
    genres: string[];
    styleCategories: string[];
    visualStyles: AdminProjectVisualStyle[];
    storyPresets: AdminProjectStoryPreset[];
};

export type AdminSiteNavigationItem = {
    id: string;
    label: string;
    path: string;
    enabled: boolean;
    sort: number;
};

export type AdminSiteSettings = {
    logoUrl: string;
    name: string;
    slogan: string;
    navigation: AdminSiteNavigationItem[];
};

export type AdminModelCost = {
    model: string;
    upstreamModel: string;
    name: string;
    type: AdminModelType;
    thumbnailUrl: string;
    providerName: string;
    providerEndpoint: string;
    providerDisplayName: string;
    description: string;
    tags: string[];
    credits: number;
    resolutionCosts: AdminResolutionCost[];
    secondCredits: number;
};

export type AdminPublicSettings = {
    modelChannel: AdminPublicModelChannelSettings;
    projectBrief: AdminProjectBriefSettings;
    auth: {
        allowRegister: boolean;
        emailRegister: {
            enabled: boolean;
            emailRequired: boolean;
            codeEnabled: boolean;
        };
        linuxDo: {
            enabled: boolean;
        };
        google: {
            enabled: boolean;
        };
    };
    objectStorage: {
        enabled: boolean;
        provider: string;
        bucket: string;
        region: string;
        publicUrl: string;
    };
    site: AdminSiteSettings;
};

export type AdminPrivateSettings = {
    channels: AdminModelChannel[];
    promptSync: {
        enabled: boolean;
        cron: string;
    };
    auth: {
        email: {
            smtpHost: string;
            smtpPort: number;
            smtpUsername: string;
            smtpPassword: string;
            fromEmail: string;
            fromName: string;
            subject: string;
        };
        linuxDo: {
            clientId: string;
            clientSecret: string;
        };
        google: {
            clientId: string;
            clientSecret: string;
        };
    };
    objectStorage: {
        enabled: boolean;
        provider: string;
        endpoint: string;
        region: string;
        bucket: string;
        accessKeyId: string;
        secretAccessKey: string;
        publicUrl: string;
        prefix: string;
        forcePathStyle: boolean;
    };
};

export type AdminSettings = {
    public: AdminPublicSettings;
    private: AdminPrivateSettings;
};

export async function fetchAdminSettings(token: string) {
    return apiGet<AdminSettings>("/api/admin/settings", undefined, token);
}

export async function saveAdminSettings(token: string, settings: AdminSettings) {
    return apiPost<AdminSettings>("/api/admin/settings", settings, token);
}

export type AdminChannelActionRequest = {
    index?: number;
    channel: AdminModelChannel;
    model?: string;
};

export async function fetchChannelModels(token: string, payload: AdminChannelActionRequest) {
    return apiPost<string[]>("/api/admin/settings/channel-models", payload, token);
}

export async function testChannelModel(token: string, payload: AdminChannelActionRequest) {
    return apiPost<string>("/api/admin/settings/channel-test", payload, token);
}
