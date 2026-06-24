"use client";

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Maximize2, Upload, X } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import type { AdminProjectBriefSettings } from "@/services/api/admin";
import { useConfigStore } from "@/stores/use-config-store";
import { CanvasFullscreenTextEditor } from "./canvas-fullscreen-text-editor";
import type { CanvasNodeData, CanvasNodeMetadata, CanvasProjectBrief } from "../types";

type Theme = (typeof canvasThemes)[keyof typeof canvasThemes];

type ProjectBriefNodeContentProps = {
    node: CanvasNodeData;
    theme: Theme;
    onMetadataChange?: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onSend?: (node: CanvasNodeData) => void;
    fullscreen?: boolean;
};

type StyleLibraryItem = {
    name: string;
    category: string;
    prompt: string;
    image: string;
    isNew?: boolean;
    previews?: string[];
};

type ProjectBriefSettings = {
    genres: string[];
    styleCategories: string[];
    visualStyles: StyleLibraryItem[];
    storyPresets: Array<{ title: string; text: string }>;
};

const defaultGenreOptions = ["科幻", "悬疑", "爱情", "冒险", "奇幻", "都市", "广告", "儿童动画", "纪录片"];
const durationOptions = ["15秒", "30秒", "60秒", "90秒", "3分钟", "自定义"];
const defaultStyleCategories = ["我的风格", "最近使用", "立体风格", "国风", "IP风格", "欧美风格", "日系风格", "插画风格", "韩系", "可爱Q版"];
const defaultStyleLibrary: StyleLibraryItem[] = [
    {
        name: "KpopCG",
        category: "韩系",
        prompt: "韩系偶像写真质感，精致妆造，高饱和舞台光，商业 CG 渲染。",
        image: "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnpo9im1_39c786142b2473e8.webp",
        isNew: true,
        previews: [
            "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnojtb8n_3114dbe29e4fedbc.webp",
            "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnpo9im1_39c786142b2473e8.webp",
            "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnojr8e9_5d62e6aa1dc41c5e.webp",
        ],
    },
    {
        name: "游戏CG",
        category: "立体风格",
        prompt: "高品质游戏 CG，电影级布光，细节丰富，空间层次清晰。",
        image: "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2FNhe9bnBOkoh8LSxYaG7cMct7nDg.webp",
        previews: [
            "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmn2tgtajad1a164ac3985264.webp",
            "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2FEW0XbyTnUoZX44xcI1vcRtMcnjd.webp",
            "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2FSnaobGxSHoLVIXxFlOUc5QgEnBc.webp",
        ],
    },
    {
        name: "像素农场",
        category: "可爱Q版",
        prompt: "可爱像素农场风，Q 版角色，明亮色彩，轻松治愈的游戏画面。",
        image: "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnps4e2n_f772bf318499f660.webp",
        isNew: true,
        previews: [
            "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnpsa9ba_121507cc8417d426.webp",
            "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnps84h8_04377ac124a68cc7.webp",
            "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnps8fah_869571d3fa0df2a2.webp",
        ],
    },
    { name: "国风水墨", category: "国风", prompt: "国风水墨，美术留白，柔和宣纸肌理，东方诗意构图。", image: "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmmybot0eaa74e8f640da0bf4.webp" },
    { name: "电影感", category: "欧美风格", prompt: "电影级摄影，真实光影，浅景深，情绪化色彩分级。", image: "" },
    { name: "皮克斯3D", category: "IP风格", prompt: "皮克斯式 3D 动画质感，圆润造型，表情夸张，温暖光线。", image: "" },
    { name: "赛博朋克", category: "插画风格", prompt: "赛博朋克霓虹城市，高对比光影，未来科技元素，雨夜反射。", image: "" },
    { name: "日系动画", category: "日系风格", prompt: "日系动画分镜，清爽线条，柔和天空光，细腻青春氛围。", image: "" },
];

const defaultStoryPresets = [
    { title: "科幻追逐", text: "一个年轻程序员深夜发现自己开发的 AI 正在现实世界中追捕他，他必须在黎明前关闭系统。" },
    { title: "温情治愈", text: "一个长期独处的人在一次意外相遇后，重新学会与他人建立连接，并找回生活的温度。" },
    { title: "悬疑反转", text: "主角接到一条来自未来的警告信息，循着线索调查后发现真正的危险来自自己最信任的人。" },
    { title: "产品广告", text: "通过一个高压工作日中的小困境，展示产品如何自然地解决问题，并让生活变得更轻松。" },
    { title: "儿童冒险", text: "几个孩子在普通街区发现一扇通往奇妙世界的小门，必须合作帮助一位迷路的朋友回家。" },
    { title: "灾难逃生", text: "城市突然陷入危机，主角带着重要线索穿越混乱街区，寻找唯一能阻止灾难扩大的方法。" },
];

const defaultProjectBriefSettings: ProjectBriefSettings = {
    genres: defaultGenreOptions,
    styleCategories: defaultStyleCategories,
    visualStyles: defaultStyleLibrary,
    storyPresets: defaultStoryPresets,
};

export function ProjectBriefNodeContent({ node, theme, onMetadataChange, fullscreen }: ProjectBriefNodeContentProps) {
    const configuredProjectBrief = useConfigStore((state) => state.publicSettings?.projectBrief);
    const projectSettings = useMemo(() => normalizeProjectBriefSettings(configuredProjectBrief), [configuredProjectBrief]);
    const genreOptions = projectSettings.genres;
    const styleCategories = useMemo(() => ["全部", ...uniqueStrings([...projectSettings.styleCategories, ...projectSettings.visualStyles.map((item) => item.category)])], [projectSettings]);
    const styleLibrary = projectSettings.visualStyles;
    const storyPresets = projectSettings.storyPresets;
    const [elementDraft, setElementDraft] = useState("");
    const [customDuration, setCustomDuration] = useState("");
    const [presetOpen, setPresetOpen] = useState(false);
    const [styleOpen, setStyleOpen] = useState(false);
    const [storyEditorOpen, setStoryEditorOpen] = useState(false);
    const [styleCategory, setStyleCategory] = useState("全部");
    const brief = normalizeProjectBrief(node.metadata?.projectBrief, projectSettings);
    const visibleStyles = styleLibrary.filter((item) => styleCategory === "全部" || item.category === styleCategory);

    const updateBrief = (patch: Partial<CanvasProjectBrief>) => {
        onMetadataChange?.(node.id, { projectBrief: { ...brief, ...patch }, status: "success" });
    };
    const addElement = () => {
        const value = elementDraft.trim();
        if (!value || brief.keyElements.includes(value)) return;
        updateBrief({ keyElements: [...brief.keyElements, value] });
        setElementDraft("");
    };
    const handleElementKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        addElement();
    };

    return (
        <div className={`relative flex h-full w-full flex-col overflow-hidden ${fullscreen ? "px-6 pb-6 pt-6" : "px-4 pb-4 pt-12"}`} style={{ color: theme.node.text }}>
            <div className={`thin-scrollbar min-h-0 flex-1 flex-col gap-3 pr-1 ${fullscreen ? "flex overflow-hidden" : "flex overflow-y-auto"}`} onWheel={(event) => event.stopPropagation()}>
                <FieldLabel theme={theme} label="主题" />
                <input
                    className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm outline-none"
                    style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                    value={brief.theme}
                    placeholder="例如：孤独程序员与失控 AI 的雨夜追逐"
                    onChange={(event) => updateBrief({ theme: event.target.value })}
                    onMouseDown={(event) => event.stopPropagation()}
                />

                <OptionGroup theme={theme} label="题材" value={brief.genre} options={genreOptions} onChange={(genre) => updateBrief({ genre })} />

                <FieldLabel theme={theme} label="视觉风格" />
                <div className="flex items-center gap-2">
                    {brief.visualStyleImage ? <img src={brief.visualStyleImage} alt={brief.visualStyle} className="h-9 w-7 rounded object-cover" /> : null}
                    <button type="button" className="flex h-9 flex-1 items-center justify-between rounded-lg border px-3 text-left text-sm" style={{ borderColor: theme.node.stroke, color: theme.node.text }} onClick={() => setStyleOpen((value) => !value)} onMouseDown={(event) => event.stopPropagation()}>
                        <span className="truncate">{brief.visualStyle || "选择视觉风格"}</span>
                        <ChevronDown className="size-4 opacity-60" />
                    </button>
                </div>

                <FieldLabel theme={theme} label="关键元素" />
                <div className="flex flex-wrap gap-1.5">
                    {brief.keyElements.map((item) => (
                        <button key={item} type="button" className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs" style={{ borderColor: theme.node.stroke, color: theme.node.text }} onClick={() => updateBrief({ keyElements: brief.keyElements.filter((value) => value !== item) })}>
                            {item}
                            <X className="size-3" />
                        </button>
                    ))}
                    <div className="flex h-7 items-center gap-1 rounded-md border px-2" style={{ borderColor: theme.node.stroke }}>
                        <input className="w-28 bg-transparent text-xs outline-none" style={{ color: theme.node.text }} value={elementDraft} placeholder="回车添加" onChange={(event) => setElementDraft(event.target.value)} onKeyDown={handleElementKeyDown} onMouseDown={(event) => event.stopPropagation()} />
                        <button type="button" className="grid size-4 place-items-center opacity-70" onClick={addElement} aria-label="添加关键元素">
                            <span className="text-sm leading-none">+</span>
                        </button>
                    </div>
                </div>

                <FieldLabel theme={theme} label="时长" />
                <div className="flex flex-wrap gap-1.5">
                    {durationOptions.map((option) => (
                        <ChipButton key={option} theme={theme} active={option === "自定义" ? !durationOptions.includes(brief.duration) : brief.duration === option} onClick={() => updateBrief({ duration: option === "自定义" ? customDuration || "45秒" : option })}>
                            {option}
                        </ChipButton>
                    ))}
                    {!durationOptions.includes(brief.duration) ? (
                        <input
                            className="h-8 w-24 rounded-md border bg-transparent px-2 text-xs outline-none"
                            style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                            value={customDuration || brief.duration}
                            placeholder="45秒"
                            onChange={(event) => {
                                setCustomDuration(event.target.value);
                                updateBrief({ duration: event.target.value });
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                        />
                    ) : null}
                </div>

                <div className={`relative ${fullscreen ? "flex min-h-0 flex-1 flex-col" : ""}`}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                        <FieldLabel theme={theme} label="故事简述（支持小说改编）" compact />
                        <div className="flex items-center gap-1.5">
                            <button type="button" className="grid size-7 place-items-center rounded-md border" style={{ borderColor: theme.node.stroke, color: theme.node.text }} onClick={() => setStoryEditorOpen(true)} onMouseDown={(event) => event.stopPropagation()} aria-label="全屏编辑故事简述" title="全屏编辑故事简述">
                                <Maximize2 className="size-3.5" />
                            </button>
                            <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium" style={{ borderColor: theme.node.stroke, color: theme.node.text }} onClick={() => setPresetOpen((value) => !value)} onMouseDown={(event) => event.stopPropagation()}>
                                预设
                                <ChevronDown className={`size-3 transition ${presetOpen ? "rotate-180" : ""}`} />
                            </button>
                        </div>
                    </div>
                    {presetOpen ? (
                        <div className="absolute right-0 top-8 z-40 w-56 overflow-hidden rounded-lg border shadow-xl" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}>
                            {storyPresets.map((preset) => (
                                <button
                                    key={preset.title}
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-xs transition hover:bg-white/10"
                                    style={{ color: theme.node.text }}
                                    onClick={() => {
                                        updateBrief({ story: preset.text });
                                        setPresetOpen(false);
                                    }}
                                    onMouseDown={(event) => event.stopPropagation()}
                                >
                                    <span className="block font-semibold">{preset.title}</span>
                                    <span className="mt-0.5 line-clamp-2 block leading-4" style={{ color: theme.node.muted }}>
                                        {preset.text}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : null}
                    <textarea
                        className={`thin-scrollbar w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm leading-5 outline-none ${fullscreen ? "min-h-0 flex-1" : "h-[21rem]"}`}
                        style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                        value={brief.story}
                        placeholder="简要描述你想要创作的故事"
                        onChange={(event) => updateBrief({ story: event.target.value })}
                        onMouseDown={(event) => event.stopPropagation()}
                        onWheel={(event) => event.stopPropagation()}
                    />
                </div>
            </div>
            <StyleLibraryModal
                open={styleOpen}
                selectedStyle={brief.visualStyle}
                category={styleCategory}
                categories={styleCategories}
                styles={visibleStyles}
                onCategoryChange={setStyleCategory}
                onClose={() => setStyleOpen(false)}
                onSelect={(style) => {
                    updateBrief({ visualStyle: style.name, visualStyleImage: style.image, visualStylePrompt: style.prompt });
                    setStyleOpen(false);
                }}
                onUpload={(url) => {
                    updateBrief({ visualStyle: "自定义风格", visualStyleImage: url, visualStylePrompt: "" });
                    setStyleOpen(false);
                }}
            />
            <CanvasFullscreenTextEditor open={storyEditorOpen} title="故事简述" value={brief.story} placeholder="简要描述你想要创作的故事" theme={theme} onChange={(story) => updateBrief({ story })} onClose={() => setStoryEditorOpen(false)} />
        </div>
    );
}

function StyleLibraryModal({
    open,
    selectedStyle,
    category,
    categories,
    styles,
    onCategoryChange,
    onClose,
    onSelect,
    onUpload,
}: {
    open: boolean;
    selectedStyle: string;
    category: string;
    categories: string[];
    styles: StyleLibraryItem[];
    onCategoryChange: (category: string) => void;
    onClose: () => void;
    onSelect: (style: StyleLibraryItem) => void;
    onUpload: (url: string) => void;
}) {
    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 p-4 md:p-6" onMouseDown={onClose} onWheel={(event) => event.stopPropagation()}>
            <div className="mx-auto flex h-full max-h-[900px] w-full max-w-[1440px] flex-col overflow-hidden rounded-[18px] bg-[#232425] shadow-[0_30px_100px_rgba(0,0,0,0.65)]" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-4 md:px-6 md:py-5">
                    <h3 className="text-lg font-semibold text-white md:text-xl">风格库</h3>
                    <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15" onClick={onClose} aria-label="关闭风格库">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="border-b border-white/[0.06] px-4 pb-3 md:px-6 md:pb-4">
                    <div className="thin-scrollbar flex gap-2 overflow-x-auto pb-1">
                        {categories.map((item) => (
                            <button key={item} type="button" className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${category === item ? "bg-white" : "bg-white/[0.06] text-[#cfd6e2] hover:bg-white/[0.10] hover:text-white"}`} style={category === item ? { color: "#111315" } : undefined} onClick={() => onCategoryChange(item)}>
                                {item}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
                        <StyleUploadCard onSelect={onUpload} />
                        {styles.map((style) => (
                            <button key={style.name} type="button" className={`group overflow-hidden rounded-2xl border bg-[#15171b] text-left shadow-[0_18px_42px_rgba(0,0,0,0.32)] transition ${selectedStyle === style.name ? "border-white" : "border-white/[0.08] hover:border-white/[0.18]"}`} onClick={() => onSelect(style)}>
                                <div className="relative aspect-[9/16] overflow-hidden bg-[#111318]">
                                    {style.isNew ? <span className="absolute left-2 top-2 z-10 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">New</span> : null}
                                    {style.image ? <img alt={style.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={style.image} /> : <div className="flex h-full w-full items-center justify-center px-3 text-center text-sm text-[#929aa8]">{style.name}</div>}
                                    {style.previews?.length ? (
                                        <div className="absolute bottom-3 right-3 flex shrink-0 -space-x-2">
                                            {style.previews.map((preview) => (
                                                <img key={preview} alt="" className="h-8 w-8 rounded-lg border border-white/20 object-cover shadow-lg" src={preview} />
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="px-3 py-2">
                                    <div className="truncate text-sm font-semibold text-white">{style.name}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

function StyleUploadCard({ onSelect }: { onSelect: (url: string) => void }) {
    return (
        <label className="flex aspect-[9/16] min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-[#2b2d30] text-[#929aa8] transition hover:border-white/35 hover:bg-[#303339] hover:text-white md:min-h-[220px]">
            <Upload className="h-9 w-9" />
            <span className="mt-3 text-sm">上传风格图片</span>
            <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleStyleUpload(event.currentTarget.files?.[0], onSelect)} />
        </label>
    );
}

function OptionGroup({ theme, label, value, options, onChange }: { theme: Theme; label: string; value: string; options: string[]; onChange: (value: string) => void }) {
    return (
        <div>
            <FieldLabel theme={theme} label={label} />
            <div className="flex flex-wrap gap-1.5">
                {options.map((option) => (
                    <ChipButton key={option} theme={theme} active={value === option} onClick={() => onChange(option)}>
                        {option}
                    </ChipButton>
                ))}
            </div>
        </div>
    );
}

function FieldLabel({ theme, label, compact = false }: { theme: Theme; label: string; compact?: boolean }) {
    return (
        <div className={compact ? "text-xs font-semibold" : "mb-1.5 text-xs font-semibold"} style={{ color: theme.node.text }}>
            {label}
        </div>
    );
}

function ChipButton({ theme, active, children, onClick }: { theme: Theme; active: boolean; children: ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            className="h-8 rounded-md border px-2.5 text-xs font-medium transition hover:scale-[1.01]"
            style={{
                background: active ? theme.toolbar.activeBg : theme.node.fill,
                borderColor: active ? theme.node.activeStroke : theme.node.stroke,
                color: active ? theme.toolbar.activeText : theme.node.text,
            }}
            onClick={onClick}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            {children}
        </button>
    );
}

function normalizeProjectBrief(brief: CanvasProjectBrief | undefined, settings: ProjectBriefSettings): CanvasProjectBrief {
    const defaultStyle = settings.visualStyles.find((item) => item.name === "电影感") || settings.visualStyles[0];
    const visualStyle = brief?.visualStyle || defaultStyle?.name || "";
    const matchedStyle = settings.visualStyles.find((item) => item.name === visualStyle);
    return {
        theme: brief?.theme || "",
        genre: brief?.genre || settings.genres[0] || "",
        visualStyle,
        visualStyleImage: brief?.visualStyleImage || matchedStyle?.image || "",
        visualStylePrompt: brief?.visualStylePrompt || matchedStyle?.prompt || "",
        keyElements: brief?.keyElements || [],
        duration: brief?.duration || "60秒",
        story: brief?.story || "",
    };
}

function normalizeProjectBriefSettings(settings?: Partial<AdminProjectBriefSettings>): ProjectBriefSettings {
    const visualStyles = (settings?.visualStyles ? settings.visualStyles : defaultProjectBriefSettings.visualStyles)
        .map((item) => ({
            name: item.name?.trim() || "",
            category: item.category?.trim() || "",
            prompt: item.prompt?.trim() || "",
            image: "coverUrl" in item ? item.coverUrl?.trim() || "" : item.image?.trim() || "",
            previews: "previewUrls" in item ? item.previewUrls || [] : item.previews || [],
            isNew: "isNew" in item ? item.isNew : false,
        }))
        .filter((item) => item.name);
    return {
        genres: uniqueStrings(settings?.genres ? settings.genres : defaultProjectBriefSettings.genres),
        styleCategories: uniqueStrings(settings?.styleCategories ? settings.styleCategories : defaultProjectBriefSettings.styleCategories),
        visualStyles,
        storyPresets: (settings?.storyPresets ? settings.storyPresets : defaultProjectBriefSettings.storyPresets).filter((item) => item.title && item.text),
    };
}

function uniqueStrings(items: string[]) {
    return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

async function handleStyleUpload(file: File | undefined, onSelect: (url: string) => void) {
    if (!file) return;
    const url = await readFileAsDataURL(file);
    onSelect(url);
}

function readFileAsDataURL(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}
