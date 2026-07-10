"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { ArrowRight, Clapperboard, ClipboardList, ImageIcon, ListChecks, ScrollText, Sparkles, UsersRound, Video, X } from "lucide-react";

import type { CanvasTheme } from "@/lib/canvas-theme";
import { ProjectBriefNodeContent } from "./canvas-project-brief-node";
import { StoryboardNodeContent, SubjectBoardNodeContent } from "./canvas-creative-board-node";
import { CanvasNodeType, type CanvasBoardMediaEditorTarget, type CanvasConnection, type CanvasNodeData, type CanvasNodeMetadata, type CanvasStoryboardReference } from "../types";

export type CanvasViewMode = "canvas" | "simple";
export type CanvasSimpleModeStep = "brief" | "script" | "subjects" | "storyboard";

type ShortDramaFlowNodes = {
    brief?: CanvasNodeData;
    scriptAgent?: CanvasNodeData;
    script?: CanvasNodeData;
    characterAgent?: CanvasNodeData;
    subjectBoard?: CanvasNodeData;
    storyboardAgent?: CanvasNodeData;
    storyboard?: CanvasNodeData;
};

type CanvasShortDramaSimpleModeProps = {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    theme: CanvasTheme;
    activeStep: CanvasSimpleModeStep;
    runningNodeId: string | null;
    storyboardSubjectReferences: CanvasStoryboardReference[];
    onStepChange: (step: CanvasSimpleModeStep) => void;
    onClose: () => void;
    onCreateFlow: () => void;
    onCreateNext: (node: CanvasNodeData) => void;
    onFocusCanvasNode: (nodeId: string) => void;
    onMetadataChange: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onContentChange: (nodeId: string, content: string, contentHtml?: string) => void;
    onRunAgent: (nodeId: string, prompt: string) => void;
    onOpenBoardMediaEditor: (target: CanvasBoardMediaEditorTarget) => void;
    renderSubjectGenerationPanel: (node: CanvasNodeData) => ReactNode;
    renderStoryboardGenerationPanel: (node: CanvasNodeData) => ReactNode;
};

const steps: Array<{ id: CanvasSimpleModeStep; title: string; icon: typeof ClipboardList; nodeKey: keyof ShortDramaFlowNodes }> = [
    { id: "brief", title: "故事设定", icon: ClipboardList, nodeKey: "brief" },
    { id: "script", title: "剧本", icon: ScrollText, nodeKey: "script" },
    { id: "subjects", title: "角色板", icon: UsersRound, nodeKey: "subjectBoard" },
    { id: "storyboard", title: "分镜板", icon: Clapperboard, nodeKey: "storyboard" },
];

export function CanvasShortDramaSimpleMode({
    nodes,
    connections,
    theme,
    activeStep,
    runningNodeId,
    storyboardSubjectReferences,
    onStepChange,
    onClose,
    onCreateFlow,
    onCreateNext,
    onFocusCanvasNode,
    onMetadataChange,
    onContentChange,
    onRunAgent,
    onOpenBoardMediaEditor,
    renderSubjectGenerationPanel,
    renderStoryboardGenerationPanel,
}: CanvasShortDramaSimpleModeProps) {
    const flow = useMemo(() => buildShortDramaFlow(nodes, connections), [connections, nodes]);
    const activeNode = activeStep === "brief" ? flow.brief : activeStep === "script" ? flow.script : activeStep === "subjects" ? flow.subjectBoard : flow.storyboard;
    const hasFlow = Boolean(flow.brief || flow.script || flow.subjectBoard || flow.storyboard);

    useEffect(() => {
        if (hasFlow) return;
        const close = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", close);
        return () => window.removeEventListener("keydown", close);
    }, [hasFlow, onClose]);

    if (!hasFlow) {
        return (
            <div className="absolute inset-0 z-40 flex items-center justify-center px-6 pt-16" style={{ background: theme.canvas.background, color: theme.node.text }}>
                <div className="relative w-full max-w-[520px] rounded-2xl border p-6 text-center shadow-xl" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}>
                    <button type="button" className="absolute right-3 top-3 grid size-8 cursor-pointer place-items-center rounded-lg transition hover:opacity-70" style={{ color: theme.node.muted }} title="返回画布" aria-label="返回画布" onClick={onClose}>
                        <X className="size-4" />
                    </button>
                    <div className="mx-auto grid size-14 place-items-center rounded-2xl" style={{ background: theme.node.fill, color: theme.node.text }}>
                        <Clapperboard className="size-7" />
                    </div>
                    <h2 className="mt-5 text-xl font-semibold">创建短剧工作流</h2>
                    <p className="mx-auto mt-2 max-w-[360px] text-sm leading-6" style={{ color: theme.node.muted }}>
                        简易模式会创建故事设定、剧本、角色板和分镜板，并保持和画布节点同步。
                    </p>
                    <button type="button" className="mt-5 h-10 cursor-pointer rounded-xl px-4 text-sm font-semibold transition hover:opacity-90" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }} onClick={onCreateFlow}>
                        新建短剧工作流
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 z-40 grid min-h-0 grid-cols-[184px_minmax(0,1fr)_340px] gap-4 px-5 pb-5 pt-20" style={{ background: theme.canvas.background, color: theme.node.text }}>
            <aside className="min-h-0 rounded-2xl border p-2" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}>
                <div className="flex flex-col gap-1">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const current = activeStep === step.id;
                        const done = Boolean(flow[step.nodeKey]);
                        return (
                            <button key={step.id} type="button" className="flex h-12 cursor-pointer items-center gap-2 rounded-xl px-2 text-left transition hover:opacity-90" style={{ background: current ? theme.toolbar.activeBg : "transparent", color: current ? theme.toolbar.activeText : theme.node.text }} onClick={() => onStepChange(step.id)}>
                                <span className="grid size-8 shrink-0 place-items-center rounded-lg border text-[11px] font-semibold" style={{ borderColor: current ? theme.node.activeStroke : theme.toolbar.border, background: current ? theme.node.fill : theme.toolbar.panel }}>
                                    {done ? <Icon className="size-4" /> : String(index + 1).padStart(2, "0")}
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold">{step.title}</span>
                                    <span className="block truncate text-[11px]" style={{ color: current ? theme.toolbar.activeText : theme.node.muted }}>
                                        {done ? "已创建" : "待创建"}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </aside>

            <main className="min-h-0 overflow-hidden rounded-2xl border" style={{ background: theme.node.panel, borderColor: theme.toolbar.border }}>
                {activeStep === "brief" ? (
                    flow.brief ? <ProjectBriefNodeContent node={flow.brief} theme={theme} fullscreen onMetadataChange={onMetadataChange} /> : <MissingStep theme={theme} title="故事设定" onCreate={onCreateFlow} />
                ) : activeStep === "script" ? (
                    flow.script ? <ScriptEditor node={flow.script} theme={theme} onContentChange={onContentChange} /> : <MissingStep theme={theme} title="剧本" onCreate={() => (flow.brief ? onCreateNext(flow.brief) : onCreateFlow())} />
                ) : activeStep === "subjects" ? (
                    flow.subjectBoard ? <SubjectBoardNodeContent node={flow.subjectBoard} theme={theme} fullscreen onMetadataChange={onMetadataChange} onOpenMediaEditor={onOpenBoardMediaEditor} /> : <MissingStep theme={theme} title="角色板" onCreate={() => (flow.script ? onCreateNext(flow.script) : onCreateFlow())} />
                ) : flow.storyboard ? (
                    <StoryboardNodeContent node={flow.storyboard} theme={theme} fullscreen subjectReferences={storyboardSubjectReferences} onMetadataChange={onMetadataChange} onOpenMediaEditor={onOpenBoardMediaEditor} />
                ) : (
                    <MissingStep theme={theme} title="分镜板" onCreate={() => (flow.subjectBoard ? onCreateNext(flow.subjectBoard) : onCreateFlow())} />
                )}
            </main>

            <aside className="min-h-0 overflow-hidden rounded-2xl border p-3" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}>
                <StepActionPanel flow={flow} activeStep={activeStep} activeNode={activeNode} theme={theme} runningNodeId={runningNodeId} onRunAgent={onRunAgent} onCreateNext={onCreateNext} onFocusCanvasNode={onFocusCanvasNode} renderSubjectGenerationPanel={renderSubjectGenerationPanel} renderStoryboardGenerationPanel={renderStoryboardGenerationPanel} />
            </aside>
        </div>
    );
}

function ScriptEditor({ node, theme, onContentChange }: { node: CanvasNodeData; theme: CanvasTheme; onContentChange: (nodeId: string, content: string, contentHtml?: string) => void }) {
    return (
        <div className="flex h-full min-h-0 flex-col p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold">{node.title || "剧本"}</div>
                    <div className="mt-1 text-xs" style={{ color: theme.node.muted }}>
                        编辑生成后的剧本文本
                    </div>
                </div>
            </div>
            <textarea
                className="thin-scrollbar min-h-0 flex-1 resize-none rounded-xl border bg-transparent p-4 text-sm leading-7 outline-none"
                style={{ borderColor: theme.node.stroke, color: theme.node.text, background: theme.node.fill }}
                value={node.metadata?.content || ""}
                placeholder="剧本内容会写入这里，也可以直接手动编辑。"
                onChange={(event) => onContentChange(node.id, event.target.value)}
            />
        </div>
    );
}

function StepActionPanel({ flow, activeStep, activeNode, theme, runningNodeId, onRunAgent, onCreateNext, onFocusCanvasNode, renderSubjectGenerationPanel, renderStoryboardGenerationPanel }: { flow: ShortDramaFlowNodes; activeStep: CanvasSimpleModeStep; activeNode?: CanvasNodeData; theme: CanvasTheme; runningNodeId: string | null; onRunAgent: (nodeId: string, prompt: string) => void; onCreateNext: (node: CanvasNodeData) => void; onFocusCanvasNode: (nodeId: string) => void; renderSubjectGenerationPanel: (node: CanvasNodeData) => ReactNode; renderStoryboardGenerationPanel: (node: CanvasNodeData) => ReactNode }) {
    if (activeStep === "subjects" && flow.subjectBoard?.metadata?.subjectPanelGroupId && flow.subjectBoard.metadata.subjectPanelItemId) {
        return (
            <PanelFrame title="主体生成" icon={<ImageIcon className="size-4" />} theme={theme}>
                {renderSubjectGenerationPanel(flow.subjectBoard)}
            </PanelFrame>
        );
    }
    if (activeStep === "storyboard" && flow.storyboard?.metadata?.storyboardPanelMode && flow.storyboard.metadata.storyboardPanelShotId) {
        return (
            <PanelFrame title={flow.storyboard.metadata.storyboardPanelMode === "video" ? "分镜视频生成" : "分镜图生成"} icon={flow.storyboard.metadata.storyboardPanelMode === "video" ? <Video className="size-4" /> : <ImageIcon className="size-4" />} theme={theme}>
                {renderStoryboardGenerationPanel(flow.storyboard)}
            </PanelFrame>
        );
    }

    const action =
        activeStep === "brief"
            ? { agent: flow.scriptAgent, source: flow.brief, label: "生成剧本", prompt: "请基于上游故事设定生成短剧剧本。" }
            : activeStep === "script"
              ? { agent: flow.characterAgent, source: flow.script, label: "生成角色板", prompt: "请基于上游剧本生成角色、场景和道具。" }
              : activeStep === "subjects"
                ? { agent: flow.storyboardAgent, source: flow.subjectBoard, label: "生成分镜板", prompt: "请基于上游剧本和角色板生成分镜镜头。" }
                : null;
    const running = Boolean(action?.agent && runningNodeId === action.agent.id);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <PanelFrame title="当前动作" icon={<Sparkles className="size-4" />} theme={theme}>
                <div className="space-y-3">
                    <div className="rounded-xl border p-3" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <ListChecks className="size-4" />
                            {stepTitle(activeStep)}
                        </div>
                        <p className="mt-2 text-xs leading-5" style={{ color: theme.node.muted }}>
                            {stepDescription(activeStep)}
                        </p>
                    </div>

                    {action ? (
                        <button type="button" className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }} disabled={(!action.agent && !action.source) || running} onClick={() => (action.agent ? onRunAgent(action.agent.id, action.agent.metadata?.prompt?.trim() || action.prompt) : action.source ? onCreateNext(action.source) : undefined)}>
                            <ArrowRight className="size-4" />
                            {running ? "生成中..." : action.agent ? action.label : "创建下一步"}
                        </button>
                    ) : null}

                    {activeNode ? (
                        <button type="button" className="h-10 w-full cursor-pointer rounded-xl border text-sm font-semibold transition hover:opacity-90" style={{ borderColor: theme.toolbar.border, color: theme.node.text }} onClick={() => onFocusCanvasNode(activeNode.id)}>
                            在画布中查看
                        </button>
                    ) : null}
                </div>
            </PanelFrame>
        </div>
    );
}

function PanelFrame({ title, icon, theme, children }: { title: string; icon: ReactNode; theme: CanvasTheme; children: ReactNode }) {
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                {icon}
                <span>{title}</span>
            </div>
            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
    );
}

function MissingStep({ theme, title, onCreate }: { theme: CanvasTheme; title: string; onCreate: () => void }) {
    return (
        <div className="flex h-full items-center justify-center p-6 text-center">
            <div>
                <div className="mx-auto grid size-12 place-items-center rounded-xl" style={{ background: theme.node.fill }}>
                    <Clapperboard className="size-6" />
                </div>
                <div className="mt-4 text-base font-semibold">{title}还未创建</div>
                <button type="button" className="mt-4 h-10 cursor-pointer rounded-xl px-4 text-sm font-semibold transition hover:opacity-90" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }} onClick={onCreate}>
                    创建这一步
                </button>
            </div>
        </div>
    );
}

function buildShortDramaFlow(nodes: CanvasNodeData[], connections: CanvasConnection[]): ShortDramaFlowNodes {
    const brief = nodes.find((node) => node.type === CanvasNodeType.ProjectBrief);
    const scriptAgent = findDirectTarget(nodes, connections, brief?.id, CanvasNodeType.ScriptAgent) || nodes.find((node) => node.type === CanvasNodeType.ScriptAgent);
    const script = findDirectScript(nodes, connections, scriptAgent?.id) || nodes.find((node) => node.type === CanvasNodeType.Text && node.metadata?.textRole === "script");
    const characterAgent = findDirectTarget(nodes, connections, script?.id, CanvasNodeType.CharacterAgent) || nodes.find((node) => node.type === CanvasNodeType.CharacterAgent);
    const subjectBoard = findDirectTarget(nodes, connections, characterAgent?.id, CanvasNodeType.SubjectBoard) || nodes.find((node) => node.type === CanvasNodeType.SubjectBoard);
    const storyboardAgent = findDirectTarget(nodes, connections, subjectBoard?.id, CanvasNodeType.StoryboardAgent) || nodes.find((node) => node.type === CanvasNodeType.StoryboardAgent);
    const storyboard = findDirectTarget(nodes, connections, storyboardAgent?.id, CanvasNodeType.Storyboard) || findDirectTarget(nodes, connections, subjectBoard?.id, CanvasNodeType.Storyboard) || nodes.find((node) => node.type === CanvasNodeType.Storyboard);
    return { brief, scriptAgent, script, characterAgent, subjectBoard, storyboardAgent, storyboard };
}

function findDirectTarget(nodes: CanvasNodeData[], connections: CanvasConnection[], sourceId: string | undefined, type: CanvasNodeType) {
    if (!sourceId) return undefined;
    return connections
        .filter((connection) => connection.fromNodeId === sourceId)
        .map((connection) => nodes.find((node) => node.id === connection.toNodeId))
        .find((node): node is CanvasNodeData => node?.type === type);
}

function findDirectScript(nodes: CanvasNodeData[], connections: CanvasConnection[], sourceId: string | undefined) {
    if (!sourceId) return undefined;
    return connections
        .filter((connection) => connection.fromNodeId === sourceId)
        .map((connection) => nodes.find((node) => node.id === connection.toNodeId))
        .find((node): node is CanvasNodeData => node?.type === CanvasNodeType.Text && node.metadata?.textRole === "script");
}

function stepTitle(step: CanvasSimpleModeStep) {
    if (step === "brief") return "从故事设定开始";
    if (step === "script") return "整理角色资产";
    if (step === "subjects") return "拆解分镜";
    return "制作分镜图和视频";
}

function stepDescription(step: CanvasSimpleModeStep) {
    if (step === "brief") return "填写主题、题材、风格和故事简述后，可以生成剧本文本。";
    if (step === "script") return "确认剧本内容后，可以生成角色、场景和道具。";
    if (step === "subjects") return "选中角色板里的主体可生成参考图，或继续生成分镜。";
    return "在分镜行里点击图片或视频生成，右侧会打开对应生成面板。";
}
