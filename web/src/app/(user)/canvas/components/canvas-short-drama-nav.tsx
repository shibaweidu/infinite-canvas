"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Bot, Clapperboard, ClipboardList, Plus, ScrollText, UsersRound, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType } from "../types";

export type ShortDramaStepType = CanvasNodeType.ProjectBrief | CanvasNodeType.ScriptAgent | "script" | CanvasNodeType.CharacterAgent | CanvasNodeType.SubjectBoard | CanvasNodeType.StoryboardAgent | CanvasNodeType.Storyboard;

type CanvasShortDramaNavProps = {
    activeNode?: { stepType: ShortDramaStepType; title?: string } | null;
    recommendedTypes?: ShortDramaStepType[];
    onCreateNode: (type: ShortDramaStepType) => void;
    onCreateFlow: () => void;
};

const shortDramaItems = [
    { type: CanvasNodeType.ProjectBrief, step: "01", title: "故事设定", description: "主题、题材、风格和故事", icon: ClipboardList },
    { type: CanvasNodeType.ScriptAgent, step: "02", title: "剧本Agent", description: "创作或改编标准剧本", icon: ScrollText },
    { type: "script", step: "03", title: "剧本", description: "承接并编辑完整剧本", icon: ScrollText },
    { type: CanvasNodeType.CharacterAgent, step: "04", title: "角色Agent", description: "输出角色、场景、道具", icon: UsersRound },
    { type: CanvasNodeType.SubjectBoard, step: "05", title: "角色板", description: "管理主体资产和提示词", icon: UsersRound },
    { type: CanvasNodeType.StoryboardAgent, step: "06", title: "分镜Agent", description: "拆解镜头和生成提示词", icon: Bot },
    { type: CanvasNodeType.Storyboard, step: "07", title: "分镜板", description: "镜头、分镜图和视频", icon: Clapperboard },
] satisfies Array<{ type: ShortDramaStepType; step: string; title: string; description: string; icon: LucideIcon }>;

export function CanvasShortDramaNav({ activeNode, recommendedTypes = [], onCreateNode, onCreateFlow }: CanvasShortDramaNavProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const activeStyle = open ? { background: theme.toolbar.activeBg, color: theme.toolbar.activeText } : { color: theme.toolbar.item };
    const recommendedSet = new Set(recommendedTypes);
    const stopSpaceKey = (event: KeyboardEvent) => {
        if (event.key !== " " && event.code !== "Space") return;
        event.preventDefault();
        event.stopPropagation();
    };

    useEffect(() => {
        if (!open) return;
        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (rootRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener("pointerdown", closeOnOutsidePointer, true);
        return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
    }, [open]);

    return (
        <div ref={rootRef} className="absolute left-5 top-24 z-50 flex items-start gap-2" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onKeyDownCapture={stopSpaceKey}>
            <button
                type="button"
                className="flex w-[76px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-semibold leading-none shadow-lg backdrop-blur transition hover:scale-[1.02]"
                style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, ...activeStyle }}
                title="短剧制作"
                aria-label="短剧制作"
                onClick={(event) => {
                    event.currentTarget.blur();
                    setOpen((value) => !value);
                }}
            >
                <Clapperboard className="size-5" />
                <span className="whitespace-nowrap">短剧制作</span>
            </button>

            {open ? (
                <div className="w-[332px] rounded-2xl border p-2.5 shadow-2xl backdrop-blur" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}>
                    <div className="px-2 pb-2">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold">短剧制作流</div>
                                <div className="mt-0.5 truncate text-[11px]" style={{ color: theme.node.muted }}>
                                    故事、剧本、角色、分镜
                                </div>
                            </div>
                            {activeNode ? (
                                <span className="max-w-[128px] truncate rounded-full border px-2 py-1 text-[11px]" style={{ borderColor: theme.toolbar.border, color: theme.node.muted }}>
                                    {activeNode.title || shortDramaItems.find((item) => item.type === activeNode.stepType)?.title}
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <div className="mb-2 grid grid-cols-2 gap-1.5 px-1">
                        <button
                            type="button"
                            className="flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition hover:scale-[1.01]"
                            style={{ borderColor: theme.toolbar.border, background: theme.node.fill, color: theme.node.text }}
                            onClick={(event) => {
                                event.currentTarget.blur();
                                onCreateFlow();
                                setOpen(false);
                            }}
                        >
                            <Workflow className="size-3.5" />
                            完整流程
                        </button>
                        <button
                            type="button"
                            className="flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition hover:scale-[1.01]"
                            style={{ borderColor: theme.toolbar.border, background: theme.node.fill, color: theme.node.text }}
                            onClick={(event) => {
                                event.currentTarget.blur();
                                onCreateNode(CanvasNodeType.ProjectBrief);
                                setOpen(false);
                            }}
                        >
                            <Plus className="size-3.5" />
                            故事设定
                        </button>
                    </div>
                    <div className="space-y-1">
                        {shortDramaItems.map((item) => {
                            const Icon = item.icon;
                            const isRecommended = recommendedSet.has(item.type);
                            return (
                                <button
                                    key={item.type}
                                    type="button"
                                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:scale-[1.01]"
                                    style={{ color: theme.node.text }}
                                    onMouseEnter={(event) => {
                                        event.currentTarget.style.background = theme.toolbar.itemHover;
                                    }}
                                    onMouseLeave={(event) => {
                                        event.currentTarget.style.background = "transparent";
                                    }}
                                    onClick={(event) => {
                                        event.currentTarget.blur();
                                        onCreateNode(item.type);
                                        setOpen(false);
                                    }}
                                >
                                    <span className="grid size-10 shrink-0 place-items-center rounded-lg border" style={{ borderColor: isRecommended ? theme.toolbar.activeText : theme.toolbar.border, background: isRecommended ? theme.toolbar.activeBg : theme.node.fill }}>
                                        <Icon className="size-4" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span className="text-[10px] font-semibold tabular-nums" style={{ color: theme.node.muted }}>
                                                {item.step}
                                            </span>
                                            <span className="block truncate text-sm font-medium">{item.title}</span>
                                            {isRecommended ? (
                                                <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}>
                                                    下一步
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className="block truncate text-[11px]" style={{ color: theme.node.muted }}>
                                            {item.description}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
