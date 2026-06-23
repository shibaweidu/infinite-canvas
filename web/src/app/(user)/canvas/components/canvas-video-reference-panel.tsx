"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { resolveImageUrl, uploadImage } from "@/services/image-storage";
import type { CanvasTheme } from "@/lib/canvas-theme";
import type { CanvasVideoRefMode } from "../types";
import { VIDEO_REF_MODES, VIDEO_REF_MODE_LIMIT, videoRefSlotLabel } from "./canvas-node-generation";

type CanvasVideoReferencePanelProps = {
    mode: CanvasVideoRefMode;
    references: string[];
    upstreamRefs?: { id: string; storageKey?: string; url: string }[];
    theme: CanvasTheme;
    onModeChange: (mode: CanvasVideoRefMode) => void;
    onReferencesChange: (references: string[]) => void;
    onPickAsset: () => void;
};

export function CanvasVideoReferencePanel({ mode, references, upstreamRefs = [], theme, onModeChange, onReferencesChange, onPickAsset }: CanvasVideoReferencePanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const limit = VIDEO_REF_MODE_LIMIT[mode];
    // 合并顺序与生成时一致：节点自带参考图在前，上游连线图片在后，再按模式上限截断。
    const ownCount = Math.min(references.length, limit);
    const upstreamShown = Math.max(0, limit - references.length);
    const canAddMore = references.length + upstreamRefs.length < limit;

    const addFiles = async (files?: FileList | null) => {
        const images = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
        if (!images.length) return;
        const uploaded = await Promise.all(images.map((file) => uploadImage(file)));
        onReferencesChange([...references, ...uploaded.map((item) => item.storageKey)].slice(0, limit));
    };

    return (
        <div className="mb-2 space-y-2" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex flex-wrap gap-1.5">
                {VIDEO_REF_MODES.map((item) => {
                    const selected = mode === item.value;
                    return (
                        <button
                            key={item.value}
                            type="button"
                            className="h-7 cursor-pointer rounded-lg border px-2.5 text-[13px] transition hover:opacity-80"
                            style={{ background: selected ? theme.node.text : "transparent", borderColor: selected ? theme.node.text : theme.node.stroke, color: selected ? theme.node.fill : theme.node.text }}
                            onClick={() => onModeChange(item.value)}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>

            {limit > 0 ? (
                <div className="thin-scrollbar flex items-center gap-2 overflow-x-auto py-0.5">
                    {references.slice(0, limit).map((storageKey, index) => (
                        <ReferenceThumb
                            key={storageKey}
                            storageKey={storageKey}
                            slotLabel={videoRefSlotLabel(mode, index)}
                            theme={theme}
                            onRemove={() => onReferencesChange(references.filter((item) => item !== storageKey))}
                        />
                    ))}
                    {upstreamRefs.slice(0, upstreamShown).map((item, index) => (
                        <ReferenceThumb key={`upstream-${item.id}`} url={item.url} storageKey={item.storageKey} slotLabel={videoRefSlotLabel(mode, ownCount + index)} badge="连线" theme={theme} />
                    ))}
                    {canAddMore ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                            <AddButton icon={<ImagePlus className="size-4" />} label="上传" theme={theme} onClick={() => fileInputRef.current?.click()} />
                            <AddButton label="素材" theme={theme} onClick={onPickAsset} />
                        </div>
                    ) : null}
                    {!references.length && !upstreamRefs.length ? <span className="px-1 text-xs" style={{ color: theme.node.muted }}>{mode === "first" ? "添加首帧图片" : mode === "firstLast" ? "添加首帧和尾帧图片" : `可添加最多 ${limit} 张参考图`}</span> : null}
                </div>
            ) : null}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                    void addFiles(event.target.files);
                    event.target.value = "";
                }}
            />
        </div>
    );
}

function ReferenceThumb({ storageKey, url, slotLabel, badge, theme, onRemove }: { storageKey?: string; url?: string; slotLabel: string; badge?: string; theme: CanvasTheme; onRemove?: () => void }) {
    const [resolved, setResolved] = useState(url || "");

    useEffect(() => {
        if (url) {
            setResolved(url);
            return;
        }
        let active = true;
        void resolveImageUrl(storageKey).then((value) => {
            if (active) setResolved(value);
        });
        return () => {
            active = false;
        };
    }, [storageKey, url]);

    return (
        <div className="group relative size-14 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: theme.node.stroke }}>
            {resolved ? <img src={resolved} alt="" className="size-full object-cover" draggable={false} /> : <div className="size-full" style={{ background: theme.node.fill }} />}
            {slotLabel ? <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] leading-tight text-white">{slotLabel}</span> : null}
            {badge ? <span className="pointer-events-none absolute left-0.5 top-0.5 rounded bg-black/55 px-1 text-[9px] leading-tight text-white">{badge}</span> : null}
            {onRemove ? (
                <button type="button" className="absolute right-0.5 top-0.5 hidden size-5 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex" onClick={onRemove} aria-label="移除参考图">
                    <Trash2 className="size-3" />
                </button>
            ) : null}
        </div>
    );
}

function AddButton({ icon, label, theme, onClick }: { icon?: React.ReactNode; label: string; theme: CanvasTheme; onClick: () => void }) {
    return (
        <button
            type="button"
            className="flex size-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-[11px] transition hover:opacity-80"
            style={{ borderColor: theme.node.stroke, color: theme.node.muted }}
            onClick={onClick}
        >
            {icon}
            {label}
        </button>
    );
}
