"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bold, Heading1, Heading2, Heading3, Italic, Palette, Pilcrow, X } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";

export type CanvasFullscreenTextFormat = {
    fontSize?: number;
    textStyle?: "body" | "h1" | "h2" | "h3";
    textBold?: boolean;
    textItalic?: boolean;
    textBackground?: string;
};

type CanvasFullscreenTextEditorProps = {
    open: boolean;
    title: string;
    value: string;
    placeholder?: string;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    onChange: (value: string) => void;
    onClose: () => void;
};

export function CanvasFullscreenTextEditor({ open, title, value, placeholder, theme, onChange, onClose }: CanvasFullscreenTextEditorProps) {
    const [format, setFormat] = useState<CanvasFullscreenTextFormat>({ textStyle: "body", fontSize: 16 });

    useEffect(() => {
        if (open) setFormat({ textStyle: "body", fontSize: 16 });
    }, [open, title]);

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 z-[240] flex flex-col" style={{ background: theme.canvas.background, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <header className="flex h-14 shrink-0 items-center justify-between border-b px-5" style={{ borderColor: theme.toolbar.border, background: theme.toolbar.panel }}>
                <div className="truncate text-sm font-semibold">{title}</div>
                <button type="button" className="grid size-9 place-items-center rounded-full border transition hover:scale-[1.03]" style={{ borderColor: theme.toolbar.border, background: theme.node.fill, color: theme.node.text }} onClick={onClose} aria-label="关闭全屏编辑" title="关闭全屏编辑">
                    <X className="size-4" />
                </button>
            </header>
            <div className="min-h-0 flex-1 overflow-hidden p-4">
                <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3">
                    <CanvasFullscreenTextToolbar format={format} theme={theme} onFormatChange={(patch) => setFormat((current) => ({ ...current, ...patch }))} />
                    <textarea
                        autoFocus
                        className="thin-scrollbar min-h-0 flex-1 resize-none rounded-xl border bg-transparent p-6 leading-7 outline-none"
                        style={{ ...canvasFullscreenTextStyle(format, theme), borderColor: theme.toolbar.border }}
                        value={value}
                        placeholder={placeholder}
                        onChange={(event) => onChange(event.target.value)}
                        onWheel={(event) => event.stopPropagation()}
                    />
                </div>
            </div>
        </div>,
        document.body,
    );
}

export function CanvasFullscreenTextToolbar({ format, theme, onFormatChange }: { format?: CanvasFullscreenTextFormat; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onFormatChange: (patch: CanvasFullscreenTextFormat) => void }) {
    const style = format?.textStyle || "body";
    const setStyle = (textStyle: NonNullable<CanvasFullscreenTextFormat["textStyle"]>, fontSize: number) => onFormatChange({ textStyle, fontSize });

    return (
        <div className="flex h-11 shrink-0 items-center gap-1 rounded-xl border px-2" style={{ borderColor: theme.toolbar.border, background: theme.toolbar.panel, color: theme.node.text }}>
            <CanvasFullscreenTextTool title="背景色" active={Boolean(format?.textBackground)} onClick={() => onFormatChange({ textBackground: format?.textBackground ? "" : "rgba(255,255,255,0.08)" })}>
                <Palette className="size-4" />
            </CanvasFullscreenTextTool>
            <CanvasFullscreenTextTool title="标题 1" active={style === "h1"} onClick={() => setStyle("h1", 26)}>
                <Heading1 className="size-4" />
            </CanvasFullscreenTextTool>
            <CanvasFullscreenTextTool title="标题 2" active={style === "h2"} onClick={() => setStyle("h2", 22)}>
                <Heading2 className="size-4" />
            </CanvasFullscreenTextTool>
            <CanvasFullscreenTextTool title="标题 3" active={style === "h3"} onClick={() => setStyle("h3", 18)}>
                <Heading3 className="size-4" />
            </CanvasFullscreenTextTool>
            <CanvasFullscreenTextTool title="正文" active={style === "body"} onClick={() => setStyle("body", 16)}>
                <Pilcrow className="size-4" />
            </CanvasFullscreenTextTool>
            <span className="mx-1 h-5 w-px" style={{ background: theme.toolbar.border }} />
            <CanvasFullscreenTextTool title="粗体" active={Boolean(format?.textBold)} onClick={() => onFormatChange({ textBold: !format?.textBold })}>
                <Bold className="size-4" />
            </CanvasFullscreenTextTool>
            <CanvasFullscreenTextTool title="斜体" active={Boolean(format?.textItalic)} onClick={() => onFormatChange({ textItalic: !format?.textItalic })}>
                <Italic className="size-4" />
            </CanvasFullscreenTextTool>
        </div>
    );
}

function CanvasFullscreenTextTool({ title, active, children, onClick }: { title: string; active?: boolean; children: ReactNode; onClick: () => void }) {
    return (
        <button type="button" className="grid size-8 place-items-center rounded-lg transition hover:scale-[1.03]" style={{ background: active ? "color-mix(in srgb, currentColor 14%, transparent)" : "transparent", color: "inherit" }} title={title} onClick={onClick}>
            {children}
        </button>
    );
}

export function canvasFullscreenTextStyle(format: CanvasFullscreenTextFormat | undefined, theme: (typeof canvasThemes)[keyof typeof canvasThemes]) {
    return {
        color: theme.node.text,
        fontSize: `${format?.fontSize || 16}px`,
        fontWeight: format?.textBold || format?.textStyle === "h1" || format?.textStyle === "h2" ? 700 : 400,
        fontStyle: format?.textItalic ? "italic" : "normal",
        background: format?.textBackground || theme.node.fill,
    };
}
