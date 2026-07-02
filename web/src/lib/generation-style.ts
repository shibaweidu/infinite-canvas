import type { AdminProjectVisualStyle } from "@/services/api/admin";
import type { ReferenceImage } from "@/types/image";

export type GenerationStyle = {
    name: string;
    prompt?: string;
    imageUrl?: string;
};

export function styleKey(style: Pick<GenerationStyle, "name">) {
    return style.name.trim();
}

export function findGenerationStyle(styles: AdminProjectVisualStyle[] | undefined, name?: string): GenerationStyle | null {
    const key = (name || "").trim();
    if (!key) return null;
    const style = (styles || []).find((item) => item.name.trim() === key);
    if (!style) return null;
    return {
        name: style.name.trim(),
        prompt: style.prompt?.trim(),
        imageUrl: style.coverUrl || style.previewUrls?.find(Boolean) || "",
    };
}

export function applyGenerationStylePrompt(prompt: string, style?: GenerationStyle | null) {
    if (!style) return prompt;
    const blocks = [prompt.trim(), style.name ? `视觉风格：${style.name}` : "", style.prompt ? `风格提示词：${style.prompt}` : ""].filter(Boolean);
    return blocks.join("\n\n");
}

export function styleReferenceImage(style?: GenerationStyle | null): ReferenceImage | null {
    if (!style?.imageUrl) return null;
    return {
        id: `style:${style.name}`,
        name: `风格参考图-${style.name}.png`,
        type: "image/png",
        dataUrl: "",
        url: style.imageUrl,
    };
}

export function prependStyleReference(style: GenerationStyle | null | undefined, references: ReferenceImage[]) {
    const image = styleReferenceImage(style);
    return image ? [image, ...references] : references;
}
