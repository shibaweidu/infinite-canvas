"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Clapperboard, ClipboardList, ScrollText, UsersRound } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType } from "../types";

type CanvasShortDramaNavProps = {
    onCreateNode: (type: CanvasNodeType) => void;
};

const shortDramaItems = [
    { type: CanvasNodeType.ProjectBrief, title: "故事设定", description: "主题、题材、风格和故事", icon: ClipboardList },
    { type: CanvasNodeType.ScriptAgent, title: "剧本Agent", description: "创作或改编标准剧本", icon: ScrollText },
    { type: CanvasNodeType.CharacterAgent, title: "角色Agent", description: "输出角色、场景、道具", icon: UsersRound },
    { type: CanvasNodeType.StoryboardAgent, title: "分镜Agent", description: "拆解镜头和生成提示词", icon: Bot },
    { type: CanvasNodeType.SubjectBoard, title: "角色板", description: "管理主体资产和提示词", icon: UsersRound },
    { type: CanvasNodeType.Storyboard, title: "分镜板", description: "镜头、分镜图和视频", icon: Clapperboard },
];

export function CanvasShortDramaNav({ onCreateNode }: CanvasShortDramaNavProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const activeStyle = open ? { background: theme.toolbar.activeBg, color: theme.toolbar.activeText } : { color: theme.toolbar.item };

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
        <div ref={rootRef} className="absolute left-5 top-24 z-50 flex items-start gap-2" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <button
                type="button"
                className="flex w-[76px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-semibold leading-none shadow-lg backdrop-blur transition hover:scale-[1.02]"
                style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, ...activeStyle }}
                title="短剧制作"
                aria-label="短剧制作"
                onClick={() => setOpen((value) => !value)}
            >
                <Clapperboard className="size-5" />
                <span className="whitespace-nowrap">短剧制作</span>
            </button>

            {open ? (
                <div className="w-[292px] rounded-2xl border p-2.5 shadow-2xl backdrop-blur" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}>
                    <div className="px-2 pb-2">
                        <div className="text-sm font-semibold">短剧制作</div>
                        <div className="mt-0.5 text-[11px]" style={{ color: theme.node.muted }}>
                            项目、剧本、角色与分镜节点
                        </div>
                    </div>
                    <div className="space-y-1">
                        {shortDramaItems.map((item) => {
                            const Icon = item.icon;
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
                                    onClick={() => {
                                        onCreateNode(item.type);
                                        setOpen(false);
                                    }}
                                >
                                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                                        <Icon className="size-4" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">{item.title}</span>
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
