import type { ReferenceImage } from "@/types/image";

export function imageReferenceLabel(index: number) {
    return `图片${index + 1}`;
}

function referenceLabel(image: ReferenceImage, index: number) {
    return image.name.startsWith("风格参考图") ? "风格参考图" : imageReferenceLabel(index);
}

export function buildImageReferencePromptText(prompt: string, references: ReferenceImage[]) {
    const text = prompt.trim();
    if (!references.length) return text;
    const labels = references.map(referenceLabel);
    return `参考图片编号：${labels.join("、")}。请按这些编号理解提示词中的图片引用。\n\n${text}`;
}
