"use client";

import { App, Empty, Input, Modal } from "antd";
import { Bell, CalendarDays, Pin, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchAnnouncements, type Announcement } from "@/services/api/announcements";

type AnnouncementsDialogProps = {
    open: boolean;
    onClose: () => void;
};

export function AnnouncementsDialog({ open, onClose }: AnnouncementsDialogProps) {
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
        if (!open) return;
        setLoading(true);
        fetchAnnouncements({ pageSize: 100 })
            .then((data) => setItems(data.items || []))
            .catch((error) => message.error(error instanceof Error ? error.message : "公告读取失败"))
            .finally(() => setLoading(false));
    }, [message, open]);

    return (
        <>
            <Modal
                open={open && !active}
                onCancel={onClose}
                footer={null}
                width={800}
                closeIcon={<X className="size-4" />}
                styles={{
                    body: { padding: "24px" },
                    content: { borderRadius: 16 },
                }}
                title={
                    <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100">
                        <Bell className="size-5 text-stone-900 dark:text-stone-100" />
                        <span className="text-lg font-semibold">公告中心</span>
                    </div>
                }
            >
                <div className="mb-4">
                    <Input
                        prefix={<Search className="size-4 text-stone-400" />}
                        allowClear
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        placeholder="搜索公告标题或摘要"
                        size="large"
                    />
                </div>

                <div className="max-h-[500px] overflow-y-auto space-y-2">
                    {filtered.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setActive(item)}
                            className="w-full rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-stone-400 hover:shadow-sm dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-500"
                        >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                {item.pinned ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-900 dark:bg-stone-700 dark:text-stone-100">
                                        <Pin className="size-3" />
                                        置顶
                                    </span>
                                ) : null}
                                <span className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                                    <CalendarDays className="size-3.5" />
                                    {item.publishedAt || item.createdAt || "未设置发布时间"}
                                </span>
                            </div>
                            <h3 className="text-base font-semibold text-stone-950 dark:text-stone-100">{item.title}</h3>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600 dark:text-stone-400">{item.summary || item.content || "暂无摘要"}</p>
                        </button>
                    ))}
                    {!filtered.length ? <Empty description={loading ? "公告加载中" : "暂无公告"} /> : null}
                </div>
            </Modal>

            <Modal
                title={active?.title}
                open={!!active}
                footer={null}
                onCancel={() => setActive(null)}
                width={720}
                closeIcon={<X className="size-4" />}
                styles={{
                    content: { borderRadius: 16 },
                }}
            >
                {active ? (
                    <article className="space-y-4">
                        <div className="text-xs text-stone-500 dark:text-stone-400">{active.publishedAt || active.createdAt}</div>
                        {active.summary ? (
                            <div className="rounded-lg bg-stone-100 p-4 text-sm leading-6 text-stone-800 dark:bg-stone-800 dark:text-stone-200">
                                {active.summary}
                            </div>
                        ) : null}
                        <div
                            className="prose prose-sm prose-stone max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: active.content }}
                        />
                    </article>
                ) : null}
            </Modal>
        </>
    );
}
