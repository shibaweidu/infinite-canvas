import type { AdminModelApiRoute, AdminModelType } from "@/services/api/admin";

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

export function defaultModelApiRoutes(type: AdminModelType) {
    return modelApiRoutes[type].map((route) => ({ ...route }));
}

export function normalizeModelApiRoutes(type: AdminModelType, routes: AdminModelApiRoute[] = []) {
    const existing = new Map(routes.map((route) => [normalizeModelApiRoutePath(route.path), route.enabled === true]));
    return modelApiRoutes[type].map((route) => ({
        path: route.path,
        enabled: existing.has(route.path) ? existing.get(route.path) === true : route.enabled === true,
    }));
}

export function normalizeModelApiRoutePath(path: string) {
    const value = path.trim();
    if (value === "/v1/chat/completions") return "/chat/completions";
    if (value === "/v1/images/generations") return "/images/generations";
    if (value === "/v1/images/edits") return "/images/edits";
    if (value === "/v1/responses") return "/responses";
    if (value === "/v1/audio/speech") return "/audio/speech";
    if (value === "/v1/videos/generations" || value === "/v1/video/generations") return "/video/generations";
    return value;
}
