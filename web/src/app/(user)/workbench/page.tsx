"use client";

import { App, Button, Empty, Image, Input, Modal, Popover, Tag } from "antd";
import { ChevronDown, Clapperboard, Download, FolderPlus, Image as ImageIcon, Images, LoaderCircle, Pencil, Plus, Send, Trash2, Video, WandSparkles, X, type LucideIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { saveAs } from "file-saver";
import localforage from "localforage";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ModelPicker } from "@/components/model-picker";
import { GenerationStylePicker } from "@/components/generation-style-picker";
import { ImageSettingsPanel } from "@/components/image-settings-panel";
import { VideoSettingsPanel, normalizeVideoResolutionValue, normalizeVideoSizeValue, videoSizeLabel } from "@/components/video-settings-panel";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { AssetPickerModal, type InsertAssetPayload } from "@/app/(user)/canvas/components/asset-picker-modal";
import { canvasThemes } from "@/lib/canvas-theme";
import { formatBytes, formatDuration, getDataUrlByteSize, readImageMeta } from "@/lib/image-utils";
import { boolConfig, isSeedanceVideoConfig, normalizeSeedanceRatio, seedanceVideoReferenceError, seedanceVideoReferenceHint, SEEDANCE_REFERENCE_LIMITS } from "@/lib/seedance-video";
import { applyGenerationStylePrompt, findGenerationStyle, prependStyleReference } from "@/lib/generation-style";
import type { AdminProjectVisualStyle } from "@/services/api/admin";
import { requestEdit, requestGeneration } from "@/services/api/image";
import { requestVideoGeneration, storeGeneratedVideo } from "@/services/api/video";
import { resolveMediaUrl, uploadMediaFile } from "@/services/file-storage";
import { resolveImageUrl, uploadImage } from "@/services/image-storage";
import { useAssetStore } from "@/stores/use-asset-store";
import { modelOptionName, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { useUserStyleStore } from "@/stores/use-user-style-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

const EMPTY_VISUAL_STYLES: AdminProjectVisualStyle[] = [];
type GenerateMode = "image" | "video";
type WorkFilter = "all" | "image" | "video";
type ImageWork = {
    id: string;
    projectId: string;
    type: "image";
    prompt: string;
    model: string;
    createdAt: number;
    url: string;
    storageKey?: string;
    width: number;
    height: number;
    bytes: number;
    durationMs: number;
};
type VideoWork = {
    id: string;
    projectId: string;
    type: "video";
    prompt: string;
    model: string;
    createdAt: number;
    url: string;
    storageKey?: string;
    width: number;
    height: number;
    bytes: number;
    durationMs: number;
    mimeType?: string;
};
type WorkItem = ImageWork | VideoWork;
type GeneratedImage = Omit<ImageWork, "type" | "prompt" | "model" | "createdAt" | "url" | "projectId"> & { dataUrl: string; mimeType?: string };
type GeneratedVideo = Omit<VideoWork, "type" | "prompt" | "model" | "createdAt" | "projectId">;
type ImageLog = { id?: string; projectId?: string; createdAt?: number; prompt?: string; model?: string; images?: Array<GeneratedImage & { dataUrl?: string; storageKey?: string }> };
type VideoLog = { id?: string; projectId?: string; createdAt?: number; prompt?: string; model?: string; video?: GeneratedVideo };
type WorkbenchProject = {
    id: string;
    name: string;
    defaultMode: GenerateMode;
    createdAt: number;
    updatedAt: number;
};

const DEFAULT_PROJECT_ID = "default";
const imageLogStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_generation_logs" });
const videoLogStore = localforage.createInstance({ name: "infinite-canvas", storeName: "video_generation_logs" });
const projectStore = localforage.createInstance({ name: "infinite-canvas", storeName: "workbench_projects" });
const filterItems: Array<{ key: WorkFilter; label: string; icon: LucideIcon }> = [
    { key: "all", label: "全部作品", icon: Images },
    { key: "video", label: "视频", icon: Video },
    { key: "image", label: "图片", icon: ImageIcon },
];

export default function WorkbenchPage() {
    const { message } = App.useApp();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const publicVisualStyles = useConfigStore((state) => state.publicSettings?.projectBrief.visualStyles) || EMPTY_VISUAL_STYLES;
    const token = useUserStore((state) => state.token);
    const userStyles = useUserStyleStore((state) => state.styles);
    const loadUserStyles = useUserStyleStore((state) => state.loadStyles);
    const visualStyles = useMemo(() => [...(token ? userStyles : []).map((item) => ({ name: item.name, prompt: item.prompt || item.description, imageUrl: item.imageUrl })), ...publicVisualStyles], [publicVisualStyles, token, userStyles]);
    const addAsset = useAssetStore((state) => state.addAsset);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<GenerateMode>("image");
    const [filter, setFilter] = useState<WorkFilter>("all");
    const [prompt, setPrompt] = useState("");
    const [works, setWorks] = useState<WorkItem[]>([]);
    const [projects, setProjects] = useState<WorkbenchProject[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState(DEFAULT_PROJECT_ID);
    const [projectModalOpen, setProjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<WorkbenchProject | null>(null);
    const [projectName, setProjectName] = useState("");
    const [references, setReferences] = useState<ReferenceImage[]>([]);
    const [videoReferences, setVideoReferences] = useState<ReferenceVideo[]>([]);
    const [audioReferences, setAudioReferences] = useState<ReferenceAudio[]>([]);
    const [running, setRunning] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [promptDialogOpen, setPromptDialogOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [styleName, setStyleName] = useState("");

    const selectedModel = mode === "image" ? config.imageModel : config.videoModel;
    const model = selectedModel.trim();
    const currentProject = projects.find((item) => item.id === currentProjectId) || projects[0];
    const filteredWorks = useMemo(() => works.filter((item) => filter === "all" || item.type === filter), [filter, works]);
    const stats = useMemo(
        () => ({
            all: works.length,
            image: works.filter((item) => item.type === "image").length,
            video: works.filter((item) => item.type === "video").length,
        }),
        [works],
    );

    useEffect(() => {
        void initializeProjects();
    }, []);

    useEffect(() => {
        if (token) void loadUserStyles(token);
    }, [loadUserStyles, token]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const nextMode = params.get("mode") === "video" ? "video" : params.get("mode") === "image" ? "image" : "";
        const nextPrompt = params.get("prompt") || "";
        const nextModel = params.get("model") || "";
        if (nextMode) setMode(nextMode);
        if (nextPrompt) setPrompt(nextPrompt);
        if (nextModel && nextMode) updateConfig(nextMode === "image" ? "imageModel" : "videoModel", nextModel);
    }, []);

    useEffect(() => {
        if (currentProjectId) void refreshWorks(currentProjectId);
    }, [currentProjectId]);

    useEffect(() => {
        setStyleName((current) => current || config.defaultStyleName);
    }, [config.defaultStyleName]);

    const initializeProjects = async () => {
        const loadedProjects = await readProjects();
        setProjects(loadedProjects);
        const firstProject = loadedProjects[0];
        setCurrentProjectId(firstProject.id);
        setMode(firstProject.defaultMode);
        await refreshWorks(firstProject.id);
    };

    const refreshWorks = async (projectId = currentProjectId) => setWorks(await readWorks(projectId));

    const openCreateProject = () => {
        setEditingProject(null);
        setProjectName("");
        setProjectModalOpen(true);
    };

    const openRenameProject = (project: WorkbenchProject) => {
        setEditingProject(project);
        setProjectName(project.name);
        setProjectModalOpen(true);
    };

    const saveProject = async () => {
        const name = projectName.trim();
        if (!name) {
            message.warning("请输入项目名称");
            return;
        }
        const now = Date.now();
        const nextProjects = editingProject
            ? projects.map((item) => (item.id === editingProject.id ? { ...item, name, updatedAt: now } : item))
            : [{ id: nanoid(), name, defaultMode: mode, createdAt: now, updatedAt: now }, ...projects];
        await writeProjects(nextProjects);
        setProjects(nextProjects);
        if (!editingProject) {
            setCurrentProjectId(nextProjects[0].id);
            clearDraft();
        }
        setProjectModalOpen(false);
    };

    const deleteProject = async (project: WorkbenchProject) => {
        if (projects.length <= 1) {
            message.warning("至少保留一个项目");
            return;
        }
        const confirmed = window.confirm(`确定删除项目“${project.name}”吗？项目内作品记录不会删除，但将不再在项目列表中显示。`);
        if (!confirmed) return;
        const nextProjects = projects.filter((item) => item.id !== project.id);
        await writeProjects(nextProjects);
        setProjects(nextProjects);
        if (project.id === currentProjectId) {
            setCurrentProjectId(nextProjects[0].id);
            setMode(nextProjects[0].defaultMode);
            clearDraft();
        }
    };

    const switchProject = (project: WorkbenchProject) => {
        setCurrentProjectId(project.id);
        setMode(project.defaultMode);
        clearDraft();
    };

    const clearDraft = () => {
        setPrompt("");
        setStyleName(config.defaultStyleName);
        setReferences([]);
        setVideoReferences([]);
        setAudioReferences([]);
    };

    const addReferences = async (files?: FileList | null) => {
        const selectedFiles = Array.from(files || []);
        const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"));
        const remainImageSlots = mode === "video" ? Math.max(0, SEEDANCE_REFERENCE_LIMITS.images - references.length) : imageFiles.length;
        const nextImages = await Promise.all(
            imageFiles.slice(0, remainImageSlots).map(async (file) => {
                const image = await uploadImage(file);
                return { id: nanoid(), name: file.name, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
            }),
        );
        setReferences((value) => (mode === "video" ? [...value, ...nextImages].slice(0, SEEDANCE_REFERENCE_LIMITS.images) : [...value, ...nextImages]));
        if (mode === "image") return;
        const videoFiles = selectedFiles.filter((file) => file.type.startsWith("video/") && file.size <= SEEDANCE_REFERENCE_LIMITS.videoMaxBytes).slice(0, SEEDANCE_REFERENCE_LIMITS.videos - videoReferences.length);
        const audioFiles = selectedFiles.filter((file) => isSupportedAudioFile(file) && file.size <= SEEDANCE_REFERENCE_LIMITS.audioMaxBytes).slice(0, SEEDANCE_REFERENCE_LIMITS.audios - audioReferences.length);
        const nextVideos = await Promise.all(videoFiles.map(async (file) => ({ id: nanoid(), name: file.name, type: file.type, ...(await uploadMediaFile(file, "video-reference")) })));
        const nextAudios = await Promise.all(audioFiles.map(async (file) => ({ id: nanoid(), name: file.name, type: file.type, ...(await uploadMediaFile(file, "audio-reference")) })));
        setVideoReferences((value) => [...value, ...nextVideos].slice(0, SEEDANCE_REFERENCE_LIMITS.videos));
        setAudioReferences((value) => filterAudioReferencesByDuration(value, nextAudios, message.warning).slice(0, SEEDANCE_REFERENCE_LIMITS.audios));
    };

    const removeImageReference = (id: string) => setReferences((value) => value.filter((item) => item.id !== id));
    const removeVideoReference = (id: string) => setVideoReferences((value) => value.filter((item) => item.id !== id));
    const removeAudioReference = (id: string) => setAudioReferences((value) => value.filter((item) => item.id !== id));

    const insertPickedAsset = async (payload: InsertAssetPayload) => {
        if (payload.kind === "text") setPrompt(payload.content);
        else if (payload.kind === "image") {
            const stored = await uploadImage(payload.dataUrl);
            setReferences((value) => [...value, { id: nanoid(), name: payload.title, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }]);
        } else if (payload.kind === "video" && mode === "video") {
            setVideoReferences((value) => [...value, { id: nanoid(), name: payload.title, type: "video/mp4", url: payload.url, storageKey: payload.storageKey, width: payload.width, height: payload.height }].slice(0, SEEDANCE_REFERENCE_LIMITS.videos));
        } else {
            message.warning("当前生成模式不支持该素材");
        }
        setAssetPickerOpen(false);
    };

    const generate = async () => {
        const text = prompt.trim();
        if (!text) {
            message.error(mode === "image" ? "请输入生图提示词" : "请输入视频提示词");
            return;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            message.warning("请先完成配置");
            openConfigDialog(true);
            return;
        }
        if (mode === "video") {
            const videoReferenceError = seedanceVideoReferenceError(videoReferences);
            if (videoReferenceError) {
                message.error(`${videoReferenceError}。${seedanceVideoReferenceHint}`);
                return;
            }
        }
        setRunning(true);
        const startedAt = performance.now();
        try {
            if (mode === "image") await generateImages(text, startedAt);
            else await generateVideo(text, startedAt);
            setPrompt("");
            await refreshWorks();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "生成失败");
        } finally {
            setRunning(false);
        }
    };

    const generateImages = async (text: string, startedAt: number) => {
        const count = Math.max(1, Math.min(10, Number(config.count) || 1));
        const snapshot = { ...effectiveConfig, model, imageModel: model, count: "1" };
        const selectedStyle = findGenerationStyle(visualStyles, styleName);
        const styledText = applyGenerationStylePrompt(text, selectedStyle);
        const styledReferences = prependStyleReference(selectedStyle, references);
        const images = await Promise.all(
            Array.from({ length: count }, async () => {
                const result = styledReferences.length ? await requestEdit(snapshot, styledText, styledReferences) : await requestGeneration(snapshot, styledText);
                const image = result[0];
                if (!image) throw new Error("接口没有返回图片");
                const stored = await uploadImage(image.dataUrl);
                const meta = await readImageMeta(stored.url);
                return { id: image.id || nanoid(), dataUrl: stored.url, storageKey: stored.storageKey, durationMs: performance.now() - startedAt, width: meta.width, height: meta.height, bytes: stored.bytes, mimeType: stored.mimeType };
            }),
        );
        await imageLogStore.setItem(nanoid(), {
            id: nanoid(),
            projectId: currentProjectId,
            createdAt: Date.now(),
            title: text.slice(0, 12) || "未命名",
            prompt: text,
            styleName: selectedStyle?.name,
            model,
            config: { model, imageModel: model, quality: effectiveConfig.quality, size: effectiveConfig.size, count: String(count) },
            references: styledReferences,
            durationMs: performance.now() - startedAt,
            successCount: images.length,
            failCount: 0,
            imageCount: images.length,
            size: effectiveConfig.size,
            quality: effectiveConfig.quality,
            status: "成功",
            images: images.map((image) => ({ ...image, dataUrl: image.storageKey ? "" : image.dataUrl })),
            thumbnails: [],
        });
        message.success("图片已生成");
    };

    const generateVideo = async (text: string, startedAt: number) => {
        const videoConfig = buildVideoConfig(effectiveConfig, model);
        const selectedStyle = findGenerationStyle(visualStyles, styleName);
        const styledText = applyGenerationStylePrompt(text, selectedStyle);
        const styledReferences = prependStyleReference(selectedStyle, references);
        const stored = await storeGeneratedVideo(await requestVideoGeneration(videoConfig, styledText, styledReferences, videoReferences, audioReferences));
        const video = { id: nanoid(), url: stored.url, storageKey: stored.storageKey, durationMs: performance.now() - startedAt, width: stored.width || 1280, height: stored.height || 720, bytes: stored.bytes, mimeType: stored.mimeType };
        await videoLogStore.setItem(nanoid(), {
            id: nanoid(),
            projectId: currentProjectId,
            createdAt: Date.now(),
            title: text.slice(0, 12) || "未命名",
            prompt: text,
            styleName: selectedStyle?.name,
            model,
            config: { model, videoModel: model, size: videoConfig.size, vquality: videoConfig.vquality, videoSeconds: videoConfig.videoSeconds, videoGenerateAudio: videoConfig.videoGenerateAudio, videoWatermark: videoConfig.videoWatermark },
            references: styledReferences,
            videoReferences,
            audioReferences,
            durationMs: video.durationMs,
            size: videoConfig.size,
            resolution: videoConfig.vquality,
            seconds: videoConfig.videoSeconds,
            status: "成功",
            video: video.storageKey ? { ...video, url: "" } : video,
        });
        message.success("视频已生成");
    };

    const saveWorkToAssets = (item: WorkItem) => {
        addAsset(
            item.type === "image"
                ? { kind: "image", title: item.prompt.slice(0, 18) || "生成图片", coverUrl: item.url, tags: [], source: "创作工作台", data: { dataUrl: item.url, storageKey: item.storageKey, width: item.width, height: item.height, bytes: item.bytes, mimeType: "image/png" }, metadata: { source: "workbench", prompt: item.prompt } }
                : { kind: "video", title: item.prompt.slice(0, 18) || "生成视频", coverUrl: "", tags: [], source: "创作工作台", data: { url: item.url, storageKey: item.storageKey, width: item.width, height: item.height, bytes: item.bytes, mimeType: item.mimeType || "video/mp4" }, metadata: { source: "workbench", prompt: item.prompt } },
        );
        message.success("已加入我的素材");
    };

    const downloadWork = (item: WorkItem) => saveAs(item.url, `${item.type}-${item.id}.${item.type === "image" ? "png" : "mp4"}`);

    return (
        <div className="relative flex h-full min-h-[calc(100vh-64px)] overflow-hidden" style={{ background: theme.canvas.background, color: theme.node.text }}>
            <aside className="hidden w-[220px] shrink-0 border-r px-3 py-5 md:block" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}>
                <div className="px-2 pb-5">
                    <h1 className="text-xl font-semibold tracking-normal">创作工作台</h1>
                </div>
                <div className="mb-4 rounded-[14px] border p-2" style={{ background: theme.node.panel, borderColor: theme.toolbar.border }}>
                    <div className="mb-2 flex items-center justify-between px-1">
                        <span className="text-xs" style={{ color: theme.node.muted }}>项目</span>
                        <button type="button" onClick={openCreateProject} className="flex size-7 cursor-pointer items-center justify-center rounded-lg transition hover:opacity-80" style={{ color: theme.node.text }}>
                            <Plus className="size-4" />
                        </button>
                    </div>
                    <div className="max-h-[190px] space-y-1 overflow-y-auto pr-1">
                        {projects.map((project) => {
                            const active = project.id === currentProjectId;
                            return (
                                <div key={project.id} className="group flex items-center gap-1 rounded-xl px-2 py-2 text-sm transition hover:opacity-90" style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : theme.node.text }}>
                                    <button type="button" onClick={() => switchProject(project)} className="min-w-0 flex-1 cursor-pointer truncate text-left">
                                        {project.name}
                                    </button>
                                    <button type="button" onClick={() => openRenameProject(project)} className="grid size-6 cursor-pointer place-items-center rounded-md opacity-0 transition hover:opacity-80 group-hover:opacity-100" style={{ color: theme.node.muted }}>
                                        <Pencil className="size-3.5" />
                                    </button>
                                    <button type="button" onClick={() => void deleteProject(project)} className="grid size-6 cursor-pointer place-items-center rounded-md opacity-0 transition hover:opacity-80 group-hover:opacity-100" style={{ color: theme.node.muted }}>
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <nav className="space-y-1">
                    {filterItems.map((item) => {
                        const active = filter === item.key;
                        const Icon = item.icon;
                        const count = item.key === "all" ? stats.all : item.key === "image" ? stats.image : stats.video;
                        return (
                            <button key={item.key} type="button" onClick={() => setFilter(item.key)} className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm transition hover:opacity-90" style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : theme.node.text }}>
                                <Icon className="size-4" />
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                <span style={{ color: active ? theme.toolbar.activeText : theme.node.muted }}>{count}</span>
                            </button>
                        );
                    })}
                </nav>
            </aside>

            <main className="thin-scrollbar min-w-0 flex-1 overflow-y-auto px-4 pb-[236px] pt-5 md:px-7 lg:px-10">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-normal">作品库</h2>
                        {currentProject ? <div className="mt-1 text-sm" style={{ color: theme.node.muted }}>{currentProject.name}</div> : null}
                    </div>
                    <div className="flex gap-2 md:hidden">
                        {filterItems.map((item) => (
                            <button key={item.key} type="button" onClick={() => setFilter(item.key)} className="h-9 rounded-xl px-3 text-sm" style={{ background: filter === item.key ? theme.toolbar.activeBg : theme.node.panel, color: filter === item.key ? theme.toolbar.activeText : theme.node.text }}>
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
                {filteredWorks.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {filteredWorks.map((item) => (
                            <WorkCard key={`${item.type}-${item.id}`} item={item} onDownload={downloadWork} onSaveAsset={saveWorkToAssets} />
                        ))}
                    </div>
                ) : (
                    <div className="grid min-h-[52vh] place-items-center rounded-[22px] border border-dashed" style={{ background: theme.node.panel, borderColor: theme.node.stroke }}>
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: theme.node.muted }}>暂无作品，试试底部生成器</span>} />
                    </div>
                )}
            </main>

            <UnifiedGeneratorDock
                mode={mode}
                setMode={setMode}
                prompt={prompt}
                setPrompt={setPrompt}
                model={model}
                config={effectiveConfig}
                updateConfig={updateConfig}
                running={running}
                canGenerate={Boolean(prompt.trim())}
                settingsOpen={settingsOpen}
                setSettingsOpen={setSettingsOpen}
                referenceCount={references.length + videoReferences.length + audioReferences.length}
                styleName={styleName}
                setStyleName={setStyleName}
                onGenerate={() => void generate()}
                onUpload={() => fileInputRef.current?.click()}
                references={references}
                videoReferences={videoReferences}
                audioReferences={audioReferences}
                onRemoveImageReference={removeImageReference}
                onRemoveVideoReference={removeVideoReference}
                onRemoveAudioReference={removeAudioReference}
                onPromptDialog={() => setPromptDialogOpen(true)}
                onAssetPicker={() => setAssetPickerOpen(true)}
            />

            <input
                ref={fileInputRef}
                type="file"
                accept={mode === "image" ? "image/*" : "image/*,video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav"}
                multiple
                className="hidden"
                onChange={(event) => {
                    void addReferences(event.target.files);
                    event.target.value = "";
                }}
            />
            <PromptSelectDialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen} onSelect={setPrompt} />
            <AssetPickerModal open={assetPickerOpen} defaultTab="my-assets" onInsert={(payload) => void insertPickedAsset(payload)} onClose={() => setAssetPickerOpen(false)} />
            <Modal
                title={editingProject ? "重命名项目" : "新建项目"}
                open={projectModalOpen}
                onOk={() => void saveProject()}
                onCancel={() => setProjectModalOpen(false)}
                okText="保存"
                cancelText="取消"
                styles={{ content: { background: theme.toolbar.panel, color: theme.node.text }, header: { background: theme.toolbar.panel } }}
            >
                <div className="pt-2">
                    <div className="mb-2 text-sm text-[#c7cedb]">项目名称</div>
                    <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="请输入项目名称" maxLength={30} />
                </div>
            </Modal>
        </div>
    );
}

function UnifiedGeneratorDock({
    mode,
    setMode,
    prompt,
    setPrompt,
    model,
    config,
    updateConfig,
    running,
    canGenerate,
    settingsOpen,
    setSettingsOpen,
    referenceCount,
    references,
    videoReferences,
    audioReferences,
    styleName,
    setStyleName,
    onGenerate,
    onUpload,
    onRemoveImageReference,
    onRemoveVideoReference,
    onRemoveAudioReference,
    onPromptDialog,
    onAssetPicker,
}: {
    mode: GenerateMode;
    setMode: (mode: GenerateMode) => void;
    prompt: string;
    setPrompt: (value: string) => void;
    model: string;
    config: AiConfig;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
    running: boolean;
    canGenerate: boolean;
    settingsOpen: boolean;
    setSettingsOpen: (open: boolean) => void;
    referenceCount: number;
    references: ReferenceImage[];
    videoReferences: ReferenceVideo[];
    audioReferences: ReferenceAudio[];
    styleName: string;
    setStyleName: (value: string) => void;
    onGenerate: () => void;
    onUpload: () => void;
    onRemoveImageReference: (id: string) => void;
    onRemoveVideoReference: (id: string) => void;
    onRemoveAudioReference: (id: string) => void;
    onPromptDialog: () => void;
    onAssetPicker: () => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [modeMenuOpen, setModeMenuOpen] = useState(false);
    const [countMenuOpen, setCountMenuOpen] = useState(false);
    const count = Math.max(1, Math.min(10, Number(config.count) || 1));
    const controlStyle = { background: theme.node.fill, borderColor: theme.toolbar.border, color: theme.node.text };
    const mutedStyle = { color: theme.node.muted };
    const menuButtonClass = "flex h-9 w-full cursor-pointer items-center gap-2 rounded-[10px] px-3 text-left text-sm transition hover:opacity-85";
    const popoverStyle = { background: theme.toolbar.panel, border: `1px solid ${theme.toolbar.border}`, borderRadius: 18, boxShadow: "0 20px 70px rgba(0,0,0,0.28)", color: theme.node.text };
    const settingsPanel = (
        <div className="w-[330px] p-1" style={{ color: theme.node.text }}>
            <button type="button" className="mb-3 ml-auto flex size-7 cursor-pointer items-center justify-center rounded-full transition hover:opacity-85" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }} onClick={() => setSettingsOpen(false)}>
                <X className="size-4" />
            </button>
            {mode === "image" ? <ImageSettingsPanel config={config} onConfigChange={(key, value) => updateConfig(key, value)} theme={theme} showTitle={false} showCount={false} maxCount={10} /> : <VideoSettingsPanel config={config} onConfigChange={(key, value) => updateConfig(key, value)} theme={theme} showTitle={false} />}
        </div>
    );
    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4 md:px-10 lg:px-16 xl:px-24">
            <div className="pointer-events-auto mx-auto w-full max-w-[1180px]">
                <div className="relative mx-auto w-full max-w-[1032px] rounded-[22px] border shadow-[0_30px_80px_rgba(0,0,0,0.28)] md:rounded-[28px]" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}>
                    {referenceCount ? (
                        <div className="flex gap-2 overflow-x-auto px-3 pt-3 [scrollbar-width:none] sm:px-5 md:px-4 [&::-webkit-scrollbar]:hidden">
                            {references.map((item, index) => (
                                <ReferenceThumb key={item.id} label={`图片${index + 1}`} preview={<img src={item.dataUrl} alt={item.name} className="h-full w-full object-cover" />} onRemove={() => onRemoveImageReference(item.id)} theme={theme} />
                            ))}
                            {videoReferences.map((item, index) => (
                                <ReferenceThumb key={item.id} label={`视频${index + 1}`} preview={<video src={item.url} className="h-full w-full bg-black object-cover" muted />} onRemove={() => onRemoveVideoReference(item.id)} theme={theme} />
                            ))}
                            {audioReferences.map((item, index) => (
                                <ReferenceThumb key={item.id} label={`音频${index + 1}`} preview={<div className="flex h-full w-full items-center justify-center text-xs font-medium">音频</div>} onRemove={() => onRemoveAudioReference(item.id)} theme={theme} />
                            ))}
                        </div>
                    ) : null}
                    <div className="px-3 pb-3 pt-3 sm:px-5 md:px-4 md:pb-4 md:pt-4">
                        <div className="flex items-start gap-2 md:gap-3">
                            <DockSquareButton icon={<Plus className="size-6" />} label={referenceCount ? `参考 ${referenceCount}` : "参考图"} theme={theme} onClick={onUpload} />
                            <div className="min-w-0 flex-1 text-left">
                                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={mode === "image" ? "描述画面主体、风格、构图、光线和用途" : "描述镜头运动、主体动作、场景氛围和画面风格"} className="min-h-[76px] w-full resize-none bg-transparent text-[15px] leading-6 outline-none md:min-h-[84px] md:leading-7" style={{ color: theme.node.text }} />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto border-t px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 [scrollbar-width:none] sm:px-5 md:overflow-visible md:px-4 md:pb-4 md:pt-3 [&::-webkit-scrollbar]:hidden" style={{ borderColor: theme.toolbar.border }}>
                        <Popover
                            open={modeMenuOpen}
                            onOpenChange={setModeMenuOpen}
                            trigger="click"
                            placement="topLeft"
                            content={
                                <div className="w-[160px] space-y-1 p-1" style={{ color: theme.node.text }}>
                                    <button type="button" className={menuButtonClass} style={mode === "image" ? { background: theme.toolbar.activeBg, color: theme.toolbar.activeText } : { color: theme.node.text }} onClick={() => { setMode("image"); setModeMenuOpen(false); }}>
                                        <ImageIcon className="size-4" />
                                        <span>图片生成</span>
                                    </button>
                                    <button type="button" className={menuButtonClass} style={mode === "video" ? { background: theme.toolbar.activeBg, color: theme.toolbar.activeText } : { color: theme.node.text }} onClick={() => { setMode("video"); setModeMenuOpen(false); }}>
                                        <Clapperboard className="size-4" />
                                        <span>视频生成</span>
                                    </button>
                                </div>
                            }
                            styles={{ body: popoverStyle }}
                        >
                            <button type="button" className="inline-flex h-[38px] min-w-max shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] border px-3 text-[14px] font-medium transition hover:opacity-85" style={controlStyle}>
                            {mode === "image" ? <ImageIcon className="size-4 opacity-80" /> : <Clapperboard className="size-4 opacity-80" />}
                            <span>{mode === "image" ? "图片生成" : "视频生成"}</span>
                            <ChevronDown className="size-3.5 opacity-60" />
                            </button>
                        </Popover>
                        <div className="min-w-[190px]">
                            <ModelPicker config={config} value={model} onChange={(value) => updateConfig(mode === "image" ? "imageModel" : "videoModel", value)} capability={mode} fullWidth placeholder="选择模型" onMissingConfig={() => useConfigStore.getState().openConfigDialog(false)} className="!h-[38px] !rounded-[10px]" />
                        </div>
                        <GenerationStylePicker value={styleName} onChange={setStyleName} compact className="inline-flex h-[38px] max-w-[150px] shrink-0 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-[14px] font-medium transition hover:opacity-85" style={controlStyle} />
                        {mode === "image" ? (
                            <>
                                <Popover
                                    open={countMenuOpen}
                                    onOpenChange={setCountMenuOpen}
                                    trigger="click"
                                    placement="top"
                                    content={
                                        <div className="grid w-[168px] grid-cols-2 gap-1 p-1" style={{ color: theme.node.text }}>
                                            {Array.from({ length: 10 }, (_, index) => index + 1).map((item) => (
                                                <button key={item} type="button" className="h-9 cursor-pointer rounded-[10px] text-sm transition hover:opacity-85" style={count === item ? { background: theme.toolbar.activeBg, color: theme.toolbar.activeText } : { color: theme.node.text }} onClick={() => { updateConfig("count", String(item)); setCountMenuOpen(false); }}>
                                                    {item} 张
                                                </button>
                                            ))}
                                        </div>
                                    }
                                    styles={{ body: popoverStyle }}
                                >
                                    <button type="button" className="inline-flex h-[38px] min-w-max shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] border px-3 text-[14px] font-medium transition hover:opacity-85" style={controlStyle}>
                                    <span style={mutedStyle}>数量</span>
                                    <span>{count}</span>
                                        <ChevronDown className="size-3.5 opacity-60" />
                                    </button>
                                </Popover>
                                <Popover open={settingsOpen} onOpenChange={setSettingsOpen} trigger="click" placement="top" content={settingsPanel} styles={{ body: popoverStyle }}>
                                    <button type="button" className="inline-flex h-[38px] min-w-max shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] border px-3 text-[14px] font-medium transition hover:opacity-85" style={controlStyle}>
                                    <span className="h-[6px] w-[15px] rounded-[3px] border" style={{ borderColor: theme.node.text }} />
                                    <span>{config.size || "auto"}</span>
                                    <span style={mutedStyle}>- {imageQualityLabel(config.quality)}</span>
                                    </button>
                                </Popover>
                            </>
                        ) : (
                            <Popover open={settingsOpen} onOpenChange={setSettingsOpen} trigger="click" placement="top" content={settingsPanel} styles={{ body: popoverStyle }}>
                                <button type="button" className="inline-flex h-[38px] min-w-max shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] border px-3 text-[14px] font-medium transition hover:opacity-85" style={controlStyle}>
                                <span>{videoSizeLabel(config.size || "1280x720")}</span>
                                <span style={mutedStyle}>· {normalizeVideoResolutionValue(config.vquality)}p · {config.videoSeconds || 6}s</span>
                                </button>
                            </Popover>
                        )}
                        <DockButton theme={theme} onClick={onPromptDialog}>
                            <WandSparkles className="size-4" />
                            <span>提示词 Agent</span>
                        </DockButton>
                        <DockButton theme={theme} onClick={onAssetPicker}>
                            <FolderPlus className="size-4" />
                            <span>素材</span>
                        </DockButton>
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                            <button type="button" disabled={!canGenerate || running} onClick={onGenerate} className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-full border-0 transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}>
                                {running ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DockSquareButton({ icon, label, theme, onClick }: { icon: ReactNode; label: string; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="relative flex h-[76px] w-[58px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[14px] border border-dashed transition hover:opacity-85" style={{ background: theme.node.fill, borderColor: theme.toolbar.border, color: theme.node.muted }}>
            <div className="flex flex-col items-center justify-center">
                <span style={{ color: theme.node.text }}>{icon}</span>
                <span className="mt-1 text-[10px]">{label}</span>
            </div>
        </button>
    );
}

function DockButton({ children, theme, onClick }: { children: ReactNode; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="inline-flex h-[38px] min-w-max shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] border px-3 text-[14px] font-medium transition hover:opacity-85" style={{ background: theme.node.fill, borderColor: theme.toolbar.border, color: theme.node.text }}>
            {children}
        </button>
    );
}

function ReferenceThumb({ label, preview, onRemove, theme }: { label: string; preview: ReactNode; onRemove: () => void; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return (
        <div className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border" style={{ background: theme.node.fill, borderColor: theme.toolbar.border, color: theme.node.text }}>
            {preview}
            <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] text-white">{label}</div>
            <button type="button" onClick={onRemove} className="absolute right-1 top-1 hidden size-5 cursor-pointer items-center justify-center rounded-full bg-black/65 text-white group-hover:flex">
                <X className="size-3" />
            </button>
        </div>
    );
}

function WorkCard({ item, onDownload, onSaveAsset }: { item: WorkItem; onDownload: (item: WorkItem) => void; onSaveAsset: (item: WorkItem) => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    return (
        <article className="group overflow-hidden rounded-[18px] border shadow-[0_12px_40px_rgba(0,0,0,0.18)]" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}>
            <div className="relative bg-black">
                {item.type === "image" ? <Image src={item.url} alt={item.prompt} className="aspect-square object-cover" preview={{ mask: "查看图片" }} /> : <video src={item.url} controls className="aspect-video w-full bg-black object-contain" />}
                <Tag className="absolute left-3 top-3 m-0 rounded-full border-white/10 bg-black/60 px-2 py-0.5 text-white">{item.type === "image" ? "图片" : "视频"}</Tag>
            </div>
            <div className="space-y-3 p-3">
                <div className="line-clamp-2 min-h-10 text-sm font-medium leading-5" style={{ color: theme.node.text }}>{item.prompt || "未命名作品"}</div>
                <div className="flex flex-wrap gap-1.5 text-[11px]" style={{ color: theme.node.muted }}>
                    <span>{item.model ? modelOptionName(item.model) : "未选择模型"}</span>
                    <span>{item.width}x{item.height}</span>
                    {item.bytes ? <span>{formatBytes(item.bytes)}</span> : null}
                    {item.durationMs ? <span>{formatDuration(item.durationMs)}</span> : null}
                </div>
                <div className="flex gap-2">
                    <Button className="!h-8 !rounded-lg" size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => onSaveAsset(item)}>
                        存素材
                    </Button>
                    <Button className="!h-8 !rounded-lg" size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(item)}>
                        下载
                    </Button>
                </div>
            </div>
        </article>
    );
}

async function readWorks(projectId: string): Promise<WorkItem[]> {
    const imageWorks: WorkItem[] = [];
    const videoWorks: WorkItem[] = [];
    await imageLogStore.iterate<ImageLog, void>((log) => {
        if ((log.projectId || DEFAULT_PROJECT_ID) !== projectId) return;
        (log.images || []).forEach((image, index) => {
            imageWorks.push({ id: image.id || `${log.id}-${index}`, projectId: log.projectId || DEFAULT_PROJECT_ID, type: "image", prompt: log.prompt || "", model: log.model || "", createdAt: log.createdAt || Date.now(), url: image.dataUrl || "", storageKey: image.storageKey, width: image.width || 1024, height: image.height || 1024, bytes: image.bytes || getDataUrlByteSize(image.dataUrl || ""), durationMs: image.durationMs || 0 });
        });
    });
    await videoLogStore.iterate<VideoLog, void>((log) => {
        if ((log.projectId || DEFAULT_PROJECT_ID) !== projectId) return;
        if (log.video) videoWorks.push({ ...log.video, projectId: log.projectId || DEFAULT_PROJECT_ID, type: "video", prompt: log.prompt || "", model: log.model || "", createdAt: log.createdAt || Date.now(), url: log.video.url || "" });
    });
    const hydratedImages = await Promise.all(imageWorks.map(async (item) => (item.type === "image" ? { ...item, url: await resolveImageUrl(item.storageKey, item.url) } : item)));
    const hydratedVideos = await Promise.all(videoWorks.map(async (item) => (item.type === "video" ? { ...item, url: await resolveMediaUrl(item.storageKey, item.url) } : item)));
    return [...hydratedImages, ...hydratedVideos].filter((item) => item.url).sort((a, b) => b.createdAt - a.createdAt);
}

async function readProjects(): Promise<WorkbenchProject[]> {
    const projects: WorkbenchProject[] = [];
    await projectStore.iterate<WorkbenchProject, void>((project) => {
        if (project?.id && project.name) projects.push(project);
    });
    if (projects.length) return projects.sort((a, b) => b.updatedAt - a.updatedAt);
    const now = Date.now();
    const defaultProject = { id: DEFAULT_PROJECT_ID, name: "默认项目", defaultMode: "image" as GenerateMode, createdAt: now, updatedAt: now };
    await projectStore.setItem(defaultProject.id, defaultProject);
    return [defaultProject];
}

async function writeProjects(projects: WorkbenchProject[]) {
    await projectStore.clear();
    await Promise.all(projects.map((project) => projectStore.setItem(project.id, project)));
}

function buildVideoConfig(config: AiConfig, model: string): AiConfig {
    const seedance = isSeedanceVideoConfig({ ...config, model });
    return {
        ...config,
        model,
        videoModel: model,
        size: seedance ? normalizeSeedanceRatio(config.size) : normalizeVideoSizeValue(config.size),
        videoSeconds: normalizeVideoSeconds(config.videoSeconds),
        vquality: normalizeVideoResolutionValue(config.vquality),
        videoGenerateAudio: String(boolConfig(config.videoGenerateAudio, true)),
        videoWatermark: String(boolConfig(config.videoWatermark, false)),
    };
}

function normalizeVideoSeconds(value: string) {
    if (String(value).trim() === "-1") return "-1";
    const seconds = Math.floor(Number(value) || 6);
    return String(Math.max(1, Math.min(20, seconds)));
}

function imageQualityLabel(value?: string) {
    if (value === "high") return "4K";
    if (value === "medium") return "2K";
    return "1K";
}

function isSupportedAudioFile(file: File) {
    return file.type === "audio/mpeg" || file.type === "audio/mp3" || file.type === "audio/wav" || file.type === "audio/x-wav" || /\.(mp3|wav)$/i.test(file.name);
}

function filterAudioReferencesByDuration(existing: ReferenceAudio[], next: ReferenceAudio[], warn: (content: string) => void) {
    let total = existing.reduce((sum, item) => sum + (item.durationMs || 0), 0);
    const accepted: ReferenceAudio[] = [];
    let skipped = false;
    for (const item of next) {
        if (item.durationMs && (item.durationMs < 2000 || item.durationMs > 15000 || total + item.durationMs > 15000)) {
            skipped = true;
            continue;
        }
        total += item.durationMs || 0;
        accepted.push(item);
    }
    if (skipped) warn("已忽略不符合时长要求的参考音频：单个 2-15 秒，总时长不超过 15 秒");
    return accepted;
}
