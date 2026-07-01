"use client";

import { App, Empty, Input, Modal, Tag } from "antd";
import { Bell, CalendarDays, Pin, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchAnnouncements, type Announcement } from "@/services/api/announcements";

export default function AnnouncementsPage() {
    const { message } = App.useApp();
    const [items, setItems] = useState<Announcement[]>([]);
    const [keyword, setKeyword] = useState("");
    const [active, setActive] = useState<Announcement | null>(null);
    const [loading, setLoading] = useState(false);
    const filtered = useMemo(() => {
        const value = keyword.trim().toLowerCase();
        if (!value) return items;
        return items.filter((item) => `${item.title} ${item.summary} ${item.content}`.toLowerCase().includes(value));
    }, [items, keyword]);

    useEffect(() => {
        setLoading(true);
        fetchAnnouncements({ pageSize: 100 })
            .then((data) => setItems(data.items || []))
            .catch((error) => message.error(error instanceof Error ? error.message : "公告读取失败"))
            .finally(() => setLoading(false));
    }, [message]);

    return (
        <main className="min-h-[calc(100vh-64px)] bg-stone-50 px-4 py-6 text-stone-950 dark:bg-stone-950 dark:text-stone-100 md:px-6">
            <div className="mx-auto max-w-5xl">
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-2 inline-flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                            <Bell className="size-4" />
                            平台公告
                        </div>
                        <h1 className="text-2xl font-semibold tracking-normal">公告中心</h1>
                    </div>
                    <Input prefix={<Search className="size-4 text-stone-400" />} allowClear value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索公告标题或摘要" className="max-w-sm" />
                </div>

                <div className="grid gap-3">
                    {filtered.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setActive(item)}
                            className="w-full cursor-pointer rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-600"
                        >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                {item.pinned ? (
                                    <Tag icon={<Pin className="size-3" />} color="default">
                                        置顶
                                    </Tag>
                                ) : null}
                                <span className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                                    <CalendarDays className="size-3.5" />
                                    {item.publishedAt || item.createdAt || "未设置发布时间"}
                                </span>
                            </div>
                            <h2 className="text-base font-semibold text-stone-950 dark:text-stone-100">{item.title}</h2>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600 dark:text-stone-300">{item.summary || plainText(item.content) || "暂无摘要"}</p>
                        </button>
                    ))}
                    {!filtered.length ? <Empty description={loading ? "公告加载中" : "暂无公告"} /> : null}
                </div>
            </div>

            <Modal title={active?.title} open={!!active} footer={null} onCancel={() => setActive(null)} width={720}>
                {active ? (
                    <article className="space-y-4">
                        <div className="text-xs text-stone-500">{active.publishedAt || active.createdAt}</div>
                        {active.summary ? <p className="rounded-lg bg-stone-100 p-3 text-sm leading-6 text-stone-700 dark:bg-stone-800 dark:text-stone-200">{active.summary}</p> : null}
                        <div className="prose prose-sm max-w-none text-stone-800 dark:prose-invert dark:text-stone-100" dangerouslySetInnerHTML={{ __html: active.content }} />
                    </article>
                ) : null}
            </Modal>
        </main>
    );
}

function plainText(value?: string) {
    return (value || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}
