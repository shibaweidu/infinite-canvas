"use client";

import { App, Empty, Tag } from "antd";
import { ArrowRight, FolderPlus, Image as ImageIcon, Play, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { fetchHomeSlides, fetchHomeWorks, type HomeCategory, type HomeSlide, type HomeWork } from "@/services/api/home";
import { useConfigStore } from "@/stores/use-config-store";
import { useCanvasStore } from "./canvas/stores/use-canvas-store";

export default function IndexPage() {
    const { message } = App.useApp();
    const router = useRouter();
    const projects = useCanvasStore((state) => state.projects);
    const createProject = useCanvasStore((state) => state.createProject);
    const worksEnabled = useConfigStore((state) => state.publicSettings ? state.publicSettings.site.worksEnabled !== false : false);
    const [slides, setSlides] = useState<HomeSlide[]>([]);
    const [works, setWorks] = useState<HomeWork[]>([]);
    const [categories, setCategories] = useState<HomeCategory[]>([]);
    const [activeCategory, setActiveCategory] = useState("all");
    const [activeSlide, setActiveSlide] = useState(0);

    useEffect(() => {
        void Promise.all([fetchHomeSlides(), worksEnabled ? fetchHomeWorks({ pageSize: 32 }) : Promise.resolve(null)])
            .then(([slideData, workData]) => {
                setSlides(slideData);
                setWorks(workData?.items || []);
                setCategories(workData?.categories || []);
            })
            .catch((error) => message.error(error instanceof Error ? error.message : "首页内容获取失败"));
    }, [message, worksEnabled]);

    const filteredWorks = useMemo(
        () => works.filter((item) => activeCategory === "all" || item.category === activeCategory),
        [activeCategory, works],
    );
    const heroTexts = useMemo(() => slides.filter((item) => item.kind !== "media"), [slides]);
    const heroMediaUrl = slides.find((item) => item.kind === "media" && item.coverUrl)?.coverUrl || "";
    const slide = heroTexts[activeSlide];
    const createAndEnter = () => router.push(`/canvas/${createProject(`未命名画布 ${projects.length + 1}`)}`);

    useEffect(() => {
        if (heroTexts.length <= 1) return;
        const timer = window.setInterval(() => setActiveSlide((value) => (value + 1) % heroTexts.length), 5600);
        return () => window.clearInterval(timer);
    }, [heroTexts.length]);

    useEffect(() => {
        if (activeSlide >= heroTexts.length) setActiveSlide(0);
    }, [activeSlide, heroTexts.length]);

    return (
        <main className="h-full overflow-y-auto bg-[#f5f1ea] text-neutral-950 dark:bg-[#0d0d0f] dark:text-neutral-100">
            <section className="relative min-h-[800px] w-full overflow-hidden bg-neutral-950 shadow-[0_28px_90px_rgba(0,0,0,0.22)]">
                <div className="absolute inset-0">
                    {heroMediaUrl ? (
                        isVideoUrl(heroMediaUrl) ? (
                            <video key={heroMediaUrl} className="h-full w-full object-cover" src={heroMediaUrl} autoPlay muted loop playsInline />
                        ) : (
                            <img key={heroMediaUrl} src={heroMediaUrl} alt="" className="h-full w-full object-cover" />
                        )
                    ) : (
                        <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.12),_transparent_42%),linear-gradient(135deg,#1a1a1d,#080808)]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/76 via-black/42 to-black/12" />
                </div>
                <div className="relative z-10 mx-auto flex min-h-[800px] w-full max-w-[1480px] flex-col justify-between gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
                    <div className="max-w-2xl pt-8">
                        {slide?.title ? <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">{slide.title}</h1> : null}
                        {slide?.subtitle ? <p className="mt-4 max-w-xl text-base leading-8 text-white/78 sm:text-lg">{slide.subtitle}</p> : null}
                    </div>
                    <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-end">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={createAndEnter}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.16]"
                            >
                                <FolderPlus className="size-4" />
                                新建画布
                            </button>
                            {slide?.workId || slide?.linkUrl ? (
                                <Link
                                    href={slide.workId ? `/works/${slide.workId}` : slide.linkUrl}
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-neutral-950 transition hover:bg-neutral-100"
                                >
                                    查看详情
                                    <ArrowRight className="size-4" />
                                </Link>
                            ) : null}
                        </div>
                        <div className="flex max-w-2xl gap-2 overflow-x-auto pb-1">
                            {heroTexts.map((item, index) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setActiveSlide(index)}
                                    className={`shrink-0 cursor-pointer rounded-full border px-4 py-2 text-left text-sm transition ${
                                        index === activeSlide
                                            ? "border-white/25 bg-white text-neutral-950"
                                            : "border-white/[0.12] bg-white/[0.08] text-white/85 hover:bg-white/[0.14]"
                                    }`}
                                >
                                    {index + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                {heroTexts.length > 1 ? (
                    <div className="absolute right-5 top-5 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80 backdrop-blur">
                        <Play className="size-3.5" />
                        {activeSlide + 1}/{heroTexts.length}
                    </div>
                ) : null}
            </section>

            {worksEnabled ? <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                <section className="space-y-5">
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <button type="button" onClick={() => setActiveCategory("all")} className={categoryClass(activeCategory === "all")}>
                            全部作品
                        </button>
                        {categories.map((item) => (
                            <button key={item.id} type="button" onClick={() => setActiveCategory(item.name)} className={categoryClass(activeCategory === item.name)}>
                                {item.name}
                            </button>
                        ))}
                    </div>

                    {filteredWorks.length ? (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {filteredWorks.map((item) => (
                                <WorkCard key={item.id} item={item} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-[28px] border border-dashed border-black/10 bg-white/70 py-16 dark:border-white/10 dark:bg-white/5">
                            <Empty description="暂无已发布作品" />
                        </div>
                    )}
                </section>
            </div> : null}
        </main>
    );
}

function categoryClass(active: boolean) {
    return `inline-flex h-10 shrink-0 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition ${
        active
            ? "!border-neutral-950 !bg-neutral-950 !text-white dark:!border-white dark:!bg-white dark:!text-neutral-950"
            : "border-black/10 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10"
    }`;
}

function WorkCard({ item }: { item: HomeWork }) {
    return (
        <Link href={`/works/${item.id}`} className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_12px_45px_rgba(0,0,0,0.04)] transition hover:-translate-y-1 hover:shadow-[0_18px_60px_rgba(0,0,0,0.1)] dark:border-white/10 dark:bg-white/5">
            <div className="relative aspect-[4/3] overflow-hidden bg-neutral-200 dark:bg-neutral-900">
                {item.type === "video" ? <video src={item.mediaUrl} className="h-full w-full object-cover" muted loop playsInline preload="metadata" /> : <img src={item.coverUrl || item.mediaUrl} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />}
                <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-xs text-white backdrop-blur">
                    {item.type === "video" ? <Video className="size-3.5" /> : <ImageIcon className="size-3.5" />}
                    {item.type === "video" ? "视频" : "图片"}
                </div>
                {item.type === "video" ? <Play className="absolute left-1/2 top-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 p-3 text-neutral-950" /> : null}
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-4">
                <h3 className="line-clamp-2 min-h-12 text-base font-semibold leading-6">{item.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">{item.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                    {item.category ? <Tag className="m-0 rounded-full">{item.category}</Tag> : null}
                    {item.tags.slice(0, 2).map((tag) => (
                        <Tag key={tag} className="m-0 rounded-full">
                            {tag}
                        </Tag>
                    ))}
                </div>
                <div className="mt-5 grid h-10 place-items-center rounded-full bg-neutral-950 text-sm font-medium text-white transition group-hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:group-hover:bg-neutral-200">
                    查看作品
                </div>
            </div>
        </Link>
    );
}

function isVideoUrl(url?: string) {
    if (!url) return false;
    return /\.(mp4|webm|mov|m4v)$/i.test(url);
}
