import { apiDelete, apiGet, apiPost, compactApiParams } from "@/services/api/request";
import axios from "axios";
import type { Prompt, PromptListResponse } from "@/services/api/prompts";
import type { HomeCategory, HomeSlide, HomeTag, HomeWork, HomeWorkListResponse, HomeWorkQuery } from "@/services/api/home";

export type AdminPromptCategory = {
    category: string;
    name: string;
    description: string;
    file: string;
    githubUrl: string;
    remote: boolean;
    updatedAt: string;
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
    taskConcurrency: number;
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

export type AdminOperationLog = {
    id: string;
    userId: string;
    username: string;
    method: string;
    path: string;
    query: string;
    ip: string;
    userAgent: string;
    status: number;
    duration: number;
    createdAt: string;
};

export type AdminOperationLogListResponse = {
    items: AdminOperationLog[];
    total: number;
};

export type AdminSystemTask = {
    id: string;
    type: string;
    status: "pending" | "running" | "success" | "failed";
    title: string;
    payload: string;
    result: string;
    error: string;
    createdBy: string;
    startedAt: string;
    finishedAt: string;
    createdAt: string;
    updatedAt: string;
};

export type AdminSystemTaskListResponse = {
    items: AdminSystemTask[];
    total: number;
};

export type AdminErrorLog = {
    id: string;
    source: string;
    message: string;
    detail: string;
    method: string;
    path: string;
    userId: string;
    ip: string;
    userAgent: string;
    createdAt: string;
};

export type AdminErrorLogListResponse = {
    items: AdminErrorLog[];
    total: number;
};

export type AdminDatabaseStatus = {
    driver: string;
    dsn: string;
    notes: string[];
};

export type AdminServerStatus = {
    startedAt: string;
    serverTime: string;
    uptimeSeconds: number;
    os: string;
    arch: string;
    cpuCores: number;
    goVersion: string;
    goroutines: number;
    memory: {
        alloc: number;
        sys: number;
        heapAlloc: number;
        heapInuse: number;
        numGc: number;
    };
    database: {
        openConnections: number;
        inUse: number;
        idle: number;
        waitCount: number;
        waitDurationMs: number;
    };
    taskQueue: {
        defaultUserConcurrency: number;
        pending: number;
        running: number;
        success: number;
        failed: number;
        byType: Record<string, number>;
    };
    dataDir: {
        path: string;
        size: number;
    };
};

export type AdminBackupFile = {
    name: string;
    path: string;
    size: number;
    createdAt: string;
};

export type AdminAnnouncement = {
    id: string;
    title: string;
    summary: string;
    content: string;
    pinned: boolean;
    enabled: boolean;
    sort: number;
    publishedAt: string;
    createdAt: string;
    updatedAt: string;
};

export type AdminAnnouncementListResponse = {
    items: AdminAnnouncement[];
    total: number;
};

export type AdminUploadedObject = {
    url: string;
    key: string;
    mimeType: string;
    bytes: number;
};

export type AdminBillingBenefit = {
    text: string;
    tag: string;
};

export type AdminSubscriptionPlan = {
    id: string;
    name: string;
    description: string;
    price: number;
    originalPrice: number;
    credits: number;
    durationDays: number;
    priceCycle: string;
    buttonText: string;
    creditLabel: string;
    creditRateText: string;
    benefits: AdminBillingBenefit[];
    enabled: boolean;
    sort: number;
    createdAt: string;
    updatedAt: string;
};

export type AdminCreditPackage = {
    id: string;
    name: string;
    description: string;
    price: number;
    originalPrice: number;
    credits: number;
    bonusCredits: number;
    priceCycle: string;
    buttonText: string;
    creditLabel: string;
    creditRateText: string;
    benefits: AdminBillingBenefit[];
    enabled: boolean;
    sort: number;
    createdAt: string;
    updatedAt: string;
};

export type AdminPaymentSettings = {
    enabled: boolean;
    provider: "epay";
    gatewayUrl: string;
    pid: string;
    key?: string;
    hasKey?: boolean;
    siteName: string;
    payType: string;
    notifyUrl: string;
    returnUrl: string;
    createdAt: string;
    updatedAt: string;
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

export async function fetchAdminOperationLogs(token: string, query: AdminUserQuery = {}) {
    return apiGet<AdminOperationLogListResponse>("/api/admin/operation-logs", compactApiParams(query), token);
}

export async function fetchAdminSystemTasks(token: string, query: AdminUserQuery = {}) {
    return apiGet<AdminSystemTaskListResponse>("/api/admin/system-tasks", compactApiParams(query), token);
}

export async function fetchAdminErrorLogs(token: string, query: AdminUserQuery = {}) {
    return apiGet<AdminErrorLogListResponse>("/api/admin/error-logs", compactApiParams(query), token);
}

export async function fetchAdminDatabaseStatus(token: string) {
    return apiGet<AdminDatabaseStatus>("/api/admin/database/status", undefined, token);
}

export async function fetchAdminServerStatus(token: string) {
    return apiGet<AdminServerStatus>("/api/admin/server/status", undefined, token);
}

export async function fetchAdminDatabaseBackups(token: string) {
    return apiGet<AdminBackupFile[]>("/api/admin/database/backups", undefined, token);
}

export async function createAdminDatabaseBackup(token: string) {
    return apiPost<AdminSystemTask>("/api/admin/database/backups", {}, token);
}

export async function saveAdminCreditLog(token: string, log: Partial<AdminCreditLog>) {
    return apiPost<AdminCreditLog>("/api/admin/credit-logs", log, token);
}

export async function deleteAdminCreditLog(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/credit-logs/${encodeURIComponent(id)}`, token);
}

export async function fetchAdminAnnouncements(token: string, query: AdminUserQuery = {}) {
    return apiGet<AdminAnnouncementListResponse>("/api/admin/announcements", compactApiParams(query), token);
}

export async function saveAdminAnnouncement(token: string, item: Partial<AdminAnnouncement>) {
    return apiPost<AdminAnnouncement>("/api/admin/announcements", item, token);
}

export async function deleteAdminAnnouncement(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/announcements/${encodeURIComponent(id)}`, token);
}

export type AdminHomeWorkQuery = HomeWorkQuery & { status?: string };

export async function fetchAdminHomeSlides(token: string) {
    return apiGet<HomeSlide[]>("/api/admin/home/slides", undefined, token);
}

export async function saveAdminHomeSlide(token: string, item: Partial<HomeSlide>) {
    return apiPost<HomeSlide>("/api/admin/home/slides", item, token);
}

export async function deleteAdminHomeSlide(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/home/slides/${encodeURIComponent(id)}`, token);
}

export async function fetchAdminHomeWorks(token: string, query: AdminHomeWorkQuery = {}) {
    return apiGet<HomeWorkListResponse>("/api/admin/home/works", compactApiParams(query), token);
}

export async function saveAdminHomeWork(token: string, item: Partial<HomeWork>) {
    return apiPost<HomeWork>("/api/admin/home/works", item, token);
}

export type AdminHomeWorkImportResult = Partial<HomeWork> & {
    sourceUrl: string;
};

export async function importAdminHomeWorkFromUrl(token: string, url: string, model?: string) {
    return apiPost<AdminHomeWorkImportResult>("/api/admin/home/works/import-url", { url, model }, token);
}

export async function deleteAdminHomeWork(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/home/works/${encodeURIComponent(id)}`, token);
}

export async function fetchAdminHomeCategories(token: string) {
    return apiGet<HomeCategory[]>("/api/admin/home/categories", undefined, token);
}

export async function saveAdminHomeCategory(token: string, item: Partial<HomeCategory>) {
    return apiPost<HomeCategory>("/api/admin/home/categories", item, token);
}

export async function deleteAdminHomeCategory(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/home/categories/${encodeURIComponent(id)}`, token);
}

export async function fetchAdminHomeTags(token: string) {
    return apiGet<HomeTag[]>("/api/admin/home/tags", undefined, token);
}

export async function saveAdminHomeTag(token: string, item: Partial<HomeTag>) {
    return apiPost<HomeTag>("/api/admin/home/tags", item, token);
}

export async function deleteAdminHomeTag(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/home/tags/${encodeURIComponent(id)}`, token);
}

export async function uploadAdminHomeMedia(token: string, file: File) {
    const body = new FormData();
    body.append("file", file, file.name);
    const response = await axios.post<{ code: number; data: AdminUploadedObject; msg: string }>("/api/admin/home/media", body, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (response.data.code !== 0) throw new Error(response.data.msg || "媒体上传失败");
    return response.data.data;
}

export async function uploadAdminAnnouncementImage(token: string, file: File) {
    const body = new FormData();
    body.append("file", file, file.name);
    const response = await axios.post<{ code: number; data: AdminUploadedObject; msg: string }>("/api/admin/announcements/images", body, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (response.data.code !== 0) throw new Error(response.data.msg || "图片上传失败");
    return response.data.data;
}

export async function fetchAdminSubscriptionPlans(token: string) {
    return apiGet<AdminSubscriptionPlan[]>("/api/admin/billing/subscription-plans", undefined, token);
}

export async function saveAdminSubscriptionPlan(token: string, item: Partial<AdminSubscriptionPlan>) {
    return apiPost<AdminSubscriptionPlan>("/api/admin/billing/subscription-plans", item, token);
}

export async function deleteAdminSubscriptionPlan(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/billing/subscription-plans/${encodeURIComponent(id)}`, token);
}

export async function fetchAdminCreditPackages(token: string) {
    return apiGet<AdminCreditPackage[]>("/api/admin/billing/credit-packages", undefined, token);
}

export async function saveAdminCreditPackage(token: string, item: Partial<AdminCreditPackage>) {
    return apiPost<AdminCreditPackage>("/api/admin/billing/credit-packages", item, token);
}

export async function deleteAdminCreditPackage(token: string, id: string) {
    return apiDelete<boolean>(`/api/admin/billing/credit-packages/${encodeURIComponent(id)}`, token);
}

export async function fetchAdminPaymentSettings(token: string) {
    return apiGet<AdminPaymentSettings>("/api/admin/payment/settings", undefined, token);
}

export async function saveAdminPaymentSettings(token: string, item: Partial<AdminPaymentSettings>) {
    return apiPost<AdminPaymentSettings>("/api/admin/payment/settings", item, token);
}

export async function fetchAdminPromptCategories(token: string) {
    return apiGet<AdminPromptCategory[]>("/api/admin/prompt-categories", undefined, token);
}

export async function saveAdminPromptCategory(token: string, category: Partial<AdminPromptCategory>) {
    return apiPost<AdminPromptCategory>("/api/admin/prompt-categories", category, token);
}

export async function deleteAdminPromptCategory(token: string, category: string) {
    return apiDelete<boolean>(`/api/admin/prompt-categories/${encodeURIComponent(category)}`, token);
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
    hasApiKey?: boolean;
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
    enabled?: boolean;
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
    title: string;
    description: string;
    slogan: string;
    worksEnabled: boolean;
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
    apiRoutes?: AdminModelApiRoute[];
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
    taskQueue: {
        defaultUserConcurrency: number;
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

export async function testAdminObjectStorage(token: string, objectStorage: AdminPrivateSettings["objectStorage"]) {
    return apiPost<string>("/api/admin/settings/object-storage-test", { objectStorage }, token);
}
