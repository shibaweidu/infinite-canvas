"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Pencil, Maximize2, Trash2, Upload, X } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import type { AdminProjectBriefSettings } from "@/services/api/admin";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { useUserStyleStore } from "@/stores/use-user-style-store";
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

export type StyleLibraryItem = {
    id?: string;
    name: string;
    category: string;
    prompt: string;
    image: string;
    description?: string;
    isNew?: boolean;
    previews?: string[];
    source?: "public" | "user";
};

type ProjectBriefSettings = {
    genres: string[];
    styleCategories: string[];
    visualStyles: StyleLibraryItem[];
    storyPresets: Array<{ title: string; text: string }>;
};

const defaultGenreOptions = ["科幻", "悬疑", "爱情", "冒险", "奇幻", "都市", "广告", "儿童动画", "纪录片"];
const durationOptions = ["15秒", "30秒", "60秒", "90秒", "3分钟", "自定义"];
const defaultStyleCategories: string[] = [];
const defaultStyleLibrary: StyleLibraryItem[] = [];

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
                theme={theme}
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
            />
            <CanvasFullscreenTextEditor open={storyEditorOpen} title="故事简述" value={brief.story} placeholder="简要描述你想要创作的故事" theme={theme} onChange={(story) => updateBrief({ story })} onClose={() => setStoryEditorOpen(false)} />
        </div>
    );
}

export function StyleLibraryModal({
    open,
    theme,
    selectedStyle,
    category,
    categories,
    styles,
    onCategoryChange,
    onClose,
    onSelect,
}: {
    open: boolean;
    theme?: Theme;
    selectedStyle: string;
    category: string;
    categories: string[];
    styles: StyleLibraryItem[];
    onCategoryChange: (category: string) => void;
    onClose: () => void;
    onSelect: (style: StyleLibraryItem) => void;
}) {
    const modalTheme = theme || canvasThemes.dark;
    const token = useUserStore((state) => state.token);
    const userStyles = useUserStyleStore((state) => state.styles);
    const isSaving = useUserStyleStore((state) => state.isSaving);
    const loadStyles = useUserStyleStore((state) => state.loadStyles);
    const saveStyle = useUserStyleStore((state) => state.saveStyle);
    const deleteStyle = useUserStyleStore((state) => state.deleteStyle);
    const uploadImage = useUserStyleStore((state) => state.uploadImage);
    const [draft, setDraft] = useState<{ id?: string; name: string; description: string; imageUrl: string } | null>(null);
    const [error, setError] = useState("");
    const userItems = useMemo(() => (token ? userStyles : []).map(userStyleToLibraryItem), [token, userStyles]);
    const modalCategories = useMemo(() => uniqueStrings(["全部", ...(token ? ["我的风格"] : []), ...categories]), [categories, token]);
    const displayedStyles = category === "我的风格" ? userItems : category === "全部" ? [...userItems, ...styles] : styles;

    useEffect(() => {
        if (open && token) void loadStyles(token);
    }, [loadStyles, open, token]);

    if (!open || typeof document === "undefined") return null;

    const openCreateDraft = async (file?: File) => {
        if (!token) {
            setError("请先登录后再保存我的风格");
            return;
        }
        if (!file) return;
        setError("");
        try {
            const imageUrl = await uploadImage(token, file);
            setDraft({ name: `风格${userStyles.length + 1}`, description: "", imageUrl });
            onCategoryChange("我的风格");
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "风格图片上传失败");
        }
    };

    const saveDraft = async () => {
        if (!token || !draft) return;
        const name = draft.name.trim();
        if (!name) {
            setError("请输入风格名称");
            return;
        }
        setError("");
        try {
            await saveStyle(token, { id: draft.id, name, description: draft.description.trim(), prompt: draft.description.trim(), imageUrl: draft.imageUrl });
            setDraft(null);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "风格保存失败");
        }
    };

    const removeUserStyle = async (style: StyleLibraryItem) => {
        if (!token || !style.id) return;
        if (!window.confirm(`确定删除“${style.name}”吗？`)) return;
        setError("");
        try {
            await deleteStyle(token, style.id);
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "风格删除失败");
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/35 p-4 md:p-6" onMouseDown={onClose} onWheel={(event) => event.stopPropagation()}>
            <div className="relative mx-auto flex h-full max-h-[900px] w-full max-w-[1440px] flex-col overflow-hidden rounded-[18px] border shadow-[0_30px_100px_rgba(0,0,0,0.28)]" style={{ background: modalTheme.toolbar.panel, borderColor: modalTheme.toolbar.border, color: modalTheme.node.text }} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-4 md:px-6 md:py-5">
                    <h3 className="text-lg font-semibold md:text-xl" style={{ color: modalTheme.node.text }}>风格库</h3>
                    <button type="button" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition hover:opacity-85" style={{ background: modalTheme.toolbar.activeBg, color: modalTheme.toolbar.activeText }} onClick={onClose} aria-label="关闭风格库">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="border-b px-4 pb-3 md:px-6 md:pb-4" style={{ borderColor: modalTheme.toolbar.border }}>
                    <div className="thin-scrollbar flex gap-2 overflow-x-auto pb-1">
                        {modalCategories.map((item) => (
                            <button key={item} type="button" className="shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm transition hover:opacity-85" style={category === item ? { background: modalTheme.toolbar.activeBg, color: modalTheme.toolbar.activeText } : { background: modalTheme.node.fill, color: modalTheme.node.text }} onClick={() => onCategoryChange(item)}>
                                {item}
                            </button>
                        ))}
                    </div>
                    {error ? <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.14)", color: "#fecaca" }}>{error}</div> : null}
                </div>
                <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
                        {token && (category === "全部" || category === "我的风格") ? <StyleUploadCard theme={modalTheme} onSelect={openCreateDraft} /> : null}
                        {displayedStyles.map((style) => (
                            <div key={`${style.source || "public"}:${style.id || style.name}`} className="group overflow-hidden rounded-2xl border text-left shadow-[0_18px_42px_rgba(0,0,0,0.16)] transition hover:opacity-95" style={{ background: modalTheme.node.panel, borderColor: selectedStyle === style.name ? modalTheme.node.activeStroke : modalTheme.node.stroke }}>
                                <button type="button" className="block w-full cursor-pointer text-left" onClick={() => onSelect(style)}>
                                <div className="relative aspect-[9/16] overflow-hidden" style={{ background: modalTheme.node.fill }}>
                                    {style.isNew ? <span className="absolute left-2 top-2 z-10 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: modalTheme.toolbar.activeBg, color: modalTheme.toolbar.activeText }}>New</span> : null}
                                    {style.source === "user" ? <span className="absolute left-2 top-2 z-10 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: modalTheme.toolbar.activeBg, color: modalTheme.toolbar.activeText }}>我的</span> : null}
                                    {style.image ? <img alt={style.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={style.image} /> : <div className="flex h-full w-full items-center justify-center px-3 text-center text-sm" style={{ color: modalTheme.node.muted }}>{style.name}</div>}
                                    {style.previews?.length ? (
                                        <div className="absolute bottom-3 right-3 flex shrink-0 -space-x-2">
                                            {style.previews.map((preview) => (
                                                <img key={preview} alt="" className="h-8 w-8 rounded-lg border border-white/20 object-cover shadow-lg" src={preview} />
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                                </button>
                                <div className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <button type="button" className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-semibold" style={{ color: modalTheme.node.text }} onClick={() => onSelect(style)}>
                                            {style.name}
                                        </button>
                                        {style.source === "user" ? (
                                            <div className="flex shrink-0 items-center gap-1">
                                                <button type="button" className="grid size-7 cursor-pointer place-items-center rounded-lg transition hover:opacity-85" style={{ background: modalTheme.node.fill, color: modalTheme.node.text }} onClick={() => setDraft({ id: style.id, name: style.name, description: style.description || style.prompt || "", imageUrl: style.image })} aria-label="编辑风格" title="编辑风格">
                                                    <Pencil className="size-3.5" />
                                                </button>
                                                <button type="button" className="grid size-7 cursor-pointer place-items-center rounded-lg transition hover:opacity-85" style={{ background: modalTheme.node.fill, color: modalTheme.node.text }} onClick={() => void removeUserStyle(style)} aria-label="删除风格" title="删除风格">
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {draft ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 p-4" onMouseDown={() => setDraft(null)}>
                        <div className="w-full max-w-[460px] rounded-2xl border p-4 shadow-2xl" style={{ background: modalTheme.toolbar.panel, borderColor: modalTheme.toolbar.border, color: modalTheme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                            <div className="mb-4 flex items-center justify-between">
                                <h4 className="text-base font-semibold">{draft.id ? "编辑我的风格" : "保存到我的风格"}</h4>
                                <button type="button" className="grid size-8 cursor-pointer place-items-center rounded-full" style={{ background: modalTheme.node.fill, color: modalTheme.node.text }} onClick={() => setDraft(null)} aria-label="关闭">
                                    <X className="size-4" />
                                </button>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-[130px_1fr]">
                                <img src={draft.imageUrl} alt={draft.name} className="aspect-[9/16] w-full rounded-2xl object-cover" style={{ background: modalTheme.node.fill }} />
                                <div className="space-y-3">
                                    <label className="block text-xs font-semibold" style={{ color: modalTheme.node.text }}>
                                        风格名称
                                        <input className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3 text-sm outline-none" style={{ borderColor: modalTheme.node.stroke, color: modalTheme.node.text }} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                                    </label>
                                    <label className="block text-xs font-semibold" style={{ color: modalTheme.node.text }}>
                                        风格描述
                                        <textarea className="mt-1 h-28 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" style={{ borderColor: modalTheme.node.stroke, color: modalTheme.node.text }} value={draft.description} placeholder="描述画面风格、色彩、材质、镜头或氛围" onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
                                    </label>
                                    <button type="button" className="h-10 w-full cursor-pointer rounded-xl text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" style={{ background: modalTheme.toolbar.activeBg, color: modalTheme.toolbar.activeText }} disabled={isSaving} onClick={() => void saveDraft()}>
                                        {isSaving ? "保存中..." : "保存风格"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>,
        document.body,
    );
}

function StyleUploadCard({ theme, onSelect }: { theme: Theme; onSelect: (file?: File) => void }) {
    return (
        <label className="flex aspect-[9/16] min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed transition hover:opacity-85 md:min-h-[220px]" style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.muted }}>
            <Upload className="h-9 w-9" />
            <span className="mt-3 text-sm">上传风格图片</span>
            <input type="file" accept="image/*" className="hidden" onChange={(event) => handleStyleUpload(event, onSelect)} />
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

export function normalizeProjectBriefSettings(settings?: Partial<AdminProjectBriefSettings>): ProjectBriefSettings {
    const visualStyles = (settings?.visualStyles || [])
        .map((item) => ({
            name: item.name?.trim() || "",
            category: item.category?.trim() || "",
            prompt: item.prompt?.trim() || "",
            image: "coverUrl" in item ? item.coverUrl?.trim() || "" : item.image?.trim() || "",
            previews: [],
            isNew: "isNew" in item ? item.isNew : false,
        }))
        .filter((item) => item.name && item.image);
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

function userStyleToLibraryItem(style: { id: string; name: string; description?: string; prompt?: string; imageUrl: string }): StyleLibraryItem {
    return {
        id: style.id,
        name: style.name,
        category: "我的风格",
        prompt: style.prompt || style.description || "",
        description: style.description || "",
        image: style.imageUrl,
        source: "user",
    };
}

function handleStyleUpload(event: ChangeEvent<HTMLInputElement>, onSelect: (file?: File) => void) {
    onSelect(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
}
