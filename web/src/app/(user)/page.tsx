"use client";

import { ArrowRight, Image as ImageIcon, Play, Sparkles, Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { App, Empty, Tag } from "antd";

import { fetchHomeSlides, fetchHomeWorks, type HomeCategory, type HomeSlide, type HomeWork } from "@/services/api/home";

export default function IndexPage() {
    const { message } = App.useApp();
    const [slides, setSlides] = useState<HomeSlide[]>([]);
    const [works, setWorks] = useState<HomeWork[]>([]);
    const [categories, setCategories] = useState<HomeCategory[]>([]);
    const [activeCategory, setActiveCategory] = useState("all");
    const [activeSlide, setActiveSlide] = useState(0);

    useEffect(() => {
        void Promise.all([fetchHomeSlides(), fetchHomeWorks({ pageSize: 24 })])
            .then(([slideData, workData]) => {
                setSlides(slideData);
                setWorks(workData.items);
                setCategories(workData.categories);
            })
            .catch((error) => message.error(error instanceof Error ? error.message : "首页内容获取失败"));
    }, [message]);

    useEffect(() => {
        if (slides.length <= 1) return;
        const timer = window.setInterval(() => setActiveSlide((value) => (value + 1) % slides.length), 5200);
        return () => window.clearInterval(timer);
    }, [slides.length]);

    const filteredWorks = useMemo(() => works.filter((item) => activeCategory === "all" || item.category === activeCategory), [activeCategory, works]);
    const slide = slides[activeSlide];

    return (
        <main className="h-full overflow-y-auto bg-[#f7f7f4] text-neutral-950 dark:bg-[#111111] dark:text-neutral-100">
            <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <div className="relative min-h-[420px] overflow-hidden rounded-[30px] border border-black/10 bg-neutral-900 shadow-[0_24px_80px_rgba(0,0,0,0.18)] dark:border-white/10">
                    {slide ? (
                        <Link href={slide.workId ? `/works/${slide.workId}` : slide.linkUrl || "/workbench"} className="group block h-full min-h-[420px] cursor-pointer">
                            <img src={slide.coverUrl} alt={slide.title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
                            <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/38 to-black/10" />
                            <div className="relative z-10 flex min-h-[420px] max-w-2xl flex-col justify-end p-7 text-white sm:p-10 lg:p-14">
                                <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1 text-sm backdrop-blur">
                                    <Sparkles className="size-4" />
                                    精选推荐
                                </div>
                                <h1 className="text-balance text-4xl font-semibold tracking-normal sm:text-6xl">{slide.title}</h1>
                                {slide.subtitle ? <p className="mt-5 text-lg leading-8 text-white/78">{slide.subtitle}</p> : null}
                                <span className="mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-neutral-950 transition group-hover:bg-neutral-100">
                                    查看详情
                                    <ArrowRight className="size-4" />
                                </span>
                            </div>
                        </Link>
                    ) : (
                        <div className="flex min-h-[420px] items-center justify-center px-6 text-center text-white">
                            <div>
                                <h1 className="text-4xl font-semibold">首页幻灯片</h1>
                                <p className="mt-3 text-white/65">请到后台“首页内容”发布幻灯片。</p>
                            </div>
                        </div>
                    )}
                    {slides.length > 1 ? (
                        <div className="absolute bottom-5 right-5 z-20 flex gap-2">
                            {slides.map((item, index) => (
                                <button key={item.id} type="button" aria-label={item.title} onClick={() => setActiveSlide(index)} className="h-2.5 cursor-pointer rounded-full bg-white transition-all" style={{ width: index === activeSlide ? 28 : 10, opacity: index === activeSlide ? 1 : 0.45 }} />
                            ))}
                        </div>
                    ) : null}
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
                <div className="mb-6 flex flex-col gap-4 border-b border-black/10 pb-5 dark:border-white/10 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="text-3xl font-semibold tracking-normal">作品库</h2>
                        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">由管理员发布的精选作品，点击可查看提示词并做同款。</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setActiveCategory("all")} className={categoryButtonClass(activeCategory === "all")}>全部</button>
                        {categories.map((item) => (
                            <button key={item.id} type="button" onClick={() => setActiveCategory(item.name)} className={categoryButtonClass(activeCategory === item.name)}>{item.name}</button>
                        ))}
                    </div>
                </div>
                {filteredWorks.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredWorks.map((item) => <WorkCard key={item.id} item={item} />)}
                    </div>
                ) : (
                    <div className="rounded-3xl border border-dashed border-black/15 bg-white/60 py-16 dark:border-white/15 dark:bg-white/5">
                        <Empty description="暂无已发布作品" />
                    </div>
                )}
            </section>
        </main>
    );
}

function categoryButtonClass(active: boolean) {
    return `h-9 cursor-pointer rounded-full border px-4 text-sm transition ${active ? "border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950" : "border-black/10 bg-white text-neutral-700 hover:border-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200"}`;
}

function WorkCard({ item }: { item: HomeWork }) {
    return (
        <Link href={`/works/${item.id}`} className="group overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/5">
            <div className="relative aspect-[4/3] overflow-hidden bg-neutral-200 dark:bg-neutral-900">
                {item.type === "video" ? <video src={item.mediaUrl} className="h-full w-full object-cover" muted preload="metadata" /> : <img src={item.coverUrl || item.mediaUrl} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />}
                <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-xs text-white backdrop-blur">
                    {item.type === "video" ? <Video className="size-3.5" /> : <ImageIcon className="size-3.5" />}
                    {item.type === "video" ? "视频" : "图片"}
                </div>
                {item.type === "video" ? <Play className="absolute left-1/2 top-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 p-3 text-neutral-950" /> : null}
            </div>
            <div className="space-y-3 p-4">
                <h3 className="line-clamp-2 min-h-11 text-base font-semibold leading-6">{item.title}</h3>
                <div className="flex flex-wrap gap-1.5">
                    {item.category ? <Tag className="m-0 rounded-full">{item.category}</Tag> : null}
                    {item.tags.slice(0, 2).map((tag) => <Tag key={tag} className="m-0 rounded-full">{tag}</Tag>)}
                </div>
                <div className="grid h-8 place-items-center rounded-full bg-neutral-950 text-sm font-medium text-white dark:bg-white dark:text-neutral-950">查看作品</div>
            </div>
        </Link>
    );
}
