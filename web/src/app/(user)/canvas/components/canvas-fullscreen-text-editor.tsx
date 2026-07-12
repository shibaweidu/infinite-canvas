"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bold, Heading1, Heading2, Heading3, Italic, Palette, Pilcrow, Save, X } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { plainTextToCanvasRichTextHtml, sanitizeCanvasRichTextHtml } from "../utils/canvas-rich-text";

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
    htmlValue?: string;
    placeholder?: string;
    format?: CanvasFullscreenTextFormat;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    onChange: (value: string) => void;
    onRichChange?: (value: string, htmlValue: string) => void;
    onFormatChange?: (patch: CanvasFullscreenTextFormat) => void;
    onSave?: () => void;
    onClose: () => void;
};

export function CanvasFullscreenTextEditor({ open, title, value, htmlValue, placeholder, format: externalFormat, theme, onChange, onRichChange, onFormatChange, onSave, onClose }: CanvasFullscreenTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastHtmlRef = useRef("");
    const selectionRangeRef = useRef<Range | null>(null);
    const richTextEnabled = htmlValue !== undefined || Boolean(onRichChange);
    const [format, setFormat] = useState<CanvasFullscreenTextFormat>({ textStyle: "body", fontSize: 16 });

    useEffect(() => {
        if (open) setFormat({ textStyle: externalFormat?.textStyle || "body", fontSize: externalFormat?.fontSize || 16, textBold: externalFormat?.textBold, textItalic: externalFormat?.textItalic, textBackground: externalFormat?.textBackground });
    }, [externalFormat?.fontSize, externalFormat?.textBackground, externalFormat?.textBold, externalFormat?.textItalic, externalFormat?.textStyle, open, title]);

    useEffect(() => {
        if (!open || !richTextEnabled || !editorRef.current) return;
        const nextHtml = sanitizeCanvasRichTextHtml(htmlValue || plainTextToCanvasRichTextHtml(value, externalFormat));
        if (nextHtml !== lastHtmlRef.current) {
            editorRef.current.innerHTML = nextHtml;
            lastHtmlRef.current = nextHtml;
        }
    }, [externalFormat, htmlValue, open, richTextEnabled, value]);

    const isSelectionInsideEditor = useCallback((node: Node | null) => {
        const editor = editorRef.current;
        if (!editor || !node) return false;
        return editor === node || editor.contains(node.nodeType === Node.TEXT_NODE ? node.parentNode : node);
    }, []);

    const storeSelectionRange = useCallback(() => {
        if (typeof window === "undefined") return null;
        const selection = window.getSelection();
        if (!selection?.rangeCount) return null;
        const range = selection.getRangeAt(0);
        if (!isSelectionInsideEditor(range.commonAncestorContainer)) return null;
        selectionRangeRef.current = range.cloneRange();
        return range;
    }, [isSelectionInsideEditor]);

    const restoreSelectionRange = useCallback(() => {
        if (typeof window === "undefined") return false;
        const editor = editorRef.current;
        const range = selectionRangeRef.current;
        const selection = window.getSelection();
        if (!editor || !range || !selection) return false;
        editor.focus({ preventScroll: true });
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
    }, []);

    const syncRichValue = useCallback((commitDom = false) => {
        const editor = editorRef.current;
        if (!editor) return;
        const nextHtml = sanitizeCanvasRichTextHtml(editor.innerHTML);
        const nextValue = editor.innerText.replace(/\u00a0/g, " ").replace(/\n$/, "");
        lastHtmlRef.current = nextHtml;
        if (commitDom && editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml;
        if (onRichChange) onRichChange(nextValue, nextHtml);
        else onChange(nextValue);
    }, [onChange, onRichChange]);

    const refreshSelectionFormat = useCallback(() => {
        if (!richTextEnabled || typeof document === "undefined") return;
        const range = storeSelectionRange();
        if (!range) return;
        const block = String(document.queryCommandValue("formatBlock") || "body").replace(/[<>]/g, "").toLowerCase();
        const textStyle = block === "h1" || block === "h2" || block === "h3" ? block : "body";
        setFormat((current) => ({
            ...current,
            textStyle,
            fontSize: textStyle === "h1" ? 26 : textStyle === "h2" ? 22 : textStyle === "h3" ? 18 : 16,
            textBold: document.queryCommandState("bold"),
            textItalic: document.queryCommandState("italic"),
        }));
    }, [richTextEnabled, storeSelectionRange]);

    useEffect(() => {
        if (!open || !richTextEnabled || typeof document === "undefined") return;
        document.addEventListener("selectionchange", refreshSelectionFormat);
        return () => document.removeEventListener("selectionchange", refreshSelectionFormat);
    }, [open, refreshSelectionFormat, richTextEnabled]);

    const applyRichFormat = useCallback(
        (patch: CanvasFullscreenTextFormat) => {
            const editor = editorRef.current;
            if (!editor || typeof document === "undefined") return;
            restoreSelectionRange();
            if (patch.textStyle) document.execCommand("formatBlock", false, patch.textStyle === "body" ? "p" : patch.textStyle);
            if (patch.textBold !== undefined) document.execCommand("bold");
            if (patch.textItalic !== undefined) document.execCommand("italic");
            refreshSelectionFormat();
            syncRichValue();
        },
        [refreshSelectionFormat, restoreSelectionRange, syncRichValue],
    );

    const handleFormatChange = useCallback(
        (patch: CanvasFullscreenTextFormat) => {
            if (patch.textBackground !== undefined) {
                onFormatChange?.(patch);
                setFormat((current) => ({ ...current, ...patch }));
                return;
            }
            if (richTextEnabled) {
                applyRichFormat(patch);
                return;
            }
            setFormat((current) => ({ ...current, ...patch }));
            onFormatChange?.(patch);
        },
        [applyRichFormat, onFormatChange, richTextEnabled],
    );

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[1200] flex flex-col"
            style={{ background: theme.canvas.background, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape") {
                    event.preventDefault();
                    onClose();
                } else if (onSave && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    onSave();
                }
            }}
        >
            <header className="flex h-14 shrink-0 items-center justify-between border-b px-5" style={{ borderColor: theme.toolbar.border, background: theme.toolbar.panel }}>
                <div className="truncate text-sm font-semibold">{title}</div>
                <div className="flex items-center gap-2">
                    {onSave ? (
                        <button type="button" className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium transition hover:opacity-85" style={{ borderColor: theme.node.activeStroke, background: theme.toolbar.activeBg, color: theme.toolbar.activeText }} onClick={onSave} title="保存（Ctrl/Command + Enter）">
                            <Save className="size-4" />
                            保存
                        </button>
                    ) : null}
                    <button type="button" className="grid size-9 cursor-pointer place-items-center rounded-full border transition hover:scale-[1.03]" style={{ borderColor: theme.toolbar.border, background: theme.node.fill, color: theme.node.text }} onClick={onClose} aria-label={onSave ? "取消编辑" : "关闭全屏编辑"} title={onSave ? "取消编辑" : "关闭全屏编辑"}>
                        <X className="size-4" />
                    </button>
                </div>
            </header>
            <div className="min-h-0 flex-1 overflow-hidden p-4">
                <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3">
                    <CanvasFullscreenTextToolbar format={format} theme={theme} onFormatChange={handleFormatChange} />
                    {richTextEnabled ? (
                        <div
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning
                            autoFocus
                            className="thin-scrollbar min-h-0 flex-1 overflow-y-auto rounded-xl border bg-transparent p-6 leading-7 outline-none empty:before:pointer-events-none empty:before:content-[attr(data-placeholder)] [&_b]:font-bold [&_br]:block [&_em]:italic [&_h1]:my-2 [&_h1]:text-[1.65em] [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-[1.35em] [&_h2]:font-bold [&_h3]:my-1.5 [&_h3]:text-[1.15em] [&_h3]:font-semibold [&_i]:italic [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-1 [&_strong]:font-bold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
                            data-placeholder={placeholder || ""}
                            style={{ color: theme.node.text, background: externalFormat?.textBackground || theme.node.fill, borderColor: theme.toolbar.border }}
                            onInput={() => syncRichValue()}
                            onBlur={() => syncRichValue(true)}
                            onFocus={refreshSelectionFormat}
                            onKeyUp={refreshSelectionFormat}
                            onMouseUp={refreshSelectionFormat}
                            onWheel={(event) => event.stopPropagation()}
                        />
                    ) : (
                        <textarea
                            autoFocus
                            className="thin-scrollbar min-h-0 flex-1 resize-none rounded-xl border bg-transparent p-6 leading-7 outline-none"
                            style={{ ...canvasFullscreenTextStyle(format, theme), borderColor: theme.toolbar.border }}
                            value={value}
                            placeholder={placeholder}
                            onChange={(event) => onChange(event.target.value)}
                            onWheel={(event) => event.stopPropagation()}
                        />
                    )}
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
        <button type="button" className="grid size-8 place-items-center rounded-lg transition hover:scale-[1.03]" style={{ background: active ? "color-mix(in srgb, currentColor 14%, transparent)" : "transparent", color: "inherit" }} title={title} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
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
