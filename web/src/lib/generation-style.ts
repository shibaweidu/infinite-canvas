export type GenerationStyle = {
    name: string;
    prompt?: string;
};

export type GenerationStyleSource = {
    name: string;
    prompt?: string;
    description?: string;
    coverUrl?: string;
    imageUrl?: string;
    previewUrls?: string[];
};

export function styleKey(style: Pick<GenerationStyle, "name">) {
    return style.name.trim();
}

export function findGenerationStyle(styles: GenerationStyleSource[] | undefined, name?: string): GenerationStyle | null {
    const key = (name || "").trim();
    if (!key) return null;
    const style = (styles || []).find((item) => item.name.trim() === key);
    if (!style) return null;
    return {
        name: style.name.trim(),
        prompt: style.prompt?.trim() || style.description?.trim(),
    };
}

export function applyGenerationStylePrompt(prompt: string, style?: GenerationStyle | null) {
    if (!style) return prompt;
    const blocks = [
        prompt.trim(),
        style.name ? `视觉风格：${style.name}` : "",
        style.prompt ? `风格提示词：${style.prompt}` : "",
        "仅应用上述风格的色彩、光影、材质、笔触、对比度、画面质感和情绪氛围。主体必须完全遵循当前提示词，不得参考风格样图中的人物身份、面部、发型、服装、动作或构图主体。",
    ].filter(Boolean);
    return blocks.join("\n\n");
}
