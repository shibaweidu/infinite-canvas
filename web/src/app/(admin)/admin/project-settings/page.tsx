"use client";

import { App } from "antd";
import { Edit2, ImageIcon, Plus, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { fetchAdminSettings, saveAdminSettings, type AdminProjectBriefSettings, type AdminProjectStoryPreset, type AdminProjectVisualStyle, type AdminSettings } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

import { normalizeSettings } from "../model-management";

const panelClass = "rounded-[24px] border border-white/[0.08] bg-[#11141b]";
const inputClass = "h-9 w-full rounded-xl border border-white/[0.08] bg-[#1b1f29] px-3 text-sm text-white outline-none placeholder:text-[#667085] focus:border-white/45";
const textareaClass = "w-full rounded-xl border border-white/[0.08] bg-[#1b1f29] px-3 py-2 text-sm text-white outline-none placeholder:text-[#667085] focus:border-white/45";
const primaryButtonClass = "inline-flex h-9 items-center justify-center rounded-xl border border-white/[0.16] bg-[#2b303b] px-4 text-sm font-medium text-white transition hover:bg-[#363d4a] disabled:cursor-not-allowed disabled:opacity-60";
const outlineButtonClass = "inline-flex h-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-[#cfd7e6] transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass = "grid size-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#9aa3b5] transition hover:bg-white/[0.06] hover:text-white";

const defaultProjectBriefSettings: AdminProjectBriefSettings = {
    genres: ["科幻", "悬疑", "爱情", "冒险", "奇幻", "都市", "广告", "儿童动画", "纪录片"],
    styleCategories: ["我的风格", "最近使用", "立体风格", "国风", "IP风格", "欧美风格", "日系风格", "插画风格", "韩系", "可爱Q版"],
    visualStyles: [
        { name: "KpopCG", category: "韩系", prompt: "韩系偶像写真质感，精致妆造，高饱和舞台光，商业 CG 渲染。", coverUrl: "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnpo9im1_39c786142b2473e8.webp" },
        { name: "游戏CG", category: "立体风格", prompt: "高品质游戏 CG，电影级布光，细节丰富，空间层次清晰。", coverUrl: "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2FNhe9bnBOkoh8LSxYaG7cMct7nDg.webp" },
        { name: "像素农场", category: "可爱Q版", prompt: "可爱像素农场风，Q 版角色，明亮色彩，轻松治愈的游戏画面。", coverUrl: "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnps4e2n_f772bf318499f660.webp" },
        { name: "国风水墨", category: "国风", prompt: "国风水墨，美术留白，柔和宣纸肌理，东方诗意构图。", coverUrl: "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmmybot0eaa74e8f640da0bf4.webp" },
        { name: "电影感", category: "欧美风格", prompt: "电影级摄影，真实光影，浅景深，情绪化色彩分级。", coverUrl: "" },
    ],
    storyPresets: [
        { title: "科幻追逐", text: "一个年轻程序员深夜发现自己开发的 AI 正在现实世界中追捕他，他必须在黎明前关闭系统。" },
        { title: "温情治愈", text: "一个长期独处的人在一次意外相遇后，重新学会与他人建立连接，并找回生活的温度。" },
        { title: "悬疑反转", text: "主角接到一条来自未来的警告信息，循着线索调查后发现真正的危险来自自己最信任的人。" },
    ],
};

const emptyStyle: AdminProjectVisualStyle = { category: "", name: "", prompt: "", coverUrl: "" };
const emptyStory: AdminProjectStoryPreset = { title: "", text: "" };

export default function AdminProjectSettingsPage() {
    const token = useUserStore((state) => state.token);
    const { message } = App.useApp();
    const [settings, setSettings] = useState<AdminSettings | null>(null);
    const [projectBrief, setProjectBrief] = useState(defaultProjectBriefSettings);
    const [genreDraft, setGenreDraft] = useState("");
    const [categoryDraft, setCategoryDraft] = useState("");
    const [storyDraft, setStoryDraft] = useState(emptyStory);
    const [styleDraft, setStyleDraft] = useState<AdminProjectVisualStyle | null>(null);
    const [styleIndex, setStyleIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const categoryOptions = useMemo(() => unique([...projectBrief.styleCategories, ...projectBrief.visualStyles.map((item) => item.category)]), [projectBrief]);

    const loadSettings = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data = normalizeSettings(await fetchAdminSettings(token));
            setSettings(data);
            setProjectBrief(normalizeProjectBriefSettings(data.public.projectBrief));
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取故事设定失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSettings();
    }, [token]);

    const persist = async () => {
        if (!token || !settings) return;
        setSaving(true);
        try {
            const nextProjectBrief = normalizeProjectBriefSettings(projectBrief);
            const saved = normalizeSettings(await saveAdminSettings(token, { ...settings, public: { ...settings.public, projectBrief: nextProjectBrief } }));
            setSettings(saved);
            setProjectBrief(normalizeProjectBriefSettings(saved.public.projectBrief));
            message.success("已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const patchProjectBrief = (patch: Partial<AdminProjectBriefSettings>) => {
        setProjectBrief((current) => normalizeProjectBriefSettings({ ...current, ...patch }));
    };

    const addGenre = () => {
        const value = genreDraft.trim();
        if (!value || projectBrief.genres.includes(value)) return;
        patchProjectBrief({ genres: [...projectBrief.genres, value] });
        setGenreDraft("");
    };

    const addCategory = () => {
        const value = categoryDraft.trim();
        if (!value || projectBrief.styleCategories.includes(value)) return;
        patchProjectBrief({ styleCategories: [...projectBrief.styleCategories, value] });
        setCategoryDraft("");
    };

    const saveStyle = () => {
        if (!styleDraft?.name.trim()) {
            message.warning("请填写风格名称");
            return;
        }
        const draft = normalizeStyle(styleDraft);
        const visualStyles = styleIndex === null ? [...projectBrief.visualStyles, draft] : projectBrief.visualStyles.map((item, index) => (index === styleIndex ? draft : item));
        patchProjectBrief({ visualStyles, styleCategories: draft.category && !projectBrief.styleCategories.includes(draft.category) ? [...projectBrief.styleCategories, draft.category] : projectBrief.styleCategories });
        setStyleDraft(null);
        setStyleIndex(null);
    };

    const addStory = () => {
        const draft = normalizeStory(storyDraft);
        if (!draft.title || !draft.text) {
            message.warning("请填写预设标题和故事内容");
            return;
        }
        patchProjectBrief({ storyPresets: [...projectBrief.storyPresets, draft] });
        setStoryDraft(emptyStory);
    };

    return (
        <main className="min-h-full bg-[#08090d] p-4 text-white md:p-6">
            {styleDraft ? <StyleEditor categories={categoryOptions} draft={styleDraft} onChange={(patch) => setStyleDraft((current) => (current ? normalizeStyle({ ...current, ...patch }) : current))} onClose={() => setStyleDraft(null)} onSave={saveStyle} /> : null}
            <div className="mx-auto max-w-[1320px]">
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-[26px] font-semibold tracking-tight text-white">故事设定管理</h1>
                        <p className="mt-2 text-sm text-[#8f97aa]">维护故事设定节点里的题材、视觉风格和故事预设。</p>
                    </div>
                    <div className="flex gap-2">
                        <button className={outlineButtonClass} onClick={() => void loadSettings()} disabled={loading}>
                            <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
                            刷新
                        </button>
                        <button className={primaryButtonClass} onClick={() => void persist()} disabled={saving || loading}>
                            <Save className="mr-2 size-4" />
                            保存
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="space-y-4">
                        <section className={`${panelClass} p-4`}>
                            <SectionTitle title="题材管理" action={`${projectBrief.genres.length} 个`} />
                            <div className="mt-4 flex gap-2">
                                <input className={inputClass} value={genreDraft} placeholder="新增题材" onChange={(event) => setGenreDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addGenre()} />
                                <button className={primaryButtonClass} onClick={addGenre}>
                                    <Plus className="size-4" />
                                </button>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {projectBrief.genres.map((genre) => (
                                    <Tag key={genre} label={genre} onDelete={() => patchProjectBrief({ genres: projectBrief.genres.filter((item) => item !== genre) })} />
                                ))}
                            </div>
                        </section>

                        <section className={`${panelClass} p-4`}>
                            <SectionTitle title="风格分类" action={`${projectBrief.styleCategories.length} 个`} />
                            <div className="mt-4 flex gap-2">
                                <input className={inputClass} value={categoryDraft} placeholder="新增分类" onChange={(event) => setCategoryDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addCategory()} />
                                <button className={primaryButtonClass} onClick={addCategory}>
                                    <Plus className="size-4" />
                                </button>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {projectBrief.styleCategories.map((category) => (
                                    <Tag key={category} label={category} onDelete={() => patchProjectBrief({ styleCategories: projectBrief.styleCategories.filter((item) => item !== category) })} />
                                ))}
                            </div>
                        </section>

                        <section className={`${panelClass} p-4`}>
                            <SectionTitle title="故事预设" action={`${projectBrief.storyPresets.length} 条`} />
                            <div className="mt-4 space-y-2">
                                <input className={inputClass} value={storyDraft.title} placeholder="预设标题" onChange={(event) => setStoryDraft({ ...storyDraft, title: event.target.value })} />
                                <textarea className={`${textareaClass} h-24 resize-none`} value={storyDraft.text} placeholder="故事预设内容" onChange={(event) => setStoryDraft({ ...storyDraft, text: event.target.value })} />
                                <button className={primaryButtonClass} onClick={addStory}>
                                    <Plus className="mr-2 size-4" />
                                    新增预设
                                </button>
                            </div>
                            <div className="mt-4 space-y-2">
                                {projectBrief.storyPresets.map((preset, index) => (
                                    <div key={`${preset.title}-${index}`} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-white">{preset.title}</div>
                                                <div className="mt-1 line-clamp-3 text-xs leading-5 text-[#8f97aa]">{preset.text}</div>
                                            </div>
                                            <button className={iconButtonClass} onClick={() => patchProjectBrief({ storyPresets: projectBrief.storyPresets.filter((_, current) => current !== index) })} aria-label="删除故事预设">
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <section className={`${panelClass} min-h-[520px] p-4`}>
                        <div className="flex items-center justify-between gap-3">
                            <SectionTitle title="视觉风格管理" action={`${projectBrief.visualStyles.length} 个`} />
                            <button
                                className={primaryButtonClass}
                                onClick={() => {
                                    setStyleIndex(null);
                                    setStyleDraft(emptyStyle);
                                }}
                            >
                                <Plus className="mr-2 size-4" />
                                新增风格
                            </button>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-4">
                            {projectBrief.visualStyles.map((style, index) => (
                                <div key={`${style.name}-${index}`} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#151923]">
                                    <div className="relative aspect-[9/13] bg-[#0f1219]">
                                        {style.coverUrl ? <img className="h-full w-full object-cover" src={style.coverUrl} alt={style.name} /> : <div className="flex h-full items-center justify-center text-[#667085]"><ImageIcon className="size-8" /></div>}
                                        <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white">{style.category || "未分类"}</div>
                                    </div>
                                    <div className="p-3">
                                        <div className="truncate text-sm font-semibold text-white">{style.name}</div>
                                        <div className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-[#8f97aa]">{style.prompt || "未填写风格提示词"}</div>
                                        <div className="mt-3 flex gap-2">
                                            <button className={outlineButtonClass} onClick={() => { setStyleIndex(index); setStyleDraft(style); }}>
                                                <Edit2 className="mr-2 size-4" />
                                                编辑
                                            </button>
                                            <button className={iconButtonClass} onClick={() => patchProjectBrief({ visualStyles: projectBrief.visualStyles.filter((_, current) => current !== index) })} aria-label="删除视觉风格">
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

function StyleEditor({ categories, draft, onChange, onClose, onSave }: { categories: string[]; draft: AdminProjectVisualStyle; onChange: (patch: Partial<AdminProjectVisualStyle>) => void; onClose: () => void; onSave: () => void }) {
    return (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/65 p-4">
            <div className="w-full max-w-[680px] rounded-[24px] border border-white/[0.08] bg-[#11141b] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">编辑视觉风格</h2>
                    <button className={iconButtonClass} onClick={onClose} aria-label="关闭">
                        <X className="size-4" />
                    </button>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                    <div>
                        <div className="aspect-[9/13] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1219]">
                            {draft.coverUrl ? <img className="h-full w-full object-cover" src={draft.coverUrl} alt={draft.name} /> : <div className="flex h-full items-center justify-center text-[#667085]"><ImageIcon className="size-8" /></div>}
                        </div>
                        <label className={`${outlineButtonClass} mt-3 w-full cursor-pointer`}>
                            <Upload className="mr-2 size-4" />
                            上传封面
                            <input type="file" accept="image/*" className="hidden" onChange={(event) => void readImageFile(event.currentTarget.files?.[0]).then((url) => url && onChange({ coverUrl: url }))} />
                        </label>
                    </div>
                    <div className="space-y-3">
                        <Field label="风格分类">
                            <input className={inputClass} list="project-style-categories" value={draft.category} placeholder="例如：国风" onChange={(event) => onChange({ category: event.target.value })} />
                            <datalist id="project-style-categories">
                                {categories.map((category) => (
                                    <option key={category} value={category} />
                                ))}
                            </datalist>
                        </Field>
                        <Field label="风格名称">
                            <input className={inputClass} value={draft.name} placeholder="例如：电影感" onChange={(event) => onChange({ name: event.target.value })} />
                        </Field>
                        <Field label="风格提示词">
                            <textarea className={`${textareaClass} h-32 resize-none`} value={draft.prompt} placeholder="描述该风格要注入到下游提示词里的视觉要求" onChange={(event) => onChange({ prompt: event.target.value })} />
                        </Field>
                        <Field label="风格封面">
                            <input className={inputClass} value={draft.coverUrl} placeholder="图片 URL 或上传后的 data URL" onChange={(event) => onChange({ coverUrl: event.target.value })} />
                        </Field>
                    </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                    <button className={outlineButtonClass} onClick={onClose}>取消</button>
                    <button className={primaryButtonClass} onClick={onSave}>保存风格</button>
                </div>
            </div>
        </div>
    );
}

function SectionTitle({ title, action }: { title: string; action: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-[#9aa3b5]">{action}</span>
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#9aa3b5]">{label}</span>
            {children}
        </label>
    );
}

function Tag({ label, onDelete }: { label: string; onDelete: () => void }) {
    return (
        <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] pl-3 pr-1 text-sm text-[#d6dce8]">
            {label}
            <button className="grid size-6 place-items-center rounded-md text-[#9aa3b5] hover:bg-white/[0.08] hover:text-white" onClick={onDelete} aria-label={`删除${label}`}>
                <X className="size-3.5" />
            </button>
        </span>
    );
}

function normalizeProjectBriefSettings(settings?: Partial<AdminProjectBriefSettings>): AdminProjectBriefSettings {
    const visualStyles = (settings?.visualStyles ? settings.visualStyles : defaultProjectBriefSettings.visualStyles).map(normalizeStyle).filter((item) => item.name);
    return {
        genres: unique(settings?.genres ? settings.genres : defaultProjectBriefSettings.genres),
        styleCategories: unique(settings?.styleCategories ? settings.styleCategories : defaultProjectBriefSettings.styleCategories),
        visualStyles,
        storyPresets: (settings?.storyPresets ? settings.storyPresets : defaultProjectBriefSettings.storyPresets).map(normalizeStory).filter((item) => item.title && item.text),
    };
}

function normalizeStyle(style: Partial<AdminProjectVisualStyle>): AdminProjectVisualStyle {
    return { category: style.category?.trim() || "", name: style.name?.trim() || "", prompt: style.prompt?.trim() || "", coverUrl: style.coverUrl?.trim() || "", previewUrls: style.previewUrls || [] };
}

function normalizeStory(story: Partial<AdminProjectStoryPreset>): AdminProjectStoryPreset {
    return { title: story.title?.trim() || "", text: story.text?.trim() || "" };
}

function unique(items: string[]) {
    return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function readImageFile(file: File | undefined) {
    if (!file) return Promise.resolve("");
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}
