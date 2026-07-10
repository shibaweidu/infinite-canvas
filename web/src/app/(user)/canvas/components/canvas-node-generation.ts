import type { ChatCompletionMessage } from "@/services/api/image";
import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import { seedanceReferenceLabel } from "@/lib/seedance-video";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type CanvasVideoRefMode } from "../types";
import { getGenerationResourceNodes } from "../utils/canvas-resource-references";

export const VIDEO_REF_MODES: { value: CanvasVideoRefMode; label: string }[] = [
    { value: "text", label: "文生视频" },
    { value: "first", label: "首帧" },
    { value: "firstLast", label: "首尾帧" },
    { value: "omni", label: "全能参考" },
];

export const VIDEO_REF_MODE_LIMIT: Record<CanvasVideoRefMode, number> = {
    text: 0,
    first: 1,
    firstLast: 2,
    omni: 7,
};

export function videoRefSlotLabel(mode: CanvasVideoRefMode, index: number): string {
    if (mode === "first") return index === 0 ? "首帧" : "";
    if (mode === "firstLast") return index === 0 ? "首帧" : index === 1 ? "尾帧" : "";
    return "";
}

export function clampVideoReferences<T>(mode: CanvasVideoRefMode, references: T[]): T[] {
    return references.slice(0, VIDEO_REF_MODE_LIMIT[mode]);
}

export type NodeGenerationContext = {
    prompt: string;
    referenceImages: ReferenceImage[];
    referenceVideos: ReferenceVideo[];
    referenceAudios: ReferenceAudio[];
    textCount: number;
    imageCount: number;
    videoCount: number;
    audioCount: number;
};

export type NodeGenerationInput = {
    nodeId: string;
    type: "text" | "image" | "video" | "audio";
    title: string;
    text?: string;
    image?: ReferenceImage;
    video?: ReferenceVideo;
    audio?: ReferenceAudio;
};

export function buildNodeGenerationContext(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[], prompt: string): NodeGenerationContext {
    const inputs = buildNodeGenerationInputs(nodeId, nodes, connections);
    const sourceNode = nodes.find((node) => node.id === nodeId);
    if (sourceNode?.type === CanvasNodeType.Config && Boolean(sourceNode.metadata?.composerContent?.trim())) {
        return buildComposerGenerationContext(inputs, prompt);
    }

    const upstreamText = buildLabeledTextBlocks(inputs);
    const referenceImages = inputs.map((input) => input.image).filter((image): image is ReferenceImage => Boolean(image));
    const referenceVideos = inputs.map((input) => input.video).filter((video): video is ReferenceVideo => Boolean(video));
    const referenceAudios = inputs.map((input) => input.audio).filter((audio): audio is ReferenceAudio => Boolean(audio));
    const referencePrompt = withReferenceHint(
        upstreamText ? `${prompt}\n\n${upstreamText}` : prompt,
        inputs.filter((input) => input.type !== "text"),
    );

    return {
        prompt: referencePrompt,
        referenceImages,
        referenceVideos,
        referenceAudios,
        textCount: inputs.filter((input) => input.type === "text").length,
        imageCount: referenceImages.length,
        videoCount: referenceVideos.length,
        audioCount: referenceAudios.length,
    };
}

function buildComposerGenerationContext(inputs: NodeGenerationInput[], prompt: string): NodeGenerationContext {
    const inputByNodeId = new Map(inputs.map((input) => [input.nodeId, input]));
    const selectedInputs: NodeGenerationInput[] = [];
    const labelByNodeId = new Map<string, string>();
    const textBlocks: string[] = [];
    const referenceLabels: string[] = [];
    const counts = { image: 0, video: 0, audio: 0, text: 0 };
    let hasToken = false;
    let lastIndex = 0;
    let nextPrompt = "";

    for (const match of prompt.matchAll(/@\[node:([^\]]+)\]/g)) {
        if (match.index === undefined) continue;
        hasToken = true;
        nextPrompt += prompt.slice(lastIndex, match.index);
        const input = inputByNodeId.get(match[1]);
        if (input) {
            let label = labelByNodeId.get(input.nodeId);
            if (!label) {
                label = generationLabel(input.type, counts[input.type]++);
                labelByNodeId.set(input.nodeId, label);
                if (input.type === "text") textBlocks.push(`【${label}】\n${input.text || ""}`);
                else {
                    selectedInputs.push(input);
                    referenceLabels.push(label);
                }
            }
            nextPrompt += input.type === "text" ? `【${label}】` : label;
        }
        lastIndex = match.index + match[0].length;
    }

    nextPrompt += prompt.slice(lastIndex);
    if (textBlocks.length) nextPrompt = `${nextPrompt.trim()}\n\n${textBlocks.join("\n\n")}`;
    if (referenceLabels.length) nextPrompt = prependReferenceHint(nextPrompt, referenceLabels);
    const referenceImages = selectedInputs.map((input) => input.image).filter((image): image is ReferenceImage => Boolean(image));
    const referenceVideos = selectedInputs.map((input) => input.video).filter((video): video is ReferenceVideo => Boolean(video));
    const referenceAudios = selectedInputs.map((input) => input.audio).filter((audio): audio is ReferenceAudio => Boolean(audio));

    if (!hasToken) {
        return {
            prompt,
            referenceImages: [],
            referenceVideos: [],
            referenceAudios: [],
            textCount: 0,
            imageCount: 0,
            videoCount: 0,
            audioCount: 0,
        };
    }

    return {
        prompt: nextPrompt,
        referenceImages,
        referenceVideos,
        referenceAudios,
        textCount: counts.text,
        imageCount: referenceImages.length,
        videoCount: referenceVideos.length,
        audioCount: referenceAudios.length,
    };
}

export function buildNodeGenerationInputs(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]): NodeGenerationInput[] {
    const targetNode = nodes.find((node) => node.id === nodeId);
    const inputNodes = getGenerationResourceNodes(nodeId, nodes, connections);
    const scriptSourceNode = readDirectScriptSourceNode(targetNode, nodes, connections);
    const allInputNodes = scriptSourceNode && !inputNodes.some((node) => node.id === scriptSourceNode.id) ? [...inputNodes, scriptSourceNode] : inputNodes;
    return allInputNodes.flatMap((node): NodeGenerationInput[] => {
        const storyboardShotText = readSelectedStoryboardShotText(targetNode, node);
        if (storyboardShotText) return [{ nodeId: node.id, type: "text" as const, title: node.title, text: storyboardShotText }];
        const image = readReferenceImage(node);
        if (image) return [{ nodeId: node.id, type: "image" as const, title: node.title, image }];
        const video = readReferenceVideo(node);
        if (video) return [{ nodeId: node.id, type: "video" as const, title: node.title, video }];
        const audio = readReferenceAudio(node);
        if (audio) return [{ nodeId: node.id, type: "audio" as const, title: node.title, audio }];
        const text = readNodeTextInput(node);
        if (text) return [{ nodeId: node.id, type: "text" as const, title: node.title, text }];
        return [];
    });
}

export function buildNodeChatMessages(context: NodeGenerationContext): ChatCompletionMessage[] {
    if (!context.referenceImages.length) {
        return [{ role: "user", content: context.prompt }];
    }

    return [
        {
            role: "user",
            content: [{ type: "text" as const, text: context.prompt }, ...context.referenceImages.map((image) => ({ type: "image_url" as const, image_url: { url: image.dataUrl } }))],
        },
    ];
}

export async function hydrateNodeGenerationContext(context: NodeGenerationContext) {
    const { imageToDataUrl } = await import("@/services/image-storage");
    return { ...context, referenceImages: await Promise.all(context.referenceImages.map(async (image) => ({ ...image, dataUrl: await imageToDataUrl(image) }))) };
}

function readNodeTextInput(node: CanvasNodeData) {
    if (node.type === CanvasNodeType.Text || node.type === CanvasNodeType.Agent || node.type === CanvasNodeType.ScriptAgent || node.type === CanvasNodeType.CharacterAgent || node.type === CanvasNodeType.StoryboardAgent)
        return node.metadata?.content || node.metadata?.prompt || "";
    if (node.type === CanvasNodeType.ProjectBrief) return projectBriefText(node);
    if (node.type === CanvasNodeType.SubjectBoard) return subjectBoardText(node);
    if (node.type === CanvasNodeType.Storyboard) return storyboardText(node);
    return node.metadata?.prompt || "";
}

function generationLabel(type: NodeGenerationInput["type"], index: number) {
    if (type === "image") return imageReferenceLabel(index);
    if (type === "video") return seedanceReferenceLabel("video", index);
    if (type === "audio") return seedanceReferenceLabel("audio", index);
    return `文本${index + 1}`;
}

function withReferenceHint(prompt: string, inputs: NodeGenerationInput[]) {
    const counts = { image: 0, video: 0, audio: 0, text: 0 };
    const labels = inputs.map((input) => generationLabel(input.type, counts[input.type]++));
    return labels.length ? prependReferenceHint(prompt, labels) : prompt;
}

function buildLabeledTextBlocks(inputs: NodeGenerationInput[]) {
    let textIndex = 0;
    return inputs
        .filter((input) => input.type === "text" && input.text)
        .map((input) => `【${generationLabel("text", textIndex++)}】\n${input.text}`)
        .join("\n\n");
}

function prependReferenceHint(prompt: string, labels: string[]) {
    const text = prompt.trim();
    const hint = `参考素材编号：${labels.join("、")}。请按这些编号理解提示词中的图片、视频和音频引用。`;
    return text ? `${hint}\n\n${text}` : hint;
}

function projectBriefText(node: CanvasNodeData) {
    const brief = node.metadata?.projectBrief;
    if (!brief) return "";
    return [
        "故事设定：",
        brief.theme ? `主题：${brief.theme}` : "",
        brief.genre ? `题材：${brief.genre}` : "",
        brief.visualStyle ? `视觉风格：${brief.visualStyle}` : "",
        brief.visualStylePrompt ? `风格提示词：${brief.visualStylePrompt}` : "",
        brief.keyElements?.length ? `关键元素：${brief.keyElements.join("、")}` : "",
        brief.duration ? `时长：${brief.duration}` : "",
        brief.story ? `故事简述：${brief.story}` : "",
    ]
        .filter(Boolean)
        .join("\n");
}

function subjectBoardText(node: CanvasNodeData) {
    const groups = node.metadata?.subjectBoard?.groups || [];
    return groups
        .map((group) => {
            const items = group.items.map((item) => [`${item.id} ${item.name}`, `类型：${group.title}`, item.description ? `描述：${item.description}` : "", item.prompt ? `提示词：${item.prompt}` : ""].filter(Boolean).join("；")).join("\n");
            return items ? `${group.title}\n${items}` : "";
        })
        .filter(Boolean)
        .join("\n\n");
}

function storyboardText(node: CanvasNodeData) {
    const shots = node.metadata?.storyboard?.shots || [];
    return shots.map((shot) => `${shot.id}. ${shot.description}`).join("\n");
}

function readDirectScriptSourceNode(targetNode: CanvasNodeData | undefined, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    if (targetNode?.type !== CanvasNodeType.ScriptAgent) return null;
    const sourceIds = connections.filter((connection) => connection.toNodeId === targetNode.id).map((connection) => connection.fromNodeId);
    return sourceIds.map((sourceId) => nodes.find((node) => node.id === sourceId) || null).find((node): node is CanvasNodeData => Boolean(node && readNodeTextInput(node).trim())) || null;
}

function readSelectedStoryboardShotText(targetNode: CanvasNodeData | undefined, node: CanvasNodeData) {
    if (node.type !== CanvasNodeType.Storyboard) return "";
    if (targetNode?.metadata?.storyboardSourceNodeId !== node.id || !targetNode.metadata.storyboardShotId) return "";
    const shot = node.metadata?.storyboard?.shots.find((item) => item.id === targetNode.metadata?.storyboardShotId);
    if (!shot) return "";
    return [`镜头 ${shot.id}`, shot.description ? `分镜描述：${shot.description}` : "", shot.imagePrompt ? `分镜图提示词：${shot.imagePrompt}` : "", shot.videoPrompt ? `视频提示词：${shot.videoPrompt}` : ""].filter(Boolean).join("\n");
}

function readReferenceImage(node: CanvasNodeData): ReferenceImage | null {
    if (node.type !== CanvasNodeType.Image || !node.metadata?.content) return null;
    return {
        id: node.id,
        name: `${node.title || node.id}.png`,
        type: node.metadata.mimeType || "image/png",
        dataUrl: node.metadata.content,
        storageKey: node.metadata.storageKey,
    };
}

function readReferenceVideo(node: CanvasNodeData): ReferenceVideo | null {
    if (node.type !== CanvasNodeType.Video || !node.metadata?.content) return null;
    return {
        id: node.id,
        name: `${node.title || node.id}.mp4`,
        type: node.metadata.mimeType || "video/mp4",
        url: node.metadata.content,
        storageKey: node.metadata.storageKey,
        bytes: node.metadata.bytes,
        width: node.metadata.naturalWidth,
        height: node.metadata.naturalHeight,
        durationMs: node.metadata.durationMs,
    };
}

function readReferenceAudio(node: CanvasNodeData): ReferenceAudio | null {
    if (node.type !== CanvasNodeType.Audio || !node.metadata?.content) return null;
    return {
        id: node.id,
        name: `${node.title || node.id}.mp3`,
        type: node.metadata.mimeType || "audio/mpeg",
        url: node.metadata.content,
        storageKey: node.metadata.storageKey,
        durationMs: node.metadata.durationMs,
    };
}
