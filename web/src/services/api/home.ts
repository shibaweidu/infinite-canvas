import { apiGet, compactApiParams } from "@/services/api/request";

export type HomeWorkStatus = "draft" | "pending" | "published" | "hidden";
export type HomeWorkType = "image" | "video";

export type HomeSlide = {
    id: string;
    title: string;
    subtitle: string;
    coverUrl: string;
    linkUrl: string;
    workId: string;
    enabled: boolean;
    sort: number;
    publishedAt: string;
    createdAt: string;
    updatedAt: string;
};

export type HomeWork = {
    id: string;
    title: string;
    description: string;
    type: HomeWorkType;
    coverUrl: string;
    mediaUrl: string;
    prompt: string;
    model: string;
    category: string;
    tags: string[];
    status: HomeWorkStatus;
    allowSameStyle: boolean;
    showPrompt: boolean;
    sort: number;
    publishedAt: string;
    createdAt: string;
    updatedAt: string;
};

export type HomeCategory = {
    id: string;
    name: string;
    enabled: boolean;
    sort: number;
    createdAt: string;
    updatedAt: string;
};

export type HomeTag = {
    id: string;
    name: string;
    enabled: boolean;
    sort: number;
    createdAt: string;
    updatedAt: string;
};

export type HomeWorkListResponse = {
    items: HomeWork[];
    categories: HomeCategory[];
    tags: HomeTag[];
    total: number;
};

export type HomeWorkQuery = {
    keyword?: string;
    category?: string;
    type?: string;
    tag?: string[];
    page?: number;
    pageSize?: number;
};

export async function fetchHomeSlides() {
    return apiGet<HomeSlide[]>("/api/home/slides");
}

export async function fetchHomeWorks(query: HomeWorkQuery = {}) {
    return apiGet<HomeWorkListResponse>("/api/home/works", compactApiParams(query));
}

export async function fetchHomeWork(id: string) {
    return apiGet<HomeWork>(`/api/home/works/${encodeURIComponent(id)}`);
}

