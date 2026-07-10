"use client";

import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, FileVideo, Image as ImageIcon, Layers3, LoaderCircle, Maximize2, Minimize2, Pencil, Plus, Search, Trash2, Upload, Wand2 } from "lucide-react";

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
const storyboardFullscreenGridColumns = "52px minmax(220px,1fr) minmax(160px,.6fr) minmax(240px,1fr) minmax(280px,1.15fr) minmax(240px,1fr) minmax(280px,1.15fr)";

export function SubjectBoardNodeContent({ node, theme, onMetadataChange, onOpenMediaEditor, fullscreen }: BoardContentProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeGroupId, setActiveGroupId] = useState("characters");
    const board = normalizeSubjectBoard(node.metadata?.subjectBoard);
    const total = board.groups.reduce((sum, group) => sum + group.items.length, 0);
    const activeGroup = board.groups.find((group) => group.id === activeGroupId) || board.groups[0]!;

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
        <BoardShell theme={theme} title="角色板" meta={`${total} 个主体`} action={<BoardActionButton theme={theme} label={`添加${activeGroup.title}`} icon={<Plus className="size-3.5" />} onClick={() => addItem(activeGroup)} />}>
            <div className={fullscreen ? "grid min-h-full grid-cols-[168px_minmax(0,1fr)] gap-4" : "grid min-h-full grid-cols-[132px_minmax(0,1fr)] gap-3"}>
                <aside className="rounded-xl border p-2" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                    <div className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.16em]" style={{ color: theme.node.muted }}>
                        主体分类
                    </div>
                    <div className="flex flex-col gap-1">
                        {board.groups.map((group) => {
                            const active = group.id === activeGroup.id;
                            return (
                                <button
                                    key={group.id}
                                    type="button"
                                    className="flex h-10 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-xs font-medium transition"
                                    style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.node.text : theme.node.muted, border: `1px solid ${active ? theme.node.activeStroke : "transparent"}` }}
                                    onClick={() => setActiveGroupId(group.id)}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onPointerDown={(event) => event.stopPropagation()}
                                >
                                    <span>{group.title}</span>
                                    <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: active ? theme.node.fill : theme.toolbar.panel, color: theme.node.text }}>
                                        {group.items.length}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </aside>
                <section className="min-w-0 rounded-xl border p-3" style={{ borderColor: theme.toolbar.border, background: `${theme.toolbar.panel}99` }}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold" style={{ color: theme.node.text }}>
                                {activeGroup.title}
                            </h3>
                            <p className="mt-1 text-[11px]" style={{ color: theme.node.muted }}>
                                {activeGroup.items.length ? `${activeGroup.items.length} 个${activeGroup.title}主体` : `管理${activeGroup.title}主体，供分镜和生成时引用`}
                            </p>
                        </div>
                    </div>
                    {activeGroup.items.length ? (
                        <div className={fullscreen ? "grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4" : "grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3"}>
                            {activeGroup.items.map((item) => (
                                <SubjectCard key={item.id} nodeId={node.id} groupId={activeGroup.id} item={item} theme={theme} editing={editingId === item.id} fullscreen={fullscreen} active={node.metadata?.subjectPanelGroupId === activeGroup.id && node.metadata?.subjectPanelItemId === item.id} onEditingChange={setEditingId} onChange={updateItem} onGenerate={() => openGenerationPanel(activeGroup.id, item.id)} onOpenMediaEditor={onOpenMediaEditor} />
                            ))}
                        </div>
                    ) : (
                        <EmptySubjectState theme={theme} group={activeGroup} onAdd={() => addItem(activeGroup)} />
                    )}
                </section>
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
        const id = nextStoryboardShotId(board.shots);
        updateBoard({
            shots: [
                ...board.shots,
                createStoryboardShot(id),
            ],
        });
        setEditingId(id);
    };
    const insertShotAfter = (shotId: string) => {
        const id = nextStoryboardShotId(board.shots);
        const index = board.shots.findIndex((shot) => shot.id === shotId);
        const nextShots = [...board.shots];
        nextShots.splice(index + 1, 0, createStoryboardShot(id));
        updateBoard({ shots: nextShots });
        setEditingId(id);
    };
    const deleteShot = (shotId: string) => {
        if (!window.confirm("确定删除这一条分镜吗？")) return;
        const nextStoryboard = { shots: board.shots.filter((shot) => shot.id !== shotId) };
        if (node.metadata?.storyboardPanelShotId === shotId) onMetadataChange?.(node.id, { storyboard: nextStoryboard, storyboardPanelMode: undefined, storyboardPanelShotId: undefined, status: "success" });
        else updateBoard(nextStoryboard);
        setEditingId((current) => (current === shotId ? null : current));
    };
    const openGenerationPanel = (mode: CanvasStoryboardGenerationMode, shotId: string) => {
        const samePanel = node.metadata?.storyboardPanelMode === mode && node.metadata?.storyboardPanelShotId === shotId;
        onMetadataChange?.(node.id, { storyboardPanelMode: samePanel ? undefined : mode, storyboardPanelShotId: samePanel ? undefined : shotId, status: "success" });
    };

    return (
        <BoardShell theme={theme} title="分镜板" meta={`${board.shots.length} 镜`} action={<BoardActionButton theme={theme} label="添加分镜" icon={<Plus className="size-3.5" />} onClick={addShot} />}>
            {board.shots.length ? (
                <div className={fullscreen ? "w-full min-w-[1520px]" : "min-w-[1180px]"}>
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
                    <div>
                        {board.shots.map((shot, index) => (
                            <Fragment key={shot.id}>
                                <StoryboardRow
                                    shot={shot}
                                    displayIndex={index + 1}
                                    theme={theme}
                                    activePanelMode={node.metadata?.storyboardPanelShotId === shot.id ? node.metadata?.storyboardPanelMode : undefined}
                                    editing={editingId === shot.id}
                                    fullscreen={fullscreen}
                                    subjectReferences={subjectReferences}
                                    onEditingChange={setEditingId}
                                    onChange={updateShot}
                                    onDelete={deleteShot}
                                    onOpenPanel={openGenerationPanel}
                                    onOpenMediaEditor={(kind) => onOpenMediaEditor?.({ boardType: "storyboard", nodeId: node.id, shotId: shot.id, kind })}
                                />
                                {index < board.shots.length - 1 ? <InsertShotDivider theme={theme} onClick={() => insertShotAfter(shot.id)} /> : null}
                            </Fragment>
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

function StoryboardRow({ shot, displayIndex, theme, activePanelMode, editing, fullscreen, subjectReferences, onEditingChange, onChange, onDelete, onOpenPanel, onOpenMediaEditor }: { shot: CanvasStoryboardShot; displayIndex: number; theme: Theme; activePanelMode?: CanvasStoryboardGenerationMode; editing: boolean; fullscreen?: boolean; subjectReferences: CanvasStoryboardReference[]; onEditingChange: (id: string | null) => void; onChange: (shotId: string, patch: Partial<CanvasStoryboardShot>) => void; onDelete: (shotId: string) => void; onOpenPanel: (mode: CanvasStoryboardGenerationMode, shotId: string) => void; onOpenMediaEditor?: (kind: "image" | "video") => void }) {
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
        <article className="relative grid items-start gap-2 rounded-lg border p-2 pr-11" style={{ ...rowStyle, gridTemplateColumns: fullscreen ? storyboardFullscreenGridColumns : storyboardGridColumns }}>
            <button type="button" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md border transition hover:scale-[1.03]" style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }} title="删除分镜" aria-label="删除分镜" onClick={() => onDelete(shot.id)} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                <Trash2 className="size-3.5" />
            </button>
            <div className={`flex ${numberHeight} items-start justify-center pt-2 text-sm font-semibold`}>
                <span>{displayIndex}</span>
            </div>
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
            <MediaSlotView theme={theme} fullscreen={fullscreen} slot={shot.image} history={shot.imageHistory} kind="image" active={activePanelMode === "image"} onOpenPanel={() => onOpenPanel("image", shot.id)} onOpenEditor={() => onOpenMediaEditor?.("image")} onSelectVariant={(image) => onChange(shot.id, { image })} onUpload={(url) => onChange(shot.id, { image: { status: "done", url }, imageHistory: [...(shot.imageHistory || []), { status: "done", url }] })} />
            <PromptTextCell theme={theme} fullscreen={fullscreen} placeholder="用于生成这一镜视频的提示词" value={shot.videoPrompt || ""} onChange={(videoPrompt) => onChange(shot.id, { videoPrompt })} />
            <MediaSlotView theme={theme} fullscreen={fullscreen} slot={shot.video} history={shot.videoHistory} kind="video" active={activePanelMode === "video"} onOpenPanel={() => onOpenPanel("video", shot.id)} onOpenEditor={() => onOpenMediaEditor?.("video")} onSelectVariant={(video) => onChange(shot.id, { video })} onUpload={(url) => onChange(shot.id, { video: { status: "done", url }, videoHistory: [...(shot.videoHistory || []), { status: "done", url }] })} />
        </article>
    );
}

function InsertShotDivider({ theme, onClick }: { theme: Theme; onClick: () => void }) {
    return (
        <div className="relative flex h-7 items-center justify-center">
            <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 opacity-70" style={{ background: theme.node.stroke }} />
            <button type="button" className="relative z-10 grid size-7 cursor-pointer place-items-center rounded-full border shadow-sm transition hover:scale-[1.06]" style={{ background: theme.toolbar.panel, borderColor: theme.node.stroke, color: theme.node.text }} title="在这里插入分镜" aria-label="在这里插入分镜" onClick={onClick} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                <Plus className="size-3.5" />
            </button>
        </div>
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

function MediaSlotView({ theme, slot, history, kind, active, fullscreen, onOpenPanel, onOpenEditor, onSelectVariant, onUpload }: { theme: Theme; slot?: CanvasMediaSlot; history?: CanvasMediaSlot[]; kind: "image" | "video"; active?: boolean; fullscreen?: boolean; onOpenPanel: () => void; onOpenEditor?: () => void; onSelectVariant: (slot: CanvasMediaSlot) => void; onUpload: (url: string) => void }) {
    const [historyOpen, setHistoryOpen] = useState(false);
    const variants = doneMediaItems(slot, history);
    const done = slot?.status === "done" && slot.url;
    const generating = slot?.status === "generating";
    const currentUrl = done ? slot.url : "";
    const showHistory = variants.length > 1;
    const preview = generating ? (
        <LoaderCircle className="size-7 animate-spin opacity-70" />
    ) : done ? (
        kind === "image" ? <img src={slot.url} alt="" className="h-full w-full object-cover" /> : <video src={slot.url} muted className="h-full w-full object-cover" data-canvas-no-zoom />
    ) : kind === "image" ? (
        <ImageIcon className="size-7 opacity-35" />
    ) : (
        <FileVideo className="size-7 opacity-35" />
    );

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <button type="button" className={`relative flex ${fullscreen ? "h-[304px]" : "aspect-video"} w-full items-center justify-center overflow-hidden rounded-lg border`} style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.placeholder }} onClick={onOpenEditor || onOpenPanel}>
                {preview}
                <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-md border backdrop-blur" style={{ background: `${theme.toolbar.panel}d9`, borderColor: theme.toolbar.border, color: theme.node.text }}>
                    <Maximize2 className="size-3.5" />
                </span>
                {showHistory ? (
                    <span className="absolute left-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold backdrop-blur" style={{ background: `${theme.toolbar.panel}d9`, borderColor: theme.toolbar.border, color: theme.node.text }}>
                        {variants.length}
                    </span>
                ) : null}
            </button>
            {showHistory ? (
                <div className="relative">
                    <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition hover:scale-[1.01]" style={buttonStyle(theme, historyOpen)} onClick={() => setHistoryOpen((value) => !value)} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                        <Layers3 className="size-3.5" />
                        <span>{variants.length}</span>
                        {historyOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                    {historyOpen ? (
                        <div className="absolute left-0 top-8 z-30 max-h-52 w-full overflow-auto rounded-lg border p-2 shadow-2xl" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                            <div className="grid grid-cols-4 gap-2">
                                {variants.map((item) => {
                                    const selected = item.url === currentUrl;
                                    return (
                                        <button
                                            key={item.url}
                                            type="button"
                                            className="relative aspect-video overflow-hidden rounded-md border transition hover:scale-[1.01]"
                                            style={{ borderColor: selected ? theme.node.activeStroke : theme.node.stroke, boxShadow: selected ? `0 0 0 1px ${theme.node.activeStroke} inset` : "none" }}
                                            onClick={() => {
                                                onSelectVariant(item);
                                                setHistoryOpen(false);
                                            }}
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onPointerDown={(event) => event.stopPropagation()}
                                        >
                                            {kind === "image" ? <img src={item.url} alt="" className="h-full w-full object-cover" /> : <video src={item.url} muted className="h-full w-full object-cover" data-canvas-no-zoom />}
                                            {selected ? (
                                                <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full" style={{ background: theme.node.activeStroke, color: theme.toolbar.activeText }}>
                                                    <Check className="size-2.5" />
                                                </span>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}
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

function EmptySubjectState({ theme, group, onAdd }: { theme: Theme; group: CanvasSubjectBoardGroup; onAdd: () => void }) {
    return (
        <div className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-dashed px-5 py-6 text-center" style={{ borderColor: theme.node.stroke, background: theme.node.fill, color: theme.node.muted }}>
            <div className="mb-3 grid size-10 place-items-center rounded-full" style={{ background: theme.toolbar.panel, color: theme.node.text }}>
                <Plus className="size-5" />
            </div>
            <div className="text-sm font-semibold" style={{ color: theme.node.text }}>
                暂无{group.title}
            </div>
            <div className="mt-1 max-w-[260px] text-[11px] leading-5">添加{group.title}后，可作为分镜、生成和主体参考使用。</div>
            <div className="mt-4">
                <BoardActionButton theme={theme} label={`添加${group.title}`} icon={<Plus className="size-3.5" />} onClick={onAdd} />
            </div>
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

function doneMediaItems(current?: CanvasMediaSlot, history?: CanvasMediaSlot[]): Array<CanvasMediaSlot & { url: string }> {
    const items = [...(history || [])];
    if (current?.status === "done" && current.url) items.push(current);
    return items.filter((item, index, list): item is CanvasMediaSlot & { url: string } => item.status === "done" && Boolean(item.url) && list.findIndex((candidate) => candidate.url === item.url) === index);
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

function createStoryboardShot(id: string): CanvasStoryboardShot {
    return {
        id,
        description: "",
        references: [],
        image: { status: "empty" },
        video: { status: "empty" },
    };
}

function nextStoryboardShotId(shots: CanvasStoryboardShot[]) {
    const usedIds = new Set(shots.map((shot) => shot.id));
    const maxNumber = shots.reduce((max, shot) => {
        const value = Number(shot.id);
        return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
    let next = Math.max(maxNumber + 1, shots.length + 1);
    while (usedIds.has(String(next))) next += 1;
    return String(next);
}

function normalizeStoryboard(board?: CanvasStoryboard): CanvasStoryboard {
    return { shots: board?.shots || [] };
}
