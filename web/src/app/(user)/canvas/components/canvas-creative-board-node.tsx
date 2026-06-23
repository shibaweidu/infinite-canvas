"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, FileVideo, Image as ImageIcon, LoaderCircle, Maximize2, Minimize2, Pencil, Plus, Search, Upload, Wand2 } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { type CanvasBoardMediaEditorTarget, type CanvasMediaSlot, type CanvasNodeData, type CanvasNodeMetadata, type CanvasStoryboard, type CanvasStoryboardGenerationMode, type CanvasStoryboardReference, type CanvasStoryboardShot, type CanvasSubjectBoard, type CanvasSubjectBoardGroup, type CanvasSubjectBoardItem, type CanvasSubjectKind } from "../types";

type Theme = (typeof canvasThemes)[keyof typeof canvasThemes];

type BoardContentProps = {
    node: CanvasNodeData;
    theme: Theme;
    onMetadataChange?: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onOpenMediaEditor?: (target: CanvasBoardMediaEditorTarget) => void;
    fullscreen?: boolean;
    subjectReferences?: CanvasStoryboardReference[];
};

const subjectKindLabel: Record<CanvasSubjectKind, string> = {
    character: "角色",
    scene: "场景",
    prop: "道具",
};

const subjectIdPrefix: Record<CanvasSubjectKind, string> = {
    character: "C",
    scene: "SC",
    prop: "P",
};

const storyboardGridColumns = "48px minmax(180px,1.1fr) 150px minmax(190px,0.9fr) 180px minmax(190px,0.9fr) 180px";
const storyboardFullscreenGridColumns = "52px minmax(260px,1fr) minmax(200px,.7fr) minmax(320px,1.15fr) minmax(460px,1.65fr) minmax(320px,1.15fr) minmax(460px,1.65fr)";

export function SubjectBoardNodeContent({ node, theme, onMetadataChange, onOpenMediaEditor, fullscreen }: BoardContentProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const board = normalizeSubjectBoard(node.metadata?.subjectBoard);
    const total = board.groups.reduce((sum, group) => sum + group.items.length, 0);

    const updateBoard = (next: CanvasSubjectBoard) => onMetadataChange?.(node.id, { subjectBoard: next, status: "success" });
    const updateItem = (groupId: string, itemId: string, patch: Partial<CanvasSubjectBoardItem>) => {
        updateBoard({
            groups: board.groups.map((group) => (group.id === groupId ? { ...group, items: group.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) } : group)),
        });
    };
    const addItem = (group: CanvasSubjectBoardGroup) => {
        const index = group.items.length + 1;
        const id = `${subjectIdPrefix[group.kind]}${String(index).padStart(2, "0")}`;
        updateBoard({
            groups: board.groups.map((item) =>
                item.id === group.id
                    ? {
                          ...item,
                          items: [
                              ...item.items,
                              {
                                  id,
                                  kind: group.kind,
                                  name: `${subjectKindLabel[group.kind]}${index}`,
                                  description: "",
                                  image: { status: "empty" },
                              },
                          ],
                      }
                    : item,
            ),
        });
        setEditingId(id);
    };
    const openGenerationPanel = (groupId: string, itemId: string) => {
        const samePanel = node.metadata?.subjectPanelGroupId === groupId && node.metadata?.subjectPanelItemId === itemId;
        onMetadataChange?.(node.id, { subjectPanelGroupId: samePanel ? undefined : groupId, subjectPanelItemId: samePanel ? undefined : itemId, status: "success" });
    };

    return (
        <BoardShell theme={theme} title="角色板" meta={`${total} 个主体`}>
            <div className="space-y-6">
                {board.groups.map((group) => (
                    <section key={group.id} className="min-w-0">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold" style={{ color: theme.node.text }}>
                                {group.title}
                            </h3>
                            <BoardActionButton theme={theme} label="添加" icon={<Plus className="size-3.5" />} onClick={() => addItem(group)} />
                        </div>
                        {group.items.length ? (
                            <div className={fullscreen ? "grid grid-cols-[repeat(auto-fill,minmax(440px,1fr))] gap-4" : "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"}>
                                {group.items.map((item) => (
                                    <SubjectCard key={item.id} nodeId={node.id} groupId={group.id} item={item} theme={theme} editing={editingId === item.id} fullscreen={fullscreen} active={node.metadata?.subjectPanelGroupId === group.id && node.metadata?.subjectPanelItemId === item.id} onEditingChange={setEditingId} onChange={updateItem} onGenerate={() => openGenerationPanel(group.id, item.id)} onOpenMediaEditor={onOpenMediaEditor} />
                                ))}
                            </div>
                        ) : (
                            <EmptyBoardSection theme={theme} text={`暂无${group.title}`} />
                        )}
                    </section>
                ))}
            </div>
        </BoardShell>
    );
}

function SubjectCard({ nodeId, groupId, item, theme, editing, fullscreen, active, onEditingChange, onChange, onGenerate, onOpenMediaEditor }: { nodeId: string; groupId: string; item: CanvasSubjectBoardItem; theme: Theme; editing: boolean; fullscreen?: boolean; active?: boolean; onEditingChange: (id: string | null) => void; onChange: (groupId: string, itemId: string, patch: Partial<CanvasSubjectBoardItem>) => void; onGenerate: () => void; onOpenMediaEditor?: (target: CanvasBoardMediaEditorTarget) => void }) {
    const cover = item.thumbnail || item.image?.url;
    const cardStyle = { background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text };

    return (
        <article className="overflow-hidden rounded-lg border" style={cardStyle}>
            <button type="button" className="relative block aspect-[16/9] w-full overflow-hidden text-left" style={{ background: theme.node.fill }} onClick={() => onOpenMediaEditor?.({ boardType: "subject", nodeId, groupId, itemId: item.id, kind: "image" })}>
                {cover ? <img src={cover} alt={item.name} className="h-full w-full object-cover" /> : <SubjectPlaceholder theme={theme} label={subjectKindLabel[item.kind]} />}
                <span className="absolute left-2 top-2 size-2 rounded-full bg-emerald-400" />
                <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-md border backdrop-blur" style={{ background: `${theme.toolbar.panel}d9`, borderColor: theme.toolbar.border, color: theme.node.text }}>
                    <Maximize2 className="size-3.5" />
                </span>
            </button>
            <div className="space-y-2 p-3">
                {editing ? (
                    <>
                        <input
                            className="h-8 w-full rounded-md border bg-transparent px-2 text-xs font-semibold outline-none"
                            style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                            value={item.name}
                            onChange={(event) => onChange(groupId, item.id, { name: event.target.value })}
                            onMouseDown={(event) => event.stopPropagation()}
                        />
                        <textarea
                            className={`thin-scrollbar w-full resize-none rounded-md border bg-transparent px-2 py-1.5 text-xs leading-5 outline-none ${fullscreen ? "h-32" : "h-16"}`}
                            style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                            value={item.description || ""}
                            onChange={(event) => onChange(groupId, item.id, { description: event.target.value })}
                            onMouseDown={(event) => event.stopPropagation()}
                        />
                    </>
                ) : (
                    <>
                        <div className="truncate text-xs font-semibold">{item.name}</div>
                        <p className={`${fullscreen ? "line-clamp-4 min-h-20" : "line-clamp-2 min-h-10"} text-[11px] leading-5`} style={{ color: theme.node.muted }}>
                            {item.description || "双击编辑主体描述"}
                        </p>
                    </>
                )}
                <div className="flex items-center justify-between gap-2">
                    <BoardActionButton theme={theme} active={active} label="生成" icon={<Wand2 className="size-3.5" />} onClick={onGenerate} />
                    <UploadButton theme={theme} accept="image/*" label="上传" onFile={(url) => onChange(groupId, item.id, { thumbnail: url, image: { status: "done", url }, imageHistory: [...(item.imageHistory || []), { status: "done", url }] })} />
                    <BoardActionButton theme={theme} label={editing ? "完成" : "编辑"} icon={<Pencil className="size-3.5" />} onClick={() => (editing ? onEditingChange(null) : onOpenMediaEditor?.({ boardType: "subject", nodeId, groupId, itemId: item.id, kind: "image" }))} />
                </div>
            </div>
        </article>
    );
}

export function StoryboardNodeContent({ node, theme, onMetadataChange, onOpenMediaEditor, fullscreen, subjectReferences = [] }: BoardContentProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const board = normalizeStoryboard(node.metadata?.storyboard);
    const updateBoard = (next: CanvasStoryboard) => onMetadataChange?.(node.id, { storyboard: next, status: "success" });
    const updateShot = (shotId: string, patch: Partial<CanvasStoryboardShot>) => {
        updateBoard({ shots: board.shots.map((shot) => (shot.id === shotId ? { ...shot, ...patch } : shot)) });
    };
    const addShot = () => {
        const id = String(board.shots.length + 1);
        updateBoard({
            shots: [
                ...board.shots,
                {
                    id,
                    description: "",
                    references: [],
                    image: { status: "empty" },
                    video: { status: "empty" },
                },
            ],
        });
        setEditingId(id);
    };
    const openGenerationPanel = (mode: CanvasStoryboardGenerationMode, shotId: string) => {
        const samePanel = node.metadata?.storyboardPanelMode === mode && node.metadata?.storyboardPanelShotId === shotId;
        onMetadataChange?.(node.id, { storyboardPanelMode: samePanel ? undefined : mode, storyboardPanelShotId: samePanel ? undefined : shotId, status: "success" });
    };

    return (
        <BoardShell theme={theme} title="分镜板" meta={`${board.shots.length} 镜`} action={<BoardActionButton theme={theme} label="添加分镜" icon={<Plus className="size-3.5" />} onClick={addShot} />}>
            {board.shots.length ? (
                <div className={fullscreen ? "w-full min-w-[1680px]" : "min-w-[1180px]"}>
                    <div
                        className="sticky top-0 z-20 grid gap-2 border-b px-2 pb-2 pt-1 text-[11px] font-semibold"
                        style={{ gridTemplateColumns: fullscreen ? storyboardFullscreenGridColumns : storyboardGridColumns, background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.muted }}
                    >
                        <span>镜头编号</span>
                        <span>分镜描述</span>
                        <span>主体参考</span>
                        <span>分镜图提示词</span>
                        <span>分镜图</span>
                        <span>视频提示词</span>
                        <span>视频</span>
                    </div>
                    <div className="space-y-3">
                        {board.shots.map((shot) => (
                            <StoryboardRow
                                key={shot.id}
                                shot={shot}
                                theme={theme}
                                activePanelMode={node.metadata?.storyboardPanelShotId === shot.id ? node.metadata?.storyboardPanelMode : undefined}
                                editing={editingId === shot.id}
                                fullscreen={fullscreen}
                                subjectReferences={subjectReferences}
                                onEditingChange={setEditingId}
                                onChange={updateShot}
                                onOpenPanel={openGenerationPanel}
                                onOpenMediaEditor={(kind) => onOpenMediaEditor?.({ boardType: "storyboard", nodeId: node.id, shotId: shot.id, kind })}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex h-full min-h-72 items-center justify-center">
                    <button type="button" className="rounded-xl border px-4 py-3 text-sm font-medium transition hover:scale-[1.01]" style={{ borderColor: theme.node.stroke, color: theme.node.text }} onClick={addShot}>
                        添加第一个分镜
                    </button>
                </div>
            )}
        </BoardShell>
    );
}

function StoryboardRow({ shot, theme, activePanelMode, editing, fullscreen, subjectReferences, onEditingChange, onChange, onOpenPanel, onOpenMediaEditor }: { shot: CanvasStoryboardShot; theme: Theme; activePanelMode?: CanvasStoryboardGenerationMode; editing: boolean; fullscreen?: boolean; subjectReferences: CanvasStoryboardReference[]; onEditingChange: (id: string | null) => void; onChange: (shotId: string, patch: Partial<CanvasStoryboardShot>) => void; onOpenPanel: (mode: CanvasStoryboardGenerationMode, shotId: string) => void; onOpenMediaEditor?: (kind: "image" | "video") => void }) {
    const rowStyle = { background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text };
    const cellHeight = fullscreen ? "h-[304px]" : "h-24";
    const numberHeight = fullscreen ? "h-[304px]" : "h-28";
    const [referencePickerOpen, setReferencePickerOpen] = useState(false);
    const [referenceQuery, setReferenceQuery] = useState("");
    const selectedIds = new Set(shot.references.map((item) => item.id));
    const filteredSubjectReferences = subjectReferences.filter((item) => {
        const keyword = referenceQuery.trim().toLowerCase();
        return !keyword || `${item.name} ${item.kind}`.toLowerCase().includes(keyword);
    });
    const toggleReference = (reference: CanvasStoryboardReference) => {
        onChange(shot.id, { references: selectedIds.has(reference.id) ? shot.references.filter((item) => item.id !== reference.id) : [...shot.references, reference] });
    };

    return (
        <article className="grid items-start gap-2 rounded-lg border p-2" style={{ ...rowStyle, gridTemplateColumns: fullscreen ? storyboardFullscreenGridColumns : storyboardGridColumns }}>
            <div className={`flex ${numberHeight} items-start justify-center pt-2 text-sm font-semibold`}>{shot.id}</div>
            <div className="flex min-w-0 flex-col items-start gap-2">
                {editing ? (
                    <textarea
                        autoFocus
                        className={`thin-scrollbar ${cellHeight} w-full resize-none rounded-md border bg-transparent px-2 py-1.5 text-xs leading-5 outline-none`}
                        style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                        value={shot.description}
                        onChange={(event) => onChange(shot.id, { description: event.target.value })}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        onWheel={(event) => event.stopPropagation()}
                    />
                ) : (
                    <p className={`thin-scrollbar ${cellHeight} w-full overflow-y-auto whitespace-pre-wrap rounded-md px-1 py-1 text-xs leading-5`} style={{ color: shot.description ? theme.node.text : theme.node.muted }} onDoubleClick={() => onEditingChange(shot.id)}>
                        {shot.description || "双击编辑分镜描述"}
                    </p>
                )}
                <BoardActionButton theme={theme} label={editing ? "完成" : "编辑"} icon={<Pencil className="size-3.5" />} onClick={() => onEditingChange(editing ? null : shot.id)} />
            </div>
            <div className="flex min-w-0 flex-col items-start gap-2">
                <div className={`thin-scrollbar ${cellHeight} w-full overflow-y-auto`}>
                    {shot.references.length ? (
                        <div className="flex flex-wrap gap-1.5">
                            {shot.references.map((reference) => (
                                <span key={reference.id} className="inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-1 text-[10px]" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                                    {reference.thumbnail ? <img src={reference.thumbnail} alt={reference.name} className="size-5 rounded object-cover" /> : null}
                                    <span className="truncate">{reference.name}</span>
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="px-1 py-1 text-xs" style={{ color: theme.node.muted }}>
                            暂无主体
                        </div>
                    )}
                </div>
                <div className="relative">
                    <BoardActionButton theme={theme} label="主体" icon={<Plus className="size-3.5" />} onClick={() => setReferencePickerOpen((value) => !value)} />
                    {referencePickerOpen ? (
                        <div className="absolute left-0 top-9 z-30 w-[280px] rounded-xl border p-2 shadow-2xl" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                            <label className="mb-2 flex h-9 items-center gap-2 rounded-lg border px-2 text-xs" style={{ borderColor: theme.node.stroke, background: theme.node.fill, color: theme.node.text }}>
                                <Search className="size-3.5 shrink-0 opacity-60" />
                                <input className="min-w-0 flex-1 bg-transparent outline-none" value={referenceQuery} placeholder="搜索主体" onChange={(event) => setReferenceQuery(event.target.value)} />
                            </label>
                            <div className="thin-scrollbar max-h-64 space-y-1 overflow-y-auto pr-1">
                                {filteredSubjectReferences.length ? (
                                    filteredSubjectReferences.map((reference) => {
                                        const selected = selectedIds.has(reference.id);
                                        return (
                                            <button key={reference.id} type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:scale-[1.01]" style={{ background: selected ? theme.toolbar.activeBg : "transparent", color: theme.node.text }} onClick={() => toggleReference(reference)}>
                                                <span className="grid size-4 shrink-0 place-items-center rounded border" style={{ borderColor: selected ? theme.node.activeStroke : theme.node.stroke, background: selected ? theme.node.activeStroke : "transparent", color: selected ? theme.toolbar.activeText : theme.node.text }}>
                                                    {selected ? <Check className="size-3" /> : null}
                                                </span>
                                                {reference.thumbnail ? <img src={reference.thumbnail} alt={reference.name} className="size-7 shrink-0 rounded-md object-cover" /> : <span className="size-7 shrink-0 rounded-md border" style={{ borderColor: theme.node.stroke, background: theme.node.fill }} />}
                                                <span className="min-w-0 flex-1 truncate">{reference.name}</span>
                                                <span className="shrink-0 rounded border px-1 py-0.5 text-[10px]" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                                                    {subjectKindLabel[reference.kind]}
                                                </span>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="rounded-lg border px-3 py-6 text-center text-xs" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                                        暂无可选主体
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
            <PromptTextCell theme={theme} fullscreen={fullscreen} placeholder="用于生成这一镜分镜图的提示词" value={shot.imagePrompt || ""} onChange={(imagePrompt) => onChange(shot.id, { imagePrompt })} />
            <MediaSlotView theme={theme} fullscreen={fullscreen} slot={shot.image} kind="image" active={activePanelMode === "image"} onOpenPanel={() => onOpenPanel("image", shot.id)} onOpenEditor={() => onOpenMediaEditor?.("image")} onUpload={(url) => onChange(shot.id, { image: { status: "done", url }, imageHistory: [...(shot.imageHistory || []), { status: "done", url }] })} />
            <PromptTextCell theme={theme} fullscreen={fullscreen} placeholder="用于生成这一镜视频的提示词" value={shot.videoPrompt || ""} onChange={(videoPrompt) => onChange(shot.id, { videoPrompt })} />
            <MediaSlotView theme={theme} fullscreen={fullscreen} slot={shot.video} kind="video" active={activePanelMode === "video"} onOpenPanel={() => onOpenPanel("video", shot.id)} onOpenEditor={() => onOpenMediaEditor?.("video")} onUpload={(url) => onChange(shot.id, { video: { status: "done", url }, videoHistory: [...(shot.videoHistory || []), { status: "done", url }] })} />
        </article>
    );
}

function PromptTextCell({ theme, placeholder, value, fullscreen, onChange }: { theme: Theme; placeholder: string; value: string; fullscreen?: boolean; onChange: (value: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="relative w-full">
            <textarea
                className={`thin-scrollbar ${expanded ? (fullscreen ? "h-[420px]" : "h-56") : fullscreen ? "h-[304px]" : "h-28"} w-full resize-none rounded-lg border bg-transparent py-2 pl-2.5 pr-10 text-xs leading-5 outline-none`}
                style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onWheel={(event) => event.stopPropagation()}
            />
            <button
                type="button"
                className="absolute right-2 top-2 grid size-7 place-items-center rounded-md border transition hover:scale-[1.03]"
                style={{ background: `${theme.toolbar.panel}e6`, borderColor: theme.toolbar.border, color: theme.node.text }}
                title={expanded ? "收起提示词" : "展开提示词"}
                aria-label={expanded ? "收起提示词" : "展开提示词"}
                onClick={() => setExpanded((value) => !value)}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
            >
                {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
        </div>
    );
}

function MediaSlotView({ theme, slot, kind, active, fullscreen, onOpenPanel, onOpenEditor, onUpload }: { theme: Theme; slot?: CanvasMediaSlot; kind: "image" | "video"; active?: boolean; fullscreen?: boolean; onOpenPanel: () => void; onOpenEditor?: () => void; onUpload: (url: string) => void }) {
    const done = slot?.status === "done" && slot.url;
    const generating = slot?.status === "generating";
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <button type="button" className={`relative flex ${fullscreen ? "h-[304px]" : "aspect-video"} w-full items-center justify-center overflow-hidden rounded-lg border`} style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.placeholder }} onClick={onOpenEditor || onOpenPanel}>
                {generating ? <LoaderCircle className="size-7 animate-spin opacity-70" /> : done ? kind === "image" ? <img src={slot.url} alt="分镜图" className="h-full w-full object-cover" /> : <video src={slot.url} muted className="h-full w-full object-cover" data-canvas-no-zoom /> : kind === "image" ? <ImageIcon className="size-7 opacity-35" /> : <FileVideo className="size-7 opacity-35" />}
                <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-md border backdrop-blur" style={{ background: `${theme.toolbar.panel}d9`, borderColor: theme.toolbar.border, color: theme.node.text }}>
                    <Maximize2 className="size-3.5" />
                </span>
            </button>
            <div className="grid grid-cols-3 gap-1.5">
                <BoardActionButton theme={theme} active={active} label={kind === "image" ? "生图" : "视频"} icon={<Wand2 className="size-3.5" />} onClick={onOpenPanel} />
                <UploadButton theme={theme} accept={kind === "image" ? "image/*" : "video/*"} label="上传" onFile={onUpload} />
                <BoardActionButton theme={theme} label="编辑" icon={<Pencil className="size-3.5" />} onClick={() => onOpenEditor?.()} />
            </div>
        </div>
    );
}

function BoardShell({ theme, title, meta, action, children }: { theme: Theme; title: string; meta: string; action?: ReactNode; children: ReactNode }) {
    return (
        <div className="flex h-full w-full flex-col overflow-hidden px-4 pb-4 pt-12" style={{ color: theme.node.text }}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                    <h2 className="text-sm font-semibold">{title}</h2>
                    <span className="text-[11px]" style={{ color: theme.node.muted }}>
                        {meta}
                    </span>
                </div>
                {action}
            </div>
            <div className="thin-scrollbar min-h-0 flex-1 overflow-auto pr-1" style={{ overscrollBehavior: "contain" }} data-canvas-no-zoom onWheel={(event) => event.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}

function EmptyBoardSection({ theme, text }: { theme: Theme; text: string }) {
    return (
        <div className="rounded-lg border px-3 py-8 text-center text-xs" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
            {text}
        </div>
    );
}

function SubjectPlaceholder({ theme, label }: { theme: Theme; label: string }) {
    return (
        <div className="flex h-full w-full items-center justify-center text-xs" style={{ color: theme.node.placeholder }}>
            {label}
        </div>
    );
}

function BoardActionButton({ theme, label, icon, active, onClick }: { theme: Theme; label: string; icon: ReactNode; active?: boolean; onClick: () => void }) {
    return (
        <button type="button" className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap transition hover:scale-[1.01]" style={buttonStyle(theme, active)} onClick={onClick} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            {icon}
            <span className="whitespace-nowrap leading-none">{label}</span>
        </button>
    );
}

function UploadButton({ theme, accept, label, onFile }: { theme: Theme; accept: string; label: string; onFile: (url: string) => void }) {
    return (
        <label className="inline-flex h-7 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap transition hover:scale-[1.01]" style={buttonStyle(theme)} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <Upload className="size-3.5" />
            <span className="whitespace-nowrap leading-none">{label}</span>
            <input type="file" accept={accept} className="hidden" onChange={(event) => void handleFileInput(event.currentTarget.files?.[0], onFile)} />
        </label>
    );
}

function buttonStyle(theme: Theme, active?: boolean): CSSProperties {
    return { background: active ? theme.toolbar.activeBg : theme.node.fill, border: `1px solid ${active ? theme.node.activeStroke : theme.node.stroke}`, color: theme.node.text };
}

async function handleFileInput(file: File | undefined, onFile: (url: string) => void) {
    if (!file) return;
    const url = await readFileAsDataURL(file);
    onFile(url);
}

function readFileAsDataURL(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function normalizeSubjectBoard(board?: CanvasSubjectBoard): CanvasSubjectBoard {
    const groups = board?.groups?.length
        ? board.groups
        : [
              { id: "characters", title: "角色", kind: "character" as const, items: [] },
              { id: "scenes", title: "场景", kind: "scene" as const, items: [] },
              { id: "props", title: "道具", kind: "prop" as const, items: [] },
          ];
    return { groups };
}

function normalizeStoryboard(board?: CanvasStoryboard): CanvasStoryboard {
    return { shots: board?.shots || [] };
}
