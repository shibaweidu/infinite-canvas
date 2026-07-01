import { apiGet, type ApiParams, compactApiParams } from "@/services/api/request";

export type Announcement = {
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

export type AnnouncementListResponse = {
    items: Announcement[];
    total: number;
};

export async function fetchAnnouncements(query: ApiParams = {}) {
    return apiGet<AnnouncementListResponse>("/api/announcements", compactApiParams(query));
}

export async function fetchAnnouncement(id: string) {
    return apiGet<Announcement>(`/api/announcements/${encodeURIComponent(id)}`);
}
