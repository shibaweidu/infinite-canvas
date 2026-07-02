"use client";

import { ArrowLeft, Copy, Image as ImageIcon, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { App, Button, Card, Empty, Image, Space, Tag, Typography } from "antd";

import { fetchHomeWork, type HomeWork } from "@/services/api/home";

export default function WorkDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { message } = App.useApp();
    const [work, setWork] = useState<HomeWork | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void fetchHomeWork(params.id)
            .then(setWork)
            .catch((error) => message.error(error instanceof Error ? error.message : "作品获取失败"))
            .finally(() => setLoading(false));
    }, [message, params.id]);

    const copyPrompt = async () => {
        if (!work?.prompt) return;
        await navigator.clipboard.writeText(work.prompt);
        message.success("提示词已复制");
    };

    const sameStyle = () => {
        if (!work) return;
        const params = new URLSearchParams({ mode: work.type, prompt: work.prompt });
        if (work.model) params.set("model", work.model);
        router.push(`/workbench?${params.toString()}`);
    };

    if (!loading && !work) {
        return <main className="grid h-full place-items-center bg-background"><Empty description="作品不存在或未发布" /></main>;
    }

    return (
        <main className="h-full overflow-y-auto bg-[#f7f7f4] px-4 py-6 text-neutral-950 dark:bg-[#111111] dark:text-neutral-100 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-950 dark:hover:text-white">
                    <ArrowLeft className="size-4" />
                    返回首页
                </Link>
                {work ? (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
                        <section className="overflow-hidden rounded-[28px] border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
                            {work.type === "video" ? <video src={work.mediaUrl} controls className="max-h-[78vh] w-full bg-black object-contain" /> : <Image src={work.mediaUrl || work.coverUrl} alt={work.title} className="max-h-[78vh] w-full object-contain" preview={{ mask: "查看大图" }} />}
                        </section>
                        <aside className="space-y-4">
                            <Card variant="borderless" className="!rounded-[24px]">
                                <Space direction="vertical" size={14} style={{ width: "100%" }}>
                                    <Space wrap>
                                        <Tag icon={<ImageIcon className="size-3.5" />}>{work.type === "video" ? "视频" : "图片"}</Tag>
                                        {work.category ? <Tag>{work.category}</Tag> : null}
                                        {work.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                                    </Space>
                                    <Typography.Title level={2} style={{ margin: 0 }}>{work.title}</Typography.Title>
                                    {work.description ? <Typography.Paragraph type="secondary">{work.description}</Typography.Paragraph> : null}
                                    {work.allowSameStyle ? <Button block size="large" type="primary" icon={<WandSparkles className="size-4" />} onClick={sameStyle}>做同款</Button> : null}
                                </Space>
                            </Card>
                            {work.showPrompt ? (
                                <Card title="提示词" variant="borderless" className="!rounded-[24px]" extra={<Button size="small" icon={<Copy className="size-3.5" />} onClick={copyPrompt}>复制</Button>}>
                                    <Typography.Paragraph style={{ whiteSpace: "pre-wrap", margin: 0 }}>{work.prompt || "暂无提示词"}</Typography.Paragraph>
                                </Card>
                            ) : null}
                            <Card title="作品信息" variant="borderless" className="!rounded-[24px]">
                                <Space direction="vertical" size={8}>
                                    <Typography.Text type="secondary">模型：{work.model || "未记录"}</Typography.Text>
                                    <Typography.Text type="secondary">发布时间：{formatTime(work.publishedAt || work.createdAt)}</Typography.Text>
                                </Space>
                            </Card>
                        </aside>
                    </div>
                ) : null}
            </div>
        </main>
    );
}

function formatTime(value: string) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

