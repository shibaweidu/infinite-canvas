"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Palette, X } from "lucide-react";

import { StyleLibraryModal, normalizeProjectBriefSettings, type StyleLibraryItem } from "@/app/(user)/canvas/components/canvas-project-brief-node";
import { canvasThemes } from "@/lib/canvas-theme";
import type { AdminProjectVisualStyle } from "@/services/api/admin";
import { useConfigStore } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";

const EMPTY_STYLES: AdminProjectVisualStyle[] = [];
const EMPTY_CATEGORIES: string[] = [];

type Props = {
    value?: string;
    onChange: (value: string) => void;
    compact?: boolean;
    className?: string;
    style?: CSSProperties;
};

export function GenerationStylePicker({ value = "", onChange, compact = false, className, style }: Props) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const configured = useConfigStore((state) => state.publicSettings?.projectBrief);
    const rawStyles = useConfigStore((state) => state.publicSettings?.projectBrief.visualStyles) || EMPTY_STYLES;
    const rawCategories = useConfigStore((state) => state.publicSettings?.projectBrief.styleCategories) || EMPTY_CATEGORIES;
    const settings = useMemo(() => normalizeProjectBriefSettings(configured), [configured]);
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState("全部");
    const selected = settings.visualStyles.find((item) => item.name === value) || rawStyles.find((item) => item.name === value);
    const categories = useMemo(() => ["全部", ...uniqueStrings([...rawCategories, ...settings.visualStyles.map((item) => item.category)])], [rawCategories, settings.visualStyles]);
    const visibleStyles = settings.visualStyles.filter((item) => category === "全部" || item.category === category);
    const label = selected?.name || (compact ? "风格" : "选择风格");

    if (!settings.visualStyles.length) return null;

    const selectStyle = (style: StyleLibraryItem) => {
        onChange(style.name);
        setOpen(false);
    };

    return (
        <>
            <button
                type="button"
                className={
                    className ||
                    "inline-flex h-10 max-w-[170px] cursor-pointer items-center gap-2 rounded-full border px-3 text-sm transition hover:opacity-90"
                }
                onClick={() => setOpen(true)}
                title={label}
                style={style}
            >
                <Palette className="size-3.5 shrink-0" />
                <span className="min-w-0 truncate">{label}</span>
                {selected ? (
                    <span
                        className="ml-0.5 grid size-4 shrink-0 cursor-pointer place-items-center rounded-full opacity-70 transition hover:opacity-100"
                        onClick={(event) => {
                            event.stopPropagation();
                            onChange("");
                        }}
                        aria-label="移除风格"
                        title="移除风格"
                    >
                        <X className="size-3" />
                    </span>
                ) : null}
            </button>
            <StyleLibraryModal
                open={open}
                theme={theme}
                selectedStyle={value}
                category={category}
                categories={categories}
                styles={visibleStyles}
                onCategoryChange={setCategory}
                onClose={() => setOpen(false)}
                onSelect={selectStyle}
            />
        </>
    );
}

function uniqueStrings(items: string[]) {
    return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}
