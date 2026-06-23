"use client";

import { App } from "antd";
import { Globe2, Plus, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { fetchAdminSettings, saveAdminSettings, type AdminSettings, type AdminSiteNavigationItem, type AdminSiteSettings } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

import { normalizeSettings } from "../model-management";

const panelClass = "rounded-[24px] border border-white/[0.08] bg-[#11141b]";
const inputClass = "h-9 w-full rounded-xl border border-white/[0.08] bg-[#1b1f29] px-3 text-sm text-white outline-none placeholder:text-[#667085] focus:border-white/45";
const primaryButtonClass = "inline-flex h-9 items-center justify-center rounded-xl border border-white/[0.16] bg-[#2b303b] px-4 text-sm font-medium text-white transition hover:bg-[#363d4a] disabled:cursor-not-allowed disabled:opacity-60";
const outlineButtonClass = "inline-flex h-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-[#cfd7e6] transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60";

const defaultSite: AdminSiteSettings = {
    logoUrl: "/logo.svg",
    name: "无限画布",
    slogan: "AI 创意工作台",
    navigation: [
        { id: "canvas", label: "我的画布", path: "/canvas", enabled: true, sort: 10 },
        { id: "image", label: "生图工作台", path: "/image", enabled: true, sort: 20 },
        { id: "video", label: "视频创作台", path: "/video", enabled: true, sort: 30 },
        { id: "prompts", label: "提示词库", path: "/prompts", enabled: true, sort: 40 },
        { id: "assets", label: "我的素材", path: "/assets", enabled: true, sort: 50 },
    ],
};

export default function AdminSiteSettingsPage() {
    const token = useUserStore((state) => state.token);
    const { message } = App.useApp();
    const [settings, setSettings] = useState<AdminSettings | null>(null);
    const [site, setSite] = useState(defaultSite);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const enabledNavCount = useMemo(() => site.navigation.filter((item) => item.enabled).length, [site.navigation]);

    const loadSettings = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data = normalizeSettings(await fetchAdminSettings(token));
            setSettings(data);
            setSite(normalizeSite(data.public.site));
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取站点配置失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSettings();
    }, [token]);

    const saveSite = async () => {
        if (!token || !settings) return;
        setSaving(true);
        try {
            const nextSite = normalizeSite(site);
            const saved = normalizeSettings(await saveAdminSettings(token, { ...settings, public: { ...settings.public, site: nextSite } }));
            setSettings(saved);
            setSite(normalizeSite(saved.public.site));
            message.success("站点配置已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const patchSite = (patch: Partial<AdminSiteSettings>) => {
        setSite((current) => ({ ...current, ...patch }));
    };

    const updateNav = (index: number, patch: Partial<AdminSiteNavigationItem>) => {
        patchSite({ navigation: site.navigation.map((item, current) => (current === index ? { ...item, ...patch } : item)) });
    };

    const addNav = () => {
        patchSite({ navigation: [...site.navigation, { id: `nav-${Date.now()}`, label: "新导航", path: "/", enabled: true, sort: nextSort(site.navigation) }] });
    };

    const removeNav = (index: number) => {
        patchSite({ navigation: site.navigation.filter((_, current) => current !== index) });
    };

    const uploadLogo = (file?: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => patchSite({ logoUrl: String(reader.result || "") });
        reader.readAsDataURL(file);
    };

    return (
        <main className="min-h-full bg-[#08090d] p-4 text-white md:p-6">
            <div className="mx-auto max-w-[1180px]">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-[26px] font-semibold tracking-tight text-white">站点管理</h1>
                        <p className="mt-2 text-sm text-[#8f97aa]">管理前台 LOGO、网站名称、广告语和顶部导航显示。</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button className={outlineButtonClass} onClick={() => void loadSettings()} disabled={loading}>
                            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            刷新
                        </button>
                        <button className={primaryButtonClass} onClick={() => void saveSite()} disabled={saving}>
                            <Save className="mr-1.5 h-4 w-4" />
                            保存配置
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
                    <section className={`${panelClass} h-fit p-5`}>
                        <div className="mb-4 flex items-center gap-2">
                            <Globe2 className="h-4 w-4 text-white" />
                            <h2 className="text-base font-semibold text-white">站点信息</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1b1f29]">
                                    {site.logoUrl ? <img src={site.logoUrl} alt="LOGO" className="h-full w-full object-contain p-2" /> : <Globe2 className="h-6 w-6 text-[#8f97aa]" />}
                                </div>
                                <label className={`${outlineButtonClass} cursor-pointer`}>
                                    <Upload className="mr-1.5 h-4 w-4" />
                                    上传 LOGO
                                    <input className="hidden" type="file" accept="image/*" onChange={(event) => uploadLogo(event.currentTarget.files?.[0])} />
                                </label>
                            </div>
                            <Field label="LOGO 地址">
                                <input className={inputClass} value={site.logoUrl} onChange={(event) => patchSite({ logoUrl: event.target.value })} placeholder="/logo.svg 或图片地址" />
                            </Field>
                            <Field label="网站名称">
                                <input className={inputClass} value={site.name} onChange={(event) => patchSite({ name: event.target.value })} placeholder="无限画布" />
                            </Field>
                            <Field label="广告语">
                                <input className={inputClass} value={site.slogan} onChange={(event) => patchSite({ slogan: event.target.value })} placeholder="AI 创意工作台" />
                            </Field>
                        </div>
                    </section>

                    <section className={`${panelClass} overflow-hidden`}>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
                            <div>
                                <h2 className="text-base font-semibold text-white">顶部导航</h2>
                                <p className="mt-1 text-xs text-[#8f97aa]">当前显示 {enabledNavCount} 个导航，可新增、删除、排序和关闭显示。</p>
                            </div>
                            <button className={outlineButtonClass} onClick={addNav}>
                                <Plus className="mr-1.5 h-4 w-4" />
                                新增导航选项
                            </button>
                        </div>
                        <div className="space-y-3 p-5">
                            {site.navigation.map((item, index) => (
                                <div key={`${item.id}-${index}`} className="grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 md:grid-cols-[84px_1fr_1.2fr_88px_1fr_40px] md:items-end">
                                    <Field label="显示">
                                        <Toggle checked={item.enabled} onChange={(enabled) => updateNav(index, { enabled })} />
                                    </Field>
                                    <Field label="导航名称">
                                        <input className={inputClass} value={item.label} onChange={(event) => updateNav(index, { label: event.target.value })} placeholder="我的画布" />
                                    </Field>
                                    <Field label="跳转路径">
                                        <input className={inputClass} value={item.path} onChange={(event) => updateNav(index, { path: event.target.value })} placeholder="/canvas" />
                                    </Field>
                                    <Field label="排序">
                                        <input className={inputClass} type="number" min={0} value={item.sort} onChange={(event) => updateNav(index, { sort: Number(event.target.value) || 0 })} />
                                    </Field>
                                    <Field label="ID">
                                        <input className={inputClass} value={item.id} onChange={(event) => updateNav(index, { id: event.target.value })} placeholder="canvas" />
                                    </Field>
                                    <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[#cfd7e6] transition hover:bg-white/[0.06] hover:text-white" onClick={() => removeNav(index)} title="删除导航">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                            {site.navigation.length === 0 ? <div className="rounded-2xl border border-dashed border-white/[0.10] px-4 py-8 text-center text-sm text-[#8f97aa]">暂无导航项。</div> : null}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="space-y-2">
            <span className="block text-sm font-medium text-white">{label}</span>
            {children}
        </label>
    );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <button type="button" onClick={() => onChange(!checked)} className={`${checked ? "border-white/[0.28] bg-[#3a4250]" : "border-white/[0.10] bg-white/[0.08]"} relative inline-flex h-7 w-12 shrink-0 rounded-full border transition`}>
            <span className={`${checked ? "left-6 bg-white" : "left-1 bg-[#aab2c0]"} absolute top-1 h-5 w-5 rounded-full transition`} />
        </button>
    );
}

function normalizeSite(site?: Partial<AdminSiteSettings>): AdminSiteSettings {
    const navigation = site?.navigation === undefined ? defaultSite.navigation : site.navigation;
    return {
        logoUrl: site?.logoUrl?.trim() || "/logo.svg",
        name: site?.name?.trim() || "无限画布",
        slogan: site?.slogan?.trim() || "",
        navigation: (navigation || [])
            .map((item, index) => ({
                id: item.id?.trim() || `nav-${index + 1}`,
                label: item.label?.trim() || "",
                path: normalizePath(item.path || ""),
                enabled: item.enabled === true,
                sort: Math.max(0, Number(item.sort) || 0),
            }))
            .filter((item) => item.label && item.path)
            .sort((a, b) => a.sort - b.sort),
    };
}

function normalizePath(path: string) {
    const value = path.trim();
    if (!value) return "";
    if (value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://")) return value;
    return `/${value}`;
}

function nextSort(items: AdminSiteNavigationItem[]) {
    return Math.max(0, ...items.map((item) => Number(item.sort) || 0)) + 10;
}
