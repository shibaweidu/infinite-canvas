"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent as ReactChangeEvent, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, ChevronDown, Clapperboard, ClipboardList, Copy, Grid2x2, Group, Home, ImageIcon, Images, List, Menu, Music2, Plus, Redo2, Save, ScrollText, Settings2, Trash2, Undo2, Upload, UsersRound, Video, X } from "lucide-react";
import { saveAs } from "file-saver";

import { requestEdit, requestGeneration, requestImageQuestion } from "@/services/api/image";
import { requestAudioGeneration, storeGeneratedAudio } from "@/services/api/audio";
import { requestVideoGeneration, storeGeneratedVideo } from "@/services/api/video";
import { defaultConfig, type AiConfig, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { resolveImageUrl, uploadImage, type UploadedImage } from "@/services/image-storage";
import { resolveMediaUrl, uploadMediaFile, type UploadedFile } from "@/services/file-storage";
import { applyGenerationStylePrompt, findGenerationStyle, prependStyleReference } from "@/lib/generation-style";
import { nanoid } from "nanoid";
import { getDataUrlByteSize, readImageMeta } from "@/lib/image-utils";
import { canvasThemes, type CanvasBackgroundMode } from "@/lib/canvas-theme";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { useAssetStore } from "@/stores/use-asset-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { useUserStyleStore } from "@/stores/use-user-style-store";
import { cropDataUrl, upscaleDataUrl } from "../utils/canvas-image-data";
import { fitNodeSize, nodeSizeFromRatio } from "../utils/canvas-node-size";
import { extractVideoPromptFrames } from "../utils/canvas-video-frames";
import { App, Button, Dropdown, Modal } from "antd";
import { NODE_DEFAULT_SIZE, getNodeSpec } from "../constants";
import { ActiveConnectionPath, ConnectionPath } from "../components/canvas-connections";
import { CanvasConfigNodePanel } from "../components/canvas-config-node-panel";
import { CanvasAgentNodePanel } from "../components/canvas-agent-node-panel";
import { CANVAS_AGENT_PANEL_MOTION_MS, CanvasAssistantPanel } from "../components/canvas-assistant-panel";
import { StoryboardNodeContent, SubjectBoardNodeContent } from "../components/canvas-creative-board-node";
import { CanvasNodeContextMenu } from "../components/canvas-context-menu";
import { CanvasNodeAngleDialog, type CanvasImageAngleParams } from "../components/canvas-node-angle-dialog";
import { CanvasNodeCropDialog, type CanvasImageCropRect } from "../components/canvas-node-crop-dialog";
import { CanvasNodeMaskEditDialog, type CanvasImageMaskEditPayload } from "../components/canvas-node-mask-edit-dialog";
import { CanvasNodeUpscaleDialog, type CanvasImageUpscaleParams } from "../components/canvas-node-upscale-dialog";
import { buildNodeChatMessages, buildNodeGenerationContext, buildNodeGenerationInputs, clampVideoReferences, hydrateNodeGenerationContext, type NodeGenerationContext, type NodeGenerationInput } from "../components/canvas-node-generation";
import { CanvasNodeHoverToolbar, CanvasNodeInfoModal } from "../components/canvas-node-hover-toolbar";
import { CanvasGroupFrame } from "../components/canvas-group-frame";
import { InfiniteCanvas } from "../components/infinite-canvas";
import { Minimap } from "../components/canvas-mini-map";
import { CanvasNode } from "../components/canvas-node";
import { CanvasNodePromptPanel, type CanvasNodeGenerationMode, type CanvasPromptSelectOption, type CanvasStoryboardShotOption } from "../components/canvas-node-prompt-panel";
import { CanvasFullscreenTextToolbar, canvasFullscreenTextStyle } from "../components/canvas-fullscreen-text-editor";
import { ProjectBriefNodeContent } from "../components/canvas-project-brief-node";
import { CanvasShortDramaNav, type ShortDramaStepType } from "../components/canvas-short-drama-nav";
import { CanvasToolbar } from "../components/canvas-toolbar";
import { AssetPickerModal, type AssetPickerTab, type InsertAssetPayload } from "../components/asset-picker-modal";
import { CanvasZoomControls } from "../components/canvas-zoom-controls";
import { CanvasLocalAgentPanel } from "../components/canvas-local-agent-panel";
import type { CanvasAgentMode } from "../components/canvas-agent-chat-ui";
import { useCanvasAgentStore } from "../stores/use-canvas-agent-store";
import { useCanvasStore } from "../stores/use-canvas-store";
import { applyCanvasAgentOps, type CanvasAgentOp, type CanvasAgentSnapshot } from "../utils/canvas-agent-ops";
import { buildCanvasResourceReferences, buildNodeMentionReferences } from "../utils/canvas-resource-references";
import {
    CanvasNodeType,
    type CanvasAssistantImage,
    type CanvasAssistantSession,
    type CanvasAgentOutputFormat,
    type CanvasArrangeMode,
    type CanvasBoardMediaEditorTarget,
    type CanvasConnection,
    type CanvasGroup,
    type CanvasImageGenerationType,
    type CanvasMediaSlot,
    type CanvasNodeData,
    type CanvasNodeMetadata,
    type CanvasStoryboardReference,
    type CanvasStoryboardGenerationMode,
    type CanvasStoryboardShot,
    type CanvasSubjectBoard,
    type CanvasSubjectKind,
    type CanvasTextMode,
    type CanvasVideoRefMode,
    type ConnectionHandle,
    type ContextMenuState,
    type Position,
    type SelectionBox,
    type ViewportTransform,
} from "../types";
import type { ReferenceImage } from "@/types/image";
import type { AdminProjectVisualStyle } from "@/services/api/admin";
import type { ReferenceAudio } from "@/types/media";

type CanvasClipboard = {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
};

type PendingConnectionCreate = {
    connection?: ConnectionHandle;
    position: Position;
};

type ConnectionCreateNodeType = CanvasNodeType | "script";

type ConnectionDropTarget = {
    nodeId: string | null;
    isNearNode: boolean;
};

type GroupResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type CanvasHistoryEntry = Pick<CanvasClipboard, "nodes" | "connections"> & {
    groups: CanvasGroup[];
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
};

const VIDEO_NODE_MAX_WIDTH = 420;
const VIDEO_NODE_MAX_HEIGHT = 420;
const CONNECTION_HANDLE_HIT_RADIUS = 40;
const CONNECTION_NODE_HIT_PADDING = 32;
const NODE_STATUS_LOADING = "loading" as const;
const NODE_STATUS_SUCCESS = "success" as const;
const NODE_STATUS_ERROR = "error" as const;
const EMPTY_VISUAL_STYLES: AdminProjectVisualStyle[] = [];
const IMAGE_PROMPT_REVERSE_PRESET = `请根据参考图片反推一段适合用于 AI 生图的提示词。

要求：
1. 只输出提示词正文，不要解释。
2. 覆盖主体、构图、风格、光线、色彩、材质、镜头和氛围。
3. 尽量写成可直接用于生图模型的完整提示词。`;

const LEGACY_DEFAULT_NODE_TITLES = {
    [CanvasNodeType.Image]: ["New Generation"],
    [CanvasNodeType.Text]: ["Note"],
    [CanvasNodeType.Config]: ["Generation Config"],
    [CanvasNodeType.Video]: ["Video"],
    [CanvasNodeType.Audio]: ["Audio"],
    [CanvasNodeType.Agent]: ["Agent"],
    [CanvasNodeType.ScriptAgent]: [],
    [CanvasNodeType.CharacterAgent]: [],
    [CanvasNodeType.StoryboardAgent]: [],
    [CanvasNodeType.ProjectBrief]: [],
    [CanvasNodeType.SubjectBoard]: [],
    [CanvasNodeType.Storyboard]: [],
} satisfies Record<CanvasNodeType, string[]>;

function createCanvasNode(type: CanvasNodeType, position: Position, metadata?: CanvasNodeMetadata): CanvasNodeData {
    const spec = getNodeSpec(type);
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return {
        id,
        type,
        title: nodeTitleBase(type),
        position: {
            x: position.x - spec.width / 2,
            y: position.y - spec.height / 2,
        },
        width: spec.width,
        height: spec.height,
        metadata: { ...spec.metadata, ...metadata },
    };
}

function createScriptTextNode(position: Position, nodes: CanvasNodeData[], metadata?: CanvasNodeMetadata): CanvasNodeData {
    const node = createCanvasNode(CanvasNodeType.Text, position, { textRole: "script", textMode: "write", ...metadata });
    const nextIndex =
        nodes.reduce((max, item) => {
            if (item.type !== CanvasNodeType.Text || item.metadata?.textRole !== "script") return max;
            const match = (item.title || "").trim().match(/^剧本(\d+)$/);
            return match ? Math.max(max, Number(match[1]) + 1) : max;
        }, 1) || 1;
    return { ...node, title: `剧本${nextIndex}` };
}

function normalizeCanvasNodeTitles(nodes: CanvasNodeData[]) {
    const nextIndex = new Map<string, number>();
    const titleKey = (node: CanvasNodeData) => (node.type === CanvasNodeType.Text && node.metadata?.textRole === "script" ? "script" : node.type);
    const titleBase = (node: CanvasNodeData) => (node.type === CanvasNodeType.Text && node.metadata?.textRole === "script" ? "剧本" : nodeTitleBase(node.type));
    nodes.forEach((node) => {
        const escapedBase = titleBase(node).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = (node.title || "").trim().match(new RegExp(`^${escapedBase}(\\d+)$`));
        const key = titleKey(node);
        if (match) nextIndex.set(key, Math.max(nextIndex.get(key) || 1, Number(match[1]) + 1));
    });

    let changed = false;
    const next = nodes.map((node) => {
        const title = (node.title || "").trim();
        const base = titleBase(node);
        const key = titleKey(node);
        const needsAutoTitle = !title || title === base || LEGACY_DEFAULT_NODE_TITLES[node.type].includes(title);
        if (!needsAutoTitle) return node;
        const index = nextIndex.get(key) || 1;
        nextIndex.set(key, index + 1);
        changed = true;
        return { ...node, title: `${base}${index}` };
    });
    return changed ? next : nodes;
}

function nodeTitleBase(type: CanvasNodeType) {
    return getNodeSpec(type).title;
}

function isAgentNodeType(type: CanvasNodeType) {
    return type === CanvasNodeType.Agent || type === CanvasNodeType.ScriptAgent || type === CanvasNodeType.CharacterAgent || type === CanvasNodeType.StoryboardAgent;
}

const SHORT_DRAMA_NODE_TYPES = new Set<CanvasNodeType>([CanvasNodeType.ProjectBrief, CanvasNodeType.ScriptAgent, CanvasNodeType.CharacterAgent, CanvasNodeType.SubjectBoard, CanvasNodeType.StoryboardAgent, CanvasNodeType.Storyboard]);

const SHORT_DRAMA_CONNECTIONS: Record<ShortDramaStepType, ShortDramaStepType[]> = {
    [CanvasNodeType.ProjectBrief]: [CanvasNodeType.ScriptAgent, CanvasNodeType.CharacterAgent, CanvasNodeType.StoryboardAgent],
    [CanvasNodeType.ScriptAgent]: ["script"],
    script: [CanvasNodeType.CharacterAgent, CanvasNodeType.StoryboardAgent],
    [CanvasNodeType.CharacterAgent]: [CanvasNodeType.SubjectBoard],
    [CanvasNodeType.SubjectBoard]: [CanvasNodeType.StoryboardAgent, CanvasNodeType.Storyboard],
    [CanvasNodeType.StoryboardAgent]: [CanvasNodeType.Storyboard],
    [CanvasNodeType.Storyboard]: [],
};

function getShortDramaStepType(node: CanvasNodeData | null | undefined): ShortDramaStepType | null {
    if (!node) return null;
    if (node.type === CanvasNodeType.Text) return node.metadata?.textRole === "script" ? "script" : null;
    return SHORT_DRAMA_NODE_TYPES.has(node.type) && node.type !== CanvasNodeType.Text ? (node.type as ShortDramaStepType) : null;
}

function getNextShortDramaNodeTypes(type: ShortDramaStepType) {
    return SHORT_DRAMA_CONNECTIONS[type] || [];
}

function isAllowedShortDramaConnection(fromType: ShortDramaStepType | null, toType: ShortDramaStepType | null) {
    if (!fromType || !toType) return true;
    return getNextShortDramaNodeTypes(fromType).includes(toType);
}

function shortDramaConnectionWarning(fromType?: ShortDramaStepType | null) {
    if (fromType === CanvasNodeType.ProjectBrief) return "故事设定建议连接到剧本 Agent、角色 Agent 或分镜 Agent";
    if (fromType === CanvasNodeType.ScriptAgent) return "剧本 Agent 需要连接到剧本";
    if (fromType === "script") return "剧本建议连接到角色 Agent 或分镜 Agent";
    if (fromType === CanvasNodeType.CharacterAgent) return "角色 Agent 需要连接到角色板";
    if (fromType === CanvasNodeType.SubjectBoard) return "角色板建议连接到分镜 Agent 或分镜板";
    if (fromType === CanvasNodeType.StoryboardAgent) return "分镜 Agent 需要连接到分镜板";
    if (fromType === CanvasNodeType.Storyboard) return "分镜板已经是短剧流程末端";
    return "短剧制作节点请按流程顺序连接";
}

function isAgentNode(node: CanvasNodeData | undefined) {
    return Boolean(node && isAgentNodeType(node.type));
}

function agentTaskTitles(type: CanvasNodeType) {
    return {
        read: "读取上游输入",
        generate: type === CanvasNodeType.CharacterAgent ? "生成角色/场景/道具" : type === CanvasNodeType.StoryboardAgent ? "生成分镜镜头" : type === CanvasNodeType.ScriptAgent ? "生成剧本内容" : "执行智能体任务",
        write: type === CanvasNodeType.CharacterAgent ? "写入角色板" : type === CanvasNodeType.StoryboardAgent ? "写入分镜板" : "写入结果节点",
    };
}

function agentTaskMetadata(type: CanvasNodeType, step: "start" | "generating" | "writing" | "success" | "error", errorDetails?: string): Partial<CanvasNodeMetadata> {
    const titles = agentTaskTitles(type);
    const status = step === "error" ? NODE_STATUS_ERROR : step === "success" ? NODE_STATUS_SUCCESS : NODE_STATUS_LOADING;
    return {
        status,
        errorDetails,
        agentCurrentStep: step === "start" ? titles.read : step === "generating" ? titles.generate : step === "writing" ? titles.write : step === "success" ? "执行完成" : "执行失败",
        agentProgress: step === "start" ? 0.12 : step === "generating" ? 0.55 : step === "writing" ? 0.82 : step === "success" ? 1 : 0,
        agentTasks: [
            { id: "read-input", title: titles.read, status: step === "start" ? "running" : step === "error" ? "success" : "success" },
            { id: "generate", title: titles.generate, status: step === "start" ? "idle" : step === "generating" ? "running" : step === "error" ? "error" : "success" },
            { id: "write-output", title: titles.write, status: step === "success" ? "success" : step === "writing" ? "running" : "idle" },
        ],
    };
}

function upsertAgentResultNode(nodes: CanvasNodeData[], sourceNode: CanvasNodeData, resultId: string, content: string, prompt: string): CanvasNodeData[] {
    const resultTitle = `${sourceNode.metadata?.agentName?.trim() || sourceNode.title || "智能体"}结果`;
    const existing = nodes.find((node) => node.id === resultId);
    const sourcePatch = (node: CanvasNodeData) => (node.id === sourceNode.id ? { ...node, metadata: { ...node.metadata, agentResultNodeId: resultId } } : node);

    if (existing) {
        return nodes.map((node) => {
            if (node.id === resultId) {
                return {
                    ...node,
                    type: CanvasNodeType.Text,
                    title: node.title || resultTitle,
                    metadata: {
                        ...node.metadata,
                        content,
                        prompt,
                        status: NODE_STATUS_SUCCESS,
                        fontSize: node.metadata?.fontSize || 14,
                        agentResultSourceNodeId: sourceNode.id,
                    },
                };
            }
            return sourcePatch(node);
        });
    }

    const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Text];
    return nodes.map(sourcePatch).concat({
        id: resultId,
        type: CanvasNodeType.Text,
        title: resultTitle,
        position: { x: sourceNode.position.x + sourceNode.width + 96, y: sourceNode.position.y },
        width: spec.width,
        height: spec.height,
        metadata: { content, prompt, status: NODE_STATUS_SUCCESS, fontSize: 14, agentResultSourceNodeId: sourceNode.id },
    });
}

const SUBJECT_BOARD_GROUPS: { id: string; title: string; kind: CanvasSubjectKind; keys: string[]; prefix: string }[] = [
    { id: "characters", title: "角色", kind: "character", keys: ["characters", "roles", "角色", "人物"], prefix: "C" },
    { id: "scenes", title: "场景", kind: "scene", keys: ["scenes", "locations", "场景", "地点"], prefix: "SC" },
    { id: "props", title: "道具", kind: "prop", keys: ["props", "items", "道具", "物件"], prefix: "P" },
];

function upsertCharacterAgentResultNode(nodes: CanvasNodeData[], sourceNode: CanvasNodeData, resultId: string, content: string, prompt: string): CanvasNodeData[] {
    const resultTitle = `${sourceNode.metadata?.agentName?.trim() || "角色Agent"}结果`;
    const subjectBoard = parseSubjectBoardFromAgentOutput(content);
    const existing = nodes.find((node) => node.id === resultId);
    const sourcePatch = (node: CanvasNodeData) => (node.id === sourceNode.id ? { ...node, metadata: { ...node.metadata, agentResultNodeId: resultId } } : node);

    if (existing) {
        const spec = NODE_DEFAULT_SIZE[CanvasNodeType.SubjectBoard];
        return nodes.map((node) => {
            if (node.id === resultId) {
                return {
                    ...node,
                    type: CanvasNodeType.SubjectBoard,
                    title: node.title || resultTitle,
                    width: node.type === CanvasNodeType.SubjectBoard ? node.width : spec.width,
                    height: node.type === CanvasNodeType.SubjectBoard ? node.height : spec.height,
                    metadata: { ...node.metadata, content, prompt, status: NODE_STATUS_SUCCESS, subjectBoard, agentResultSourceNodeId: sourceNode.id },
                };
            }
            return sourcePatch(node);
        });
    }

    const spec = NODE_DEFAULT_SIZE[CanvasNodeType.SubjectBoard];
    return nodes.map(sourcePatch).concat({
        id: resultId,
        type: CanvasNodeType.SubjectBoard,
        title: resultTitle,
        position: { x: sourceNode.position.x + sourceNode.width + 96, y: sourceNode.position.y },
        width: spec.width,
        height: spec.height,
        metadata: { content, prompt, status: NODE_STATUS_SUCCESS, subjectBoard, agentResultSourceNodeId: sourceNode.id },
    });
}

function upsertStoryboardAgentResultNode(nodes: CanvasNodeData[], sourceNode: CanvasNodeData, resultId: string, content: string, prompt: string, subjectReferences: CanvasStoryboardReference[] = []): CanvasNodeData[] {
    const resultTitle = `${sourceNode.metadata?.agentName?.trim() || "分镜Agent"}结果`;
    const storyboard = parseStoryboardFromAgentOutput(content, subjectReferences);
    const existing = nodes.find((node) => node.id === resultId);
    const sourcePatch = (node: CanvasNodeData) => (node.id === sourceNode.id ? { ...node, metadata: { ...node.metadata, agentResultNodeId: resultId } } : node);

    if (existing) {
        const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Storyboard];
        return nodes.map((node) => {
            if (node.id === resultId) {
                return {
                    ...node,
                    type: CanvasNodeType.Storyboard,
                    title: node.title || resultTitle,
                    width: node.type === CanvasNodeType.Storyboard ? node.width : spec.width,
                    height: node.type === CanvasNodeType.Storyboard ? node.height : spec.height,
                    metadata: { ...node.metadata, content, prompt, status: NODE_STATUS_SUCCESS, storyboard, agentResultSourceNodeId: sourceNode.id },
                };
            }
            return sourcePatch(node);
        });
    }

    const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Storyboard];
    return nodes.map(sourcePatch).concat({
        id: resultId,
        type: CanvasNodeType.Storyboard,
        title: resultTitle,
        position: { x: sourceNode.position.x + sourceNode.width + 96, y: sourceNode.position.y },
        width: spec.width,
        height: spec.height,
        metadata: { content, prompt, status: NODE_STATUS_SUCCESS, storyboard, agentResultSourceNodeId: sourceNode.id },
    });
}

function parseSubjectBoardFromAgentOutput(content: string): CanvasSubjectBoard {
    const payload = parseJsonObject(content);
    return {
        groups: SUBJECT_BOARD_GROUPS.map((group) => ({
            id: group.id,
            title: group.title,
            kind: group.kind,
            items: collectSubjectItems(payload, group).map((item, index) => ({
                id: `${group.prefix}${String(index + 1).padStart(2, "0")}`,
                kind: group.kind,
                name: item.name,
                description: item.description,
                prompt: item.prompt,
                image: { status: "empty" as const },
            })),
        })),
    };
}

function parseStoryboardFromAgentOutput(content: string, subjectReferences: CanvasStoryboardReference[] = []) {
    const payload = parseJsonObject(content);
    const source = [payload.shots, payload.storyboard, payload["分镜"], payload["镜头"]].find(Array.isArray);
    const shots = (Array.isArray(source) ? source : []).map((value, index) => readStoryboardShot(value, index, subjectReferences)).filter((shot): shot is CanvasStoryboardShot => Boolean(shot?.description));
    return { shots };
}

function readStoryboardShot(value: unknown, index: number, subjectReferences: CanvasStoryboardReference[] = []): CanvasStoryboardShot | null {
    if (typeof value === "string") return { id: String(index + 1), description: value, references: [], image: { status: "empty" }, video: { status: "empty" } };
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const id = readString(record.id, record.no, record.number, record["编号"]) || String(index + 1);
    const description = readString(record.description, record.desc, record["分镜描述"], record["镜头描述"], record.summary, record["描述"]);
    const imagePrompt = readString(record.imagePrompt, record["分镜图提示词"], record["生图提示词"], record.prompt);
    const videoPrompt = readString(record.videoPrompt, record["视频提示词"]);
    const referenceItems = Array.isArray(record.references) ? record.references : Array.isArray(record["参考主体"]) ? record["参考主体"] : [];
    const references = referenceItems
        .map((item, itemIndex) => readStoryboardReferenceItem(item, index, itemIndex, subjectReferences))
        .filter((item): item is CanvasStoryboardShot["references"][number] => Boolean(item));
    return description ? { id, description, references, imagePrompt, videoPrompt, image: { status: "empty" }, video: { status: "empty" } } : null;
}

function readStoryboardReferenceItem(item: unknown, shotIndex: number, itemIndex: number, subjectReferences: CanvasStoryboardReference[]) {
    const name = typeof item === "string" ? item : item && typeof item === "object" ? readString((item as Record<string, unknown>).name, (item as Record<string, unknown>)["名称"], (item as Record<string, unknown>).title) : "";
    if (!name) return null;
    const normalized = normalizeReferenceName(name);
    const matched = subjectReferences.find((reference) => normalizeReferenceName(reference.name) === normalized) || subjectReferences.find((reference) => normalized.includes(normalizeReferenceName(reference.name)) || normalizeReferenceName(reference.name).includes(normalized));
    return matched || { id: `ref-${shotIndex + 1}-${itemIndex + 1}`, name, kind: "character" as const };
}

function normalizeReferenceName(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, "");
}

function parseJsonObject(content: string): Record<string, unknown> {
    const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const candidates = [text, text.slice(Math.max(0, text.indexOf("{")), text.lastIndexOf("}") + 1)].filter(Boolean);
    for (const candidate of candidates) {
        try {
            const value = JSON.parse(candidate);
            return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
        } catch {
            // Continue with the next candidate.
        }
    }
    return {};
}

function collectSubjectItems(payload: Record<string, unknown>, group: (typeof SUBJECT_BOARD_GROUPS)[number]) {
    const source = group.keys.map((key) => payload[key]).find(Array.isArray);
    return (Array.isArray(source) ? source : []).map(readSubjectItem).filter((item): item is { name: string; description: string; prompt?: string } => Boolean(item?.name));
}

function readSubjectItem(value: unknown) {
    if (typeof value === "string") return { name: value.slice(0, 24), description: value };
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const name = readString(record.name, record.title, record["名称"], record["名字"]);
    const description = readString(record.description, record.desc, record["描述"], record["设定"], record.summary, record["简介"]);
    const prompt = readString(record.prompt, record["提示词"], record.imagePrompt, record["生图提示词"], record.visualPrompt);
    return name ? { name, description: description || prompt || "", prompt } : null;
}

function readString(...values: unknown[]) {
    return values.find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim();
}

function buildStoryboardSubjectReferences(node: CanvasNodeData): CanvasStoryboardReference[] {
    return (node.metadata?.subjectBoard?.groups || []).flatMap((group) =>
        group.items.map((item, index) => ({
            id: `${node.id}:${group.id}:${item.id}`,
            name: item.name || `${group.title}${index + 1}`,
            kind: item.kind,
            thumbnail: item.thumbnail || (item.image?.status === "done" ? item.image.url : undefined),
            nodeId: node.id,
        })),
    );
}

function buildStoryboardAgentSubjectReferences(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    return connections
        .filter((connection) => connection.toNodeId === nodeId)
        .map((connection) => nodes.find((node) => node.id === connection.fromNodeId))
        .filter((node): node is CanvasNodeData => node?.type === CanvasNodeType.SubjectBoard)
        .flatMap(buildStoryboardSubjectReferences);
}

function buildStoryboardAgentSubjectPrompt(references: CanvasStoryboardReference[]) {
    if (!references.length) return "";
    const lines = references.map((reference) => `- ${reference.name}（${subjectKindText(reference.kind)}）`);
    return `\n\n可用角色板主体如下。生成每个镜头的 references 时，只使用这些主体名称；如果镜头没有明确主体，可返回空数组。\n${lines.join("\n")}`;
}

function subjectKindText(kind: CanvasSubjectKind) {
    if (kind === "scene") return "场景";
    if (kind === "prop") return "道具";
    return "角色";
}

function findDirectSubjectBoardTarget(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    return connections
        .filter((connection) => connection.fromNodeId === nodeId)
        .map((connection) => nodes.find((node) => node.id === connection.toNodeId))
        .find((node) => node?.type === CanvasNodeType.SubjectBoard)?.id;
}

function findDirectStoryboardTarget(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    return connections
        .filter((connection) => connection.fromNodeId === nodeId)
        .map((connection) => nodes.find((node) => node.id === connection.toNodeId))
        .find((node) => node?.type === CanvasNodeType.Storyboard)?.id;
}

function findDirectTextTarget(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    return connections
        .filter((connection) => connection.fromNodeId === nodeId)
        .map((connection) => nodes.find((node) => node.id === connection.toNodeId))
        .find((node) => node?.type === CanvasNodeType.Text)?.id;
}

function findUpstreamScriptNode(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const queue = connections.filter((connection) => connection.toNodeId === nodeId).map((connection) => connection.fromNodeId);
    const visited = new Set<string>();
    while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const node = nodes.find((item) => item.id === id);
        if (node?.type === CanvasNodeType.Text && node.metadata?.textRole === "script") return node;
        connections.filter((connection) => connection.toNodeId === id).forEach((connection) => queue.push(connection.fromNodeId));
    }
    return null;
}

function findConnectedShortDramaTarget(sourceNodeId: string, targetType: ShortDramaStepType, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    return connections
        .filter((connection) => connection.fromNodeId === sourceNodeId)
        .map((connection) => nodes.find((node) => node.id === connection.toNodeId))
        .find((node) => getShortDramaStepType(node) === targetType) || null;
}

function shortDramaNextLabel(node: CanvasNodeData) {
    if (node.type === CanvasNodeType.ProjectBrief) return "下一步：生成剧本";
    if (node.type === CanvasNodeType.Text && node.metadata?.textRole === "script") return "下一步：生成角色";
    if (node.type === CanvasNodeType.SubjectBoard) return "下一步：生成分镜";
    return undefined;
}

export default function CanvasPage() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <CanvasRefreshShell />;

    return <InfiniteCanvasPage />;
}

function CanvasRefreshShell() {
    return (
        <main className="relative h-full min-h-0 overflow-hidden bg-background text-foreground">
            <div
                className="absolute inset-0 opacity-60"
                style={{
                    backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                }}
            />

            <div className="absolute bottom-5 left-1/2 z-50 flex h-14 -translate-x-1/2 items-center gap-1 rounded-xl border px-2 shadow-lg backdrop-blur" style={{ background: "var(--background)", borderColor: "var(--border)" }} aria-hidden="true">
                {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className="size-8 rounded-md bg-current opacity-10" />
                ))}
            </div>

            <div className="absolute bottom-24 left-6 z-50 h-40 w-[240px] rounded-lg border shadow-2xl backdrop-blur-sm" style={{ background: "var(--background)", borderColor: "var(--border)" }} aria-hidden="true">
                <div className="absolute left-7 top-7 h-5 w-12 rounded-sm bg-current opacity-10" />
                <div className="absolute left-28 top-16 h-6 w-16 rounded-sm bg-current opacity-10" />
                <div className="absolute bottom-7 left-16 h-8 w-20 rounded-sm bg-current opacity-10" />
                <div className="absolute inset-5 rounded border border-current opacity-15" />
            </div>

            <div className="absolute bottom-5 left-5 z-50 flex h-14 w-[260px] items-center gap-2 rounded-xl border px-2 shadow-lg backdrop-blur" style={{ background: "var(--background)", borderColor: "var(--border)" }} aria-hidden="true">
                <div className="size-8 rounded-md bg-current opacity-10" />
                <div className="size-8 rounded-md bg-current opacity-10" />
                <div className="h-1 flex-1 rounded-full bg-current opacity-10" />
                <div className="h-4 w-10 rounded bg-current opacity-10" />
                <div className="size-8 rounded-md bg-current opacity-10" />
            </div>
        </main>
    );
}

function ConnectionCreateMenu({ pending, onCreate, onClose }: { pending: PendingConnectionCreate; onCreate: (type: ConnectionCreateNodeType) => void; onClose: () => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    return (
        <div
            className="thin-scrollbar absolute z-[120] max-h-[min(720px,calc(100vh-32px))] w-[320px] overflow-y-auto rounded-[18px] border p-3 shadow-2xl backdrop-blur"
            data-connection-create-menu
            data-canvas-no-zoom
            style={{ left: pending.position.x, top: pending.position.y, background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-medium" style={{ color: theme.node.muted }}>
                    引用该节点生成
                </span>
                <button type="button" className="grid size-7 place-items-center rounded-lg text-base opacity-55 transition hover:bg-white/10 hover:opacity-100" onClick={onClose} aria-label="关闭">
                    ×
                </button>
            </div>
            <ConnectionCreateSection theme={theme} title="常用节点">
                <ConnectionCreateOption theme={theme} icon={<Bot className="size-5" />} title="智能体" description="读取上游文本和图片" onClick={() => onCreate(CanvasNodeType.Agent)} />
                <ConnectionCreateOption theme={theme} icon={<List className="size-5" />} title="文本生成" description="脚本、广告词、品牌文案" onClick={() => onCreate(CanvasNodeType.Text)} />
                <ConnectionCreateOption theme={theme} icon={<ImageIcon className="size-5" />} title="图片生成" description="根据提示词生成图片" onClick={() => onCreate(CanvasNodeType.Image)} />
                <ConnectionCreateOption theme={theme} icon={<Video className="size-5" />} title="视频生成" description="根据提示词或参考图生成视频" onClick={() => onCreate(CanvasNodeType.Video)} />
                <ConnectionCreateOption theme={theme} icon={<Music2 className="size-5" />} title="音频参考" description="上传或引用音频素材" onClick={() => onCreate(CanvasNodeType.Audio)} />
                <ConnectionCreateOption theme={theme} icon={<Settings2 className="size-5" />} title="配置节点" description="模型、尺寸、数量和输入顺序" onClick={() => onCreate(CanvasNodeType.Config)} />
            </ConnectionCreateSection>
            <ConnectionCreateSection theme={theme} title="短剧制作" className="mt-3">
                <ConnectionCreateOption theme={theme} icon={<ClipboardList className="size-5" />} title="故事设定" description="主题、题材、风格和故事简述" onClick={() => onCreate(CanvasNodeType.ProjectBrief)} />
                <ConnectionCreateOption theme={theme} icon={<ScrollText className="size-5" />} title="剧本Agent" description="创作或改编标准剧本" onClick={() => onCreate(CanvasNodeType.ScriptAgent)} />
                <ConnectionCreateOption theme={theme} icon={<List className="size-5" />} title="剧本" description="标准剧本文本容器" onClick={() => onCreate("script")} />
                <ConnectionCreateOption theme={theme} icon={<UsersRound className="size-5" />} title="角色Agent" description="输出角色、场景、道具" onClick={() => onCreate(CanvasNodeType.CharacterAgent)} />
                <ConnectionCreateOption theme={theme} icon={<Clapperboard className="size-5" />} title="分镜Agent" description="拆解镜头和提示词" onClick={() => onCreate(CanvasNodeType.StoryboardAgent)} />
                <ConnectionCreateOption theme={theme} icon={<UsersRound className="size-5" />} title="角色板" description="角色、场景和道具资产" onClick={() => onCreate(CanvasNodeType.SubjectBoard)} />
                <ConnectionCreateOption theme={theme} icon={<Clapperboard className="size-5" />} title="分镜板" description="镜头描述、主体、图片和视频" onClick={() => onCreate(CanvasNodeType.Storyboard)} />
            </ConnectionCreateSection>
        </div>
    );
}

function ConnectionCreateSection({ theme, title, className = "", children }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes]; title: string; className?: string; children: ReactNode }) {
    return (
        <section className={className}>
            <div className="mb-1.5 flex items-center gap-2 px-2">
                <span className="text-xs font-semibold" style={{ color: theme.node.muted }}>
                    {title}
                </span>
                <span className="h-px flex-1" style={{ background: theme.node.stroke }} />
            </div>
            <div className="grid gap-1">{children}</div>
        </section>
    );
}

function ConnectionCreateOption({ theme, icon, title, description, onClick }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes]; icon: React.ReactNode; title: string; description?: string; onClick?: () => void }) {
    return (
        <button type="button" className="flex h-16 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 text-left transition" style={{ color: theme.node.text }} onClick={onClick} onMouseEnter={(event) => (event.currentTarget.style.background = theme.node.fill)} onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: theme.node.fill, color: theme.node.muted }}>
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-base font-semibold leading-5">{title}</span>
                {description ? <span className="mt-1 block truncate text-sm" style={{ color: theme.node.muted }}>{description}</span> : null}
            </span>
        </button>
    );
}

function InfiniteCanvasPage() {
    const { message } = App.useApp();
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectId = params.id;
    const localAgentConnected = useCanvasAgentStore((state) => state.connected);
    const localAgentActivity = useCanvasAgentStore((state) => state.activity);
    const localAgentEnabled = useCanvasAgentStore((state) => state.enabled);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const uploadTargetRef = useRef<{ nodeId?: string; position?: Position } | null>(null);
    const clipboardRef = useRef<CanvasClipboard | null>(null);
    const historyRef = useRef<{ past: CanvasHistoryEntry[]; future: CanvasHistoryEntry[] }>({ past: [], future: [] });
    const lastHistoryRef = useRef<CanvasHistoryEntry | null>(null);
    const historyCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const applyingHistoryRef = useRef(false);
    const historyPausedRef = useRef(false);
    const didInitialCenterRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const toolbarHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nodeDraggingRef = useRef(false);
    const groupResizeRef = useRef<{
        isResizing: boolean;
        groupId?: string;
        corner?: GroupResizeCorner;
        startX: number;
        startY: number;
        initial: { x: number; y: number; width: number; height: number };
    }>({
        isResizing: false,
        groupId: undefined,
        corner: undefined,
        startX: 0,
        startY: 0,
        initial: { x: 0, y: 0, width: 0, height: 0 },
    });
    const dragRef = useRef<{
        isDraggingNode: boolean;
        dragKind: "node" | "group";
        hasMoved: boolean;
        startX: number;
        startY: number;
        groupId?: string;
        initialGroupPosition?: Position;
        initialSelectedNodes: { id: string; x: number; y: number }[];
    }>({
        isDraggingNode: false,
        dragKind: "node",
        hasMoved: false,
        startX: 0,
        startY: 0,
        groupId: undefined,
        initialGroupPosition: undefined,
        initialSelectedNodes: [],
    });

    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const publicVisualStyles = useConfigStore((state) => state.publicSettings?.projectBrief.visualStyles) || EMPTY_VISUAL_STYLES;
    const token = useUserStore((state) => state.token);
    const userStyles = useUserStyleStore((state) => state.styles);
    const loadUserStyles = useUserStyleStore((state) => state.loadStyles);
    const visualStyles = useMemo(() => [...(token ? userStyles : []).map((item) => ({ name: item.name, prompt: item.prompt || item.description, imageUrl: item.imageUrl })), ...publicVisualStyles], [publicVisualStyles, token, userStyles]);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const addAsset = useAssetStore((state) => state.addAsset);
    const cleanupAssetImages = useAssetStore((state) => state.cleanupImages);
    const hydrated = useCanvasStore((state) => state.hydrated);
    const createProject = useCanvasStore((state) => state.createProject);
    const openProject = useCanvasStore((state) => state.openProject);
    const updateProject = useCanvasStore((state) => state.updateProject);
    const renameProject = useCanvasStore((state) => state.renameProject);
    const deleteProjects = useCanvasStore((state) => state.deleteProjects);
    const currentProject = useCanvasStore((state) => state.projects.find((project) => project.id === projectId));
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [nodes, setNodes] = useState<CanvasNodeData[]>([]);
    const [connections, setConnections] = useState<CanvasConnection[]>([]);
    const [groups, setGroups] = useState<CanvasGroup[]>([]);
    const [chatSessions, setChatSessions] = useState<CanvasAssistantSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, k: 1 });
    const [size, setSize] = useState({ width: 1200, height: 720 });
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [connectingParams, setConnectingParams] = useState<ConnectionHandle | null>(null);
    const [connectionTargetNodeId, setConnectionTargetNodeId] = useState<string | null>(null);
    const [pendingConnectionCreate, setPendingConnectionCreate] = useState<PendingConnectionCreate | null>(null);
    const [mouseWorld, setMouseWorld] = useState<Position>({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
    const [isMiniMapOpen, setIsMiniMapOpen] = useState(false);
    const [backgroundMode, setBackgroundMode] = useState<CanvasBackgroundMode>("lines");
    const [showImageInfo, setShowImageInfo] = useState(false);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [assetPickerTab, setAssetPickerTab] = useState<AssetPickerTab>("my-assets");
    const [projectLoaded, setProjectLoaded] = useState(false);
    const [toolbarNodeId, setToolbarNodeId] = useState<string | null>(null);
    const [nodeImageSettingsOpen, setNodeImageSettingsOpen] = useState(false);
    const [dialogNodeId, setDialogNodeId] = useState<string | null>(null);
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editRequestNonce, setEditRequestNonce] = useState(0);
    const [infoNodeId, setInfoNodeId] = useState<string | null>(null);
    const [cropNodeId, setCropNodeId] = useState<string | null>(null);
    const [maskEditNodeId, setMaskEditNodeId] = useState<string | null>(null);
    const [upscaleNodeId, setUpscaleNodeId] = useState<string | null>(null);
    const [superResolveNodeId, setSuperResolveNodeId] = useState<string | null>(null);
    const [angleNodeId, setAngleNodeId] = useState<string | null>(null);
    const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
    const [fullscreenNodeId, setFullscreenNodeId] = useState<string | null>(null);
    const [boardMediaEditor, setBoardMediaEditor] = useState<CanvasBoardMediaEditorTarget | null>(null);
    const [boardMediaReturnFullscreenNodeId, setBoardMediaReturnFullscreenNodeId] = useState<string | null>(null);
    const [boardMediaDrafts, setBoardMediaDrafts] = useState<Record<string, CanvasNodeMetadata>>({});
    const [assistantCollapsed, setAssistantCollapsed] = useState(true);
    const [assistantMounted, setAssistantMounted] = useState(false);
    const [assistantClosing, setAssistantClosing] = useState(false);
    const [agentMode, setAgentMode] = useState<CanvasAgentMode>("online");
    const [agentUndoSnapshot, setAgentUndoSnapshot] = useState<CanvasAgentSnapshot | null>(null);
    const codexAutoConnect = ["new", "recent", "choose"].includes(searchParams.get("mode") || "");
    const codexCompactAgent = codexAutoConnect && searchParams.has("agentUrl");
    const [titleEditing, setTitleEditing] = useState(false);
    const [titleDraft, setTitleDraft] = useState("");
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
    const [collapsingBatchIds, setCollapsingBatchIds] = useState<Set<string>>(new Set());
    const [openingBatchIds, setOpeningBatchIds] = useState<Set<string>>(new Set());
    const [isNodeDragging, setIsNodeDragging] = useState(false);

    const nodesRef = useRef(nodes);
    const connectionsRef = useRef(connections);
    const groupsRef = useRef(groups);
    const selectedNodeIdsRef = useRef(selectedNodeIds);
    const selectedGroupIdRef = useRef(selectedGroupId);
    const viewportRef = useRef(viewport);
    const connectingParamsRef = useRef(connectingParams);
    const connectionTargetNodeIdRef = useRef(connectionTargetNodeId);
    const selectionBoxRef = useRef(selectionBox);
    const pendingConnectionCreateRef = useRef(pendingConnectionCreate);
    const agentCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const generateNodeRef = useRef<((nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => Promise<void>) | null>(null);

    const createHistoryEntry = useCallback(
        (): CanvasHistoryEntry => ({
            nodes: nodesRef.current,
            connections: connectionsRef.current,
            groups: groupsRef.current,
            chatSessions,
            activeChatId,
            backgroundMode,
            showImageInfo,
        }),
        [activeChatId, backgroundMode, chatSessions, showImageInfo],
    );

    const cleanupCanvasFiles = useCallback(
        (extra?: unknown) => {
            cleanupAssetImages({ extra, history: historyRef.current, lastHistory: lastHistoryRef.current });
        },
        [cleanupAssetImages],
    );

    useEffect(() => {
        if (token) void loadUserStyles(token);
    }, [loadUserStyles, token]);

    useEffect(() => {
        if (!hydrated) return;
        setProjectLoaded(false);
        const project = openProject(projectId);
        if (!project) {
            router.replace("/canvas");
            return;
        }

        const restore = async () => {
            const restoredNodes = normalizeCanvasNodeTitles(await hydrateCanvasImages(resetInterruptedGeneration(project.nodes)));
            const restoredSessions = await hydrateAssistantImages(project.chatSessions || []);
            setNodes(restoredNodes);
            setConnections(project.connections);
            setGroups(project.groups || []);
            setChatSessions(restoredSessions);
            setActiveChatId(project.activeChatId || null);
            setBackgroundMode(project.backgroundMode);
            setShowImageInfo(project.showImageInfo || false);
            setViewport(project.viewport);
            historyRef.current = { past: [], future: [] };
            if (historyCommitTimerRef.current) {
                clearTimeout(historyCommitTimerRef.current);
                historyCommitTimerRef.current = null;
            }
            lastHistoryRef.current = {
                nodes: restoredNodes,
                connections: project.connections,
                groups: project.groups || [],
                chatSessions: restoredSessions,
                activeChatId: project.activeChatId || null,
                backgroundMode: project.backgroundMode,
                showImageInfo: project.showImageInfo || false,
            };
            setHistoryState({ canUndo: false, canRedo: false });
            setProjectLoaded(true);
        };
        void restore();
    }, [hydrated, openProject, projectId, router]);

    useEffect(() => {
        if (!projectLoaded || applyingHistoryRef.current || historyPausedRef.current) return;
        const next = createHistoryEntry();
        const previous = lastHistoryRef.current;
        if (previous?.nodes === next.nodes && previous.connections === next.connections && previous.groups === next.groups && previous.chatSessions === next.chatSessions && previous.activeChatId === next.activeChatId && previous.backgroundMode === next.backgroundMode && previous.showImageInfo === next.showImageInfo) return;

        if (historyCommitTimerRef.current) clearTimeout(historyCommitTimerRef.current);
        historyCommitTimerRef.current = setTimeout(() => {
            const current = createHistoryEntry();
            const last = lastHistoryRef.current;
            if (!last) return;
            historyRef.current.past = [...historyRef.current.past.slice(-49), last];
            historyRef.current.future = [];
            setHistoryState({ canUndo: true, canRedo: false });
            lastHistoryRef.current = current;
            historyCommitTimerRef.current = null;
        }, 180);

        return () => {
            if (historyCommitTimerRef.current) {
                clearTimeout(historyCommitTimerRef.current);
                historyCommitTimerRef.current = null;
            }
        };
    }, [activeChatId, backgroundMode, chatSessions, connections, createHistoryEntry, groups, nodes, projectLoaded, showImageInfo]);

    useEffect(() => {
        if (!projectLoaded || historyPausedRef.current) return;
        updateProject(projectId, { nodes, connections, groups, chatSessions, activeChatId, backgroundMode, showImageInfo });
    }, [activeChatId, backgroundMode, chatSessions, connections, groups, nodes, projectId, projectLoaded, showImageInfo, updateProject]);

    useEffect(() => {
        if (!dialogNodeId) setNodeImageSettingsOpen(false);
    }, [dialogNodeId]);

    useEffect(() => {
        setNodes((prev) => normalizeCanvasNodeTitles(prev));
    }, [nodes.length]);

    useEffect(() => {
        if (!projectLoaded) return;
        if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        viewportSaveTimerRef.current = setTimeout(() => {
            updateProject(projectId, { viewport: viewportRef.current });
            viewportSaveTimerRef.current = null;
        }, 500);
        return () => {
            if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        };
    }, [projectId, projectLoaded, updateProject, viewport]);

    useLayoutEffect(() => {
        nodesRef.current = nodes;
        connectionsRef.current = connections;
        groupsRef.current = groups;
        selectedNodeIdsRef.current = selectedNodeIds;
        selectedGroupIdRef.current = selectedGroupId;
        viewportRef.current = viewport;
        connectingParamsRef.current = connectingParams;
        connectionTargetNodeIdRef.current = connectionTargetNodeId;
        pendingConnectionCreateRef.current = pendingConnectionCreate;
    }, [nodes, connections, groups, selectedNodeIds, selectedGroupId, viewport, connectingParams, connectionTargetNodeId, pendingConnectionCreate]);

    useLayoutEffect(() => {
        selectionBoxRef.current = selectionBox;
    }, [selectionBox]);

    useEffect(() => {
        if (selectedGroupId && (selectedNodeIds.size || selectedConnectionId)) setSelectedGroupId(null);
    }, [selectedConnectionId, selectedGroupId, selectedNodeIds]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updateSize = () => {
            const rect = el.getBoundingClientRect();
            setSize({ width: rect.width, height: rect.height });
            if (!didInitialCenterRef.current) {
                didInitialCenterRef.current = true;
                setViewport({ x: rect.width / 2, y: rect.height / 2, k: 1 });
            }
        };

        updateSize();
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(el);
        return () => resizeObserver.disconnect();
    }, []);

    const screenToCanvas = useCallback((clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        const currentViewport = viewportRef.current;
        const localX = clientX - (rect?.left || 0);
        const localY = clientY - (rect?.top || 0);

        return {
            x: (localX - currentViewport.x) / currentViewport.k,
            y: (localY - currentViewport.y) / currentViewport.k,
        };
    }, []);

    const getCanvasCenter = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        return screenToCanvas((rect?.left || 0) + (rect?.width || size.width) / 2, (rect?.top || 0) + (rect?.height || size.height) / 2);
    }, [screenToCanvas, size.height, size.width]);

    const setConnecting = useCallback((next: ConnectionHandle | null) => {
        connectingParamsRef.current = next;
        setConnectingParams(next);
        if (!next) {
            connectionTargetNodeIdRef.current = null;
            setConnectionTargetNodeId(null);
        }
    }, []);

    const keepNodeToolbar = useCallback(
        (nodeId: string) => {
            if (nodeDraggingRef.current || nodeImageSettingsOpen) return;
            if (toolbarHideTimerRef.current) {
                clearTimeout(toolbarHideTimerRef.current);
                toolbarHideTimerRef.current = null;
            }
            setToolbarNodeId(nodeId);
        },
        [nodeImageSettingsOpen],
    );

    const hideNodeToolbar = useCallback(() => {
        if (toolbarHideTimerRef.current) clearTimeout(toolbarHideTimerRef.current);
        toolbarHideTimerRef.current = setTimeout(() => {
            setToolbarNodeId(null);
            toolbarHideTimerRef.current = null;
        }, 120);
    }, []);

    const connectNodes = useCallback(
        (current: ConnectionHandle, targetNodeId: string) => {
            if (current.nodeId === targetNodeId) return;

            const connection = normalizeConnection(current.nodeId, targetNodeId, nodesRef.current, current.handleType);
            if (!connection) {
                const first = nodesRef.current.find((node) => node.id === current.nodeId);
                const second = nodesRef.current.find((node) => node.id === targetNodeId);
                const from = current.handleType === "target" ? second : first;
                message.warning(getShortDramaStepType(first) && getShortDramaStepType(second) ? shortDramaConnectionWarning(getShortDramaStepType(from)) : "配置节点之间不能连接");
                return;
            }
            const { fromNodeId, toNodeId } = connection;
            const exists = connectionsRef.current.some((conn) => conn.fromNodeId === fromNodeId && conn.toNodeId === toNodeId);
            if (!exists) {
                setConnections((prev) => [...prev, { id: `conn-${Date.now()}`, fromNodeId, toNodeId }]);
            }
            setContextMenu(null);
        },
        [message],
    );

    const withDefaultStyle = useCallback(
        (type: CanvasNodeType | ConnectionCreateNodeType, metadata?: CanvasNodeMetadata): CanvasNodeMetadata | undefined => {
            if (!config.defaultStyleName || metadata?.styleName || (type !== CanvasNodeType.Image && type !== CanvasNodeType.Video && type !== CanvasNodeType.Config)) return metadata;
            return { ...metadata, styleName: config.defaultStyleName };
        },
        [config.defaultStyleName],
    );

    const createConnectedNode = useCallback(
        (type: ConnectionCreateNodeType, pending: PendingConnectionCreate) => {
            const metadata =
                type === CanvasNodeType.Config
                    ? { model: effectiveConfig.imageModel || effectiveConfig.model, size: effectiveConfig.size, count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count) }
                    : type !== "script" && isAgentNodeType(type)
                      ? { model: effectiveConfig.textModel || effectiveConfig.model }
                      : undefined;
            const newNode = type === "script" ? createScriptTextNode(pending.position, nodesRef.current, metadata) : createCanvasNode(type, pending.position, withDefaultStyle(type, metadata));
            if (!pending.connection) {
                setNodes((prev) => [...prev, newNode]);
                setSelectedNodeIds(new Set([newNode.id]));
                setSelectedConnectionId(null);
                if (type !== CanvasNodeType.Audio) setDialogNodeId(newNode.id);
                setPendingConnectionCreate(null);
                setConnecting(null);
                return;
            }
            const connection = normalizeConnection(pending.connection.nodeId, newNode.id, [...nodesRef.current, newNode], pending.connection.handleType);
            if (!connection) {
                const sourceNode = nodesRef.current.find((node) => node.id === pending.connection.nodeId);
                const from = pending.connection.handleType === "target" ? newNode : sourceNode;
                message.warning(getShortDramaStepType(sourceNode) && getShortDramaStepType(newNode) ? shortDramaConnectionWarning(getShortDramaStepType(from)) : "配置节点之间不能连接");
                return;
            }
            setNodes((prev) => [...prev, newNode]);
            setConnections((prev) => [...prev, { id: nanoid(), ...connection }]);
            setSelectedNodeIds(new Set([newNode.id]));
            setSelectedConnectionId(null);
            if (type !== CanvasNodeType.Audio) setDialogNodeId(newNode.id);
            setPendingConnectionCreate(null);
            setConnecting(null);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, effectiveConfig.textModel, message, setConnecting, withDefaultStyle],
    );

    const cancelPendingConnectionCreate = useCallback(() => {
        setPendingConnectionCreate(null);
        setConnecting(null);
    }, [setConnecting]);

    const getConnectionDropTarget = useCallback(
        (clientX: number, clientY: number, current: ConnectionHandle): ConnectionDropTarget => {
            const world = screenToCanvas(clientX, clientY);
            const scale = Math.max(viewportRef.current.k, 0.05);
            const padding = CONNECTION_NODE_HIT_PADDING / scale;
            const handleRadius = CONNECTION_HANDLE_HIT_RADIUS / scale;
            let isNearNode = false;
            let bestNodeId: string | null = null;
            let bestPriority = Number.POSITIVE_INFINITY;

            [...nodesRef.current]
                .filter((node) => !isHiddenBatchChild(node, nodesRef.current))
                .reverse()
                .forEach((node) => {
                    const anchor = getConnectionTargetAnchor(node, current);
                    const dx = world.x - anchor.x;
                    const dy = world.y - anchor.y;
                    const hitsHandle = dx * dx + dy * dy <= handleRadius * handleRadius;
                    const hitsInside = world.x >= node.position.x && world.x <= node.position.x + node.width && world.y >= node.position.y && world.y <= node.position.y + node.height;
                    const hitsExpanded = world.x >= node.position.x - padding && world.x <= node.position.x + node.width + padding && world.y >= node.position.y - padding && world.y <= node.position.y + node.height + padding;

                    if (!hitsHandle && !hitsInside && !hitsExpanded) return;
                    isNearNode = true;
                    if (node.id === current.nodeId || !normalizeConnection(current.nodeId, node.id, nodesRef.current, current.handleType)) return;

                    const priority = hitsInside ? 0 : hitsHandle ? 1 : 2;
                    if (priority < bestPriority) {
                        bestNodeId = node.id;
                        bestPriority = priority;
                    }
                });

            return { nodeId: bestNodeId, isNearNode };
        },
        [screenToCanvas],
    );

    const visibleNodes = useMemo(() => {
        const padding = 280;
        const rect = containerRef.current?.getBoundingClientRect();
        const width = rect?.width || size.width;
        const height = rect?.height || size.height;
        const viewLeft = -viewport.x / viewport.k - padding;
        const viewTop = -viewport.y / viewport.k - padding;
        const viewRight = viewLeft + width / viewport.k + padding * 2;
        const viewBottom = viewTop + height / viewport.k + padding * 2;

        return nodes.filter((node) => !isHiddenBatchChild(node, nodes, collapsingBatchIds) && node.position.x + node.width > viewLeft && node.position.x < viewRight && node.position.y + node.height > viewTop && node.position.y < viewBottom);
    }, [collapsingBatchIds, nodes, size.height, size.width, viewport.k, viewport.x, viewport.y]);

    const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
    const groupFrames = useMemo(() => {
        const padding = 280;
        const rect = containerRef.current?.getBoundingClientRect();
        const width = rect?.width || size.width;
        const height = rect?.height || size.height;
        const viewLeft = -viewport.x / viewport.k - padding;
        const viewTop = -viewport.y / viewport.k - padding;
        const viewRight = viewLeft + width / viewport.k + padding * 2;
        const viewBottom = viewTop + height / viewport.k + padding * 2;

        return groups.flatMap((group) => {
            const groupNodes = group.nodeIds.map((nodeId) => nodeById.get(nodeId)).filter((node): node is CanvasNodeData => Boolean(node && !isHiddenBatchChild(node, nodes, collapsingBatchIds)));
            if (!groupNodes.length) return [];
            const nodeBounds = getNodesBounds(groupNodes);
            const bounds = {
                left: group.position?.x ?? nodeBounds.left,
                top: group.position?.y ?? nodeBounds.top,
                width: group.width || nodeBounds.width,
                height: group.height || nodeBounds.height,
                right: (group.position?.x ?? nodeBounds.left) + (group.width || nodeBounds.width),
                bottom: (group.position?.y ?? nodeBounds.top) + (group.height || nodeBounds.height),
            };
            if (bounds.left + bounds.width < viewLeft || bounds.left > viewRight || bounds.top + bounds.height < viewTop || bounds.top > viewBottom) return [];
            return [{ group, bounds, nodeCount: groupNodes.length }];
        });
    }, [collapsingBatchIds, groups, nodeById, nodes, size.height, size.width, viewport.k, viewport.x, viewport.y]);
    const toolbarNode = toolbarNodeId ? nodeById.get(toolbarNodeId) || null : null;
    const selectedTextToolbarNode = selectedNodeIds.size === 1 ? nodeById.get(Array.from(selectedNodeIds)[0]) || null : null;
    const activeToolbarNode = toolbarNode || (selectedTextToolbarNode?.type === CanvasNodeType.Text ? selectedTextToolbarNode : null);
    const infoNode = infoNodeId ? nodeById.get(infoNodeId) || null : null;
    const cropNode = cropNodeId ? nodeById.get(cropNodeId) || null : null;
    const maskEditNode = maskEditNodeId ? nodeById.get(maskEditNodeId) || null : null;
    const upscaleNode = upscaleNodeId ? nodeById.get(upscaleNodeId) || null : null;
    const superResolveNode = superResolveNodeId ? nodeById.get(superResolveNodeId) || null : null;
    const angleNode = angleNodeId ? nodeById.get(angleNodeId) || null : null;
    const previewNode = previewNodeId ? nodeById.get(previewNodeId) || null : null;
    const fullscreenNode = fullscreenNodeId ? nodeById.get(fullscreenNodeId) || null : null;
    const boardMediaNode = boardMediaEditor ? nodeById.get(boardMediaEditor.nodeId) || null : null;
    const hasMultipleSelectedNodes = selectedNodeIds.size > 1;
    const selectedNodesBounds = useMemo(() => {
        if (!hasMultipleSelectedNodes) return null;
        const selectedNodes = Array.from(selectedNodeIds)
            .map((nodeId) => nodeById.get(nodeId))
            .filter((node): node is CanvasNodeData => Boolean(node && !isHiddenBatchChild(node, nodes, collapsingBatchIds)));
        return selectedNodes.length > 1 ? getNodesBounds(selectedNodes) : null;
    }, [collapsingBatchIds, hasMultipleSelectedNodes, nodeById, nodes, selectedNodeIds]);
    const activeNodeId = hasMultipleSelectedNodes ? null : hoveredNodeId || (selectedNodeIds.size === 1 ? Array.from(selectedNodeIds)[0] : null);
    const batchChildCountById = useMemo(() => {
        const map = new Map<string, number>();
        nodes.forEach((node) => {
            if (node.metadata?.isBatchRoot) map.set(node.id, node.metadata.batchChildIds?.length || 0);
        });
        return map;
    }, [nodes]);
    const batchMotionById = useMemo(() => {
        const map = new Map<string, { x: number; y: number; index: number }>();
        nodes.forEach((node) => {
            const rootId = node.metadata?.batchRootId;
            if (!rootId) return;
            const root = nodeById.get(rootId);
            const index = root?.metadata?.batchChildIds?.indexOf(node.id) ?? 0;
            const stackX = root ? root.position.x + 34 + index * 14 : node.position.x;
            const stackY = root ? root.position.y + 14 + index * 8 : node.position.y;
            map.set(node.id, { x: stackX - node.position.x, y: stackY - node.position.y, index: Math.max(index, 0) });
        });
        return map;
    }, [nodeById, nodes]);
    const relatedHighlight = useMemo(() => {
        const nodeIds = new Set<string>();
        const connectionIds = new Set<string>();

        if (!activeNodeId) return { nodeIds, connectionIds };

        nodeIds.add(activeNodeId);
        connections.forEach((connection) => {
            if (connection.fromNodeId !== activeNodeId && connection.toNodeId !== activeNodeId) return;
            connectionIds.add(connection.id);
            nodeIds.add(connection.fromNodeId);
            nodeIds.add(connection.toNodeId);
        });

        return { nodeIds, connectionIds };
    }, [activeNodeId, connections]);

    const configInputsById = useMemo(() => {
        const map = new Map<string, NodeGenerationInput[]>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Config) return;
            map.set(node.id, buildNodeGenerationInputs(node.id, nodes, connections));
        });
        return map;
    }, [connections, nodes]);
    const generationInputsById = useMemo(() => {
        const map = new Map<string, NodeGenerationInput[]>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video && node.type !== CanvasNodeType.Audio && node.type !== CanvasNodeType.Text && node.type !== CanvasNodeType.Config) return;
            map.set(node.id, buildNodeGenerationInputs(node.id, nodes, connections));
        });
        return map;
    }, [connections, nodes]);
    const resourceContextNodeId = dialogNodeId || activeNodeId;
    const canvasResourceReferences = useMemo(() => buildCanvasResourceReferences(nodes, connections, resourceContextNodeId), [connections, nodes, resourceContextNodeId]);
    const resourceReferenceByNodeId = useMemo(() => new Map(canvasResourceReferences.map((reference) => [reference.nodeId, reference])), [canvasResourceReferences]);
    const mentionReferencesByNodeId = useMemo(() => {
        const map = new Map<string, ReturnType<typeof buildNodeMentionReferences>>();
        nodes.forEach((node) => map.set(node.id, buildNodeMentionReferences(node, nodes, connections)));
        return map;
    }, [connections, nodes]);

    const agentInputsById = useMemo(() => {
        const map = new Map<string, NodeGenerationInput[]>();
        nodes.forEach((node) => {
            if (!isAgentNode(node)) return;
            map.set(node.id, buildNodeGenerationInputs(node.id, nodes, connections));
        });
        return map;
    }, [connections, nodes]);

    const textInputsById = useMemo(() => {
        const map = new Map<string, NodeGenerationInput[]>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Text) return;
            map.set(node.id, buildNodeGenerationInputs(node.id, nodes, connections));
        });
        return map;
    }, [connections, nodes]);

    const upstreamImagePreviewsById = useMemo(() => {
        const map = new Map<string, { id: string; url: string; title?: string }[]>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Image) return;
            const previews = buildNodeGenerationInputs(node.id, nodes, connections)
                .filter((input) => input.type === "image" && input.image)
                .map((input) => ({ id: input.image!.id, url: input.image!.dataUrl, title: input.title }));
            map.set(node.id, previews);
        });
        return map;
    }, [connections, nodes]);

    const videoUpstreamRefsById = useMemo(() => {
        const map = new Map<string, { id: string; storageKey?: string; url: string }[]>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Video && node.type !== CanvasNodeType.Config) return;
            const images = buildNodeGenerationInputs(node.id, nodes, connections)
                .filter((input) => input.type === "image" && input.image)
                .map((input) => ({ id: input.image!.id, storageKey: input.image!.storageKey, url: input.image!.dataUrl }));
            map.set(node.id, images);
        });
        return map;
    }, [connections, nodes]);

    const storyboardShotOptionsById = useMemo(() => {
        const map = new Map<string, CanvasStoryboardShotOption[]>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video) return;
            const options = connections
                .filter((connection) => connection.toNodeId === node.id)
                .flatMap((connection) => {
                    const source = nodeById.get(connection.fromNodeId);
                    if (source?.type !== CanvasNodeType.Storyboard) return [];
                    return (source.metadata?.storyboard?.shots || []).map((shot) => ({
                        sourceNodeId: source.id,
                        shotId: shot.id,
                        label: `${source.title || "分镜板"} / 镜头 ${shot.id}`,
                        description: shot.description,
                        imagePrompt: shot.imagePrompt,
                        videoPrompt: shot.videoPrompt,
                        imageUrl: shot.image?.status === "done" ? shot.image.url : undefined,
                    }));
                });
            if (options.length) map.set(node.id, options);
        });
        return map;
    }, [connections, nodeById, nodes]);

    const storyboardSubjectReferencesById = useMemo(() => {
        const map = new Map<string, CanvasStoryboardReference[]>();
        const subjectBoards = nodes.filter((node) => node.type === CanvasNodeType.SubjectBoard);
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Storyboard) return;
            const linkedSubjectBoards = connections
                .filter((connection) => connection.toNodeId === node.id)
                .map((connection) => nodeById.get(connection.fromNodeId))
                .filter((source): source is CanvasNodeData => source?.type === CanvasNodeType.SubjectBoard);
            const sourceBoards = linkedSubjectBoards.length ? linkedSubjectBoards : subjectBoards;
            map.set(node.id, sourceBoards.flatMap(buildStoryboardSubjectReferences));
        });
        return map;
    }, [connections, nodeById, nodes]);

    const agentSnapshot = useMemo<CanvasAgentSnapshot>(
        () => ({ projectId, title: currentProject?.title || "未命名画布", nodes, connections, selectedNodeIds: Array.from(selectedNodeIds), viewport }),
        [connections, currentProject?.title, nodes, projectId, selectedNodeIds, viewport],
    );

    const applyAgentOps = useCallback(
        (ops?: CanvasAgentOp[]) => {
            const safeOps = Array.isArray(ops) ? ops.filter((op) => op?.type) : [];
            const before = { projectId, title: currentProject?.title || "未命名画布", nodes: nodesRef.current, connections: connectionsRef.current, selectedNodeIds: Array.from(selectedNodeIdsRef.current), viewport: viewportRef.current };
            const generationOps = safeOps.filter((op): op is Extract<CanvasAgentOp, { type: "run_generation" }> => op.type === "run_generation" && Boolean(op.nodeId));
            const next = applyCanvasAgentOps(before, safeOps.filter((op) => op.type !== "run_generation"));
            nodesRef.current = next.nodes;
            connectionsRef.current = next.connections;
            selectedNodeIdsRef.current = new Set(next.selectedNodeIds);
            viewportRef.current = next.viewport;
            setAgentUndoSnapshot(before);
            setNodes(next.nodes);
            setConnections(next.connections);
            setSelectedNodeIds(new Set(next.selectedNodeIds));
            setSelectedConnectionId(null);
            setViewport(next.viewport);
            setContextMenu(null);
            if (generationOps.length) {
                queueMicrotask(() =>
                    generationOps.forEach((op) => {
                        const target = nodesRef.current.find((node) => node.id === op.nodeId);
                        const prompt = op.prompt?.trim() ? op.prompt : target?.metadata?.composerContent ?? target?.metadata?.prompt ?? "";
                        const mode = (op.mode || target?.metadata?.generationMode || "image") as CanvasNodeGenerationMode;
                        void generateNodeRef.current?.(op.nodeId, mode, prompt);
                    }),
                );
            }
            return { ...next, projectId, title: currentProject?.title || "未命名画布" };
        },
        [currentProject?.title, projectId],
    );

    const undoAgentOps = useCallback(() => {
        if (!agentUndoSnapshot) return null;
        nodesRef.current = agentUndoSnapshot.nodes;
        connectionsRef.current = agentUndoSnapshot.connections;
        selectedNodeIdsRef.current = new Set(agentUndoSnapshot.selectedNodeIds);
        viewportRef.current = agentUndoSnapshot.viewport;
        setNodes(agentUndoSnapshot.nodes);
        setConnections(agentUndoSnapshot.connections);
        setSelectedNodeIds(new Set(agentUndoSnapshot.selectedNodeIds));
        setSelectedConnectionId(null);
        setViewport(agentUndoSnapshot.viewport);
        setContextMenu(null);
        setAgentUndoSnapshot(null);
        return { ...agentUndoSnapshot, projectId, title: currentProject?.title || "未命名画布" };
    }, [agentUndoSnapshot, currentProject?.title, projectId]);

    const createNode = useCallback(
        (type: CanvasNodeType, position?: Position) => {
            const targetPosition = position || getCanvasCenter();
            const configMetadata =
                type === CanvasNodeType.Config
                    ? {
                          model: effectiveConfig.imageModel || effectiveConfig.model,
                          size: effectiveConfig.size,
                          count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count),
                      }
                    : isAgentNodeType(type)
                      ? {
                            model: effectiveConfig.textModel || effectiveConfig.model,
                        }
                    : undefined;
            const newNode = createCanvasNode(type, targetPosition, withDefaultStyle(type, configMetadata));

            setNodes((prev) => [...prev, newNode]);
            setSelectedNodeIds(new Set([newNode.id]));
            setSelectedConnectionId(null);
            if (type !== CanvasNodeType.Audio) setDialogNodeId(newNode.id);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, effectiveConfig.textModel, getCanvasCenter, withDefaultStyle],
    );

    const activeShortDramaNode = selectedNodeIds.size === 1 ? nodeById.get(Array.from(selectedNodeIds)[0]) || null : null;
    const activeShortDramaStepType = getShortDramaStepType(activeShortDramaNode);
    const activeShortDramaNextTypes = activeShortDramaStepType ? getNextShortDramaNodeTypes(activeShortDramaStepType) : [];

    const createShortDramaNode = useCallback(
        (type: ShortDramaStepType, position: Position) => {
            const metadata = type !== "script" && isAgentNodeType(type) ? { model: effectiveConfig.textModel || effectiveConfig.model } : undefined;
            if (type === "script") return createScriptTextNode(position, nodesRef.current, metadata);
            return createCanvasNode(type, position, metadata);
        },
        [effectiveConfig.model, effectiveConfig.textModel],
    );

    const createShortDramaStep = useCallback(
        (type: ShortDramaStepType) => {
            const selectedIds = selectedNodeIdsRef.current;
            const sourceNode = selectedIds.size === 1 ? nodesRef.current.find((node) => selectedIds.has(node.id)) || null : null;
            const sourceStepType = getShortDramaStepType(sourceNode);
            if (sourceNode && sourceStepType) {
                if (sourceStepType === type || !isAllowedShortDramaConnection(sourceStepType, type)) {
                    message.warning(shortDramaConnectionWarning(sourceStepType));
                    return;
                }
                const spec = getNodeSpec(type === "script" ? CanvasNodeType.Text : type);
                const position = {
                    x: sourceNode.position.x + sourceNode.width + 120 + spec.width / 2,
                    y: sourceNode.position.y + sourceNode.height / 2,
                };
                const newNode = createShortDramaNode(type, position);
                const connection = normalizeConnection(sourceNode.id, newNode.id, [...nodesRef.current, newNode], "source");
                if (!connection) {
                    message.warning(shortDramaConnectionWarning(sourceStepType));
                    return;
                }
                setNodes((prev) => [...prev, newNode]);
                setConnections((prev) => (prev.some((conn) => conn.fromNodeId === connection.fromNodeId && conn.toNodeId === connection.toNodeId) ? prev : [...prev, { id: nanoid(), ...connection }]));
                setSelectedNodeIds(new Set([newNode.id]));
                setSelectedConnectionId(null);
                setDialogNodeId(newNode.id);
                return;
            }
            if (type === "script") {
                const newNode = createScriptTextNode(getCanvasCenter(), nodesRef.current);
                setNodes((prev) => [...prev, newNode]);
                setSelectedNodeIds(new Set([newNode.id]));
                setSelectedConnectionId(null);
                setDialogNodeId(newNode.id);
                return;
            }
            createNode(type);
        },
        [createNode, createShortDramaNode, getCanvasCenter, message],
    );

    const createShortDramaFlow = useCallback(() => {
        const flowTypes: ShortDramaStepType[] = [CanvasNodeType.ProjectBrief, CanvasNodeType.ScriptAgent, "script", CanvasNodeType.CharacterAgent, CanvasNodeType.SubjectBoard, CanvasNodeType.StoryboardAgent, CanvasNodeType.Storyboard];
        const center = getCanvasCenter();
        let left = center.x - NODE_DEFAULT_SIZE[CanvasNodeType.ProjectBrief].width / 2;
        const newNodes = flowTypes.map((type) => {
            const spec = getNodeSpec(type === "script" ? CanvasNodeType.Text : type);
            const node = createShortDramaNode(type, { x: left + spec.width / 2, y: center.y });
            left += spec.width + 120;
            return node;
        });
        const nextConnections: CanvasConnection[] = [];
        for (let index = 0; index < newNodes.length - 1; index += 1) {
            const connection = normalizeConnection(newNodes[index].id, newNodes[index + 1].id, newNodes, "source");
            if (connection) nextConnections.push({ id: nanoid(), ...connection });
        }
        const scriptNode = newNodes.find((node) => node.type === CanvasNodeType.Text && node.metadata?.textRole === "script");
        const storyboardAgentNode = newNodes.find((node) => node.type === CanvasNodeType.StoryboardAgent);
        if (scriptNode && storyboardAgentNode) {
            const connection = normalizeConnection(scriptNode.id, storyboardAgentNode.id, newNodes, "source");
            if (connection) nextConnections.push({ id: nanoid(), ...connection });
        }
        setNodes((prev) => [...prev, ...newNodes]);
        setConnections((prev) => [...prev, ...nextConnections]);
        setSelectedNodeIds(new Set([newNodes[0].id]));
        setSelectedConnectionId(null);
        setDialogNodeId(newNodes[0].id);
    }, [createShortDramaNode, getCanvasCenter]);

    const createShortDramaNextFromNode = useCallback(
        (sourceNode: CanvasNodeData) => {
            const sourceCenterY = sourceNode.position.y + sourceNode.height / 2;
            const nextNodes: CanvasNodeData[] = [];
            const nextConnections: CanvasConnection[] = [];
            let focusNodeId: string | null = null;
            let left = sourceNode.position.x + sourceNode.width + 120;

            const createAtRight = (type: ShortDramaStepType) => {
                const spec = getNodeSpec(type === "script" ? CanvasNodeType.Text : type);
                const node = createShortDramaNode(type, { x: left + spec.width / 2, y: sourceCenterY });
                nextNodes.push(node);
                left += spec.width + 120;
                return node;
            };

            const addConnection = (fromNodeId: string, toNodeId: string) => {
                const connection = normalizeConnection(fromNodeId, toNodeId, [...nodesRef.current, ...nextNodes], "source");
                if (connection) nextConnections.push({ id: nanoid(), ...connection });
            };
            const focusExisting = (targetType: ShortDramaStepType) => {
                const existing = findConnectedShortDramaTarget(sourceNode.id, targetType, nodesRef.current, connectionsRef.current);
                if (!existing) return false;
                setSelectedNodeIds(new Set([existing.id]));
                setSelectedConnectionId(null);
                setDialogNodeId(existing.id);
                return true;
            };

            if (sourceNode.type === CanvasNodeType.ProjectBrief) {
                if (focusExisting(CanvasNodeType.ScriptAgent)) return;
                const agentNode = createAtRight(CanvasNodeType.ScriptAgent);
                const scriptNode = createAtRight("script");
                addConnection(sourceNode.id, agentNode.id);
                addConnection(agentNode.id, scriptNode.id);
                focusNodeId = agentNode.id;
            } else if (sourceNode.type === CanvasNodeType.Text && sourceNode.metadata?.textRole === "script") {
                if (focusExisting(CanvasNodeType.CharacterAgent)) return;
                const agentNode = createAtRight(CanvasNodeType.CharacterAgent);
                const boardNode = createAtRight(CanvasNodeType.SubjectBoard);
                addConnection(sourceNode.id, agentNode.id);
                addConnection(agentNode.id, boardNode.id);
                focusNodeId = agentNode.id;
            } else if (sourceNode.type === CanvasNodeType.SubjectBoard) {
                if (focusExisting(CanvasNodeType.StoryboardAgent)) return;
                const agentNode = createAtRight(CanvasNodeType.StoryboardAgent);
                const storyboardNode = createAtRight(CanvasNodeType.Storyboard);
                addConnection(sourceNode.id, agentNode.id);
                const scriptNode = findUpstreamScriptNode(sourceNode.id, nodesRef.current, connectionsRef.current);
                if (scriptNode) addConnection(scriptNode.id, agentNode.id);
                else message.warning("未找到上游剧本，分镜 Agent 将只连接角色板。");
                addConnection(agentNode.id, storyboardNode.id);
                focusNodeId = agentNode.id;
            }

            if (!nextNodes.length) return;
            setNodes((prev) => [...prev, ...nextNodes]);
            setConnections((prev) => {
                const existing = new Set(prev.map((connection) => `${connection.fromNodeId}:${connection.toNodeId}`));
                const unique = nextConnections.filter((connection) => {
                    const key = `${connection.fromNodeId}:${connection.toNodeId}`;
                    if (existing.has(key)) return false;
                    existing.add(key);
                    return true;
                });
                return [...prev, ...unique];
            });
            if (focusNodeId) {
                setSelectedNodeIds(new Set([focusNodeId]));
                setSelectedConnectionId(null);
                setDialogNodeId(focusNodeId);
            }
        },
        [createShortDramaNode, message],
    );

    const deleteNodes = useCallback(
        (ids: Set<string>) => {
            if (!ids.size) return;
            const allIds = new Set(ids);
            nodesRef.current.forEach((node) => {
                if (ids.has(node.id)) node.metadata?.batchChildIds?.forEach((childId) => allIds.add(childId));
            });
            setNodes((prev) => {
                const next = prev.filter((node) => !allIds.has(node.id));
                return next.map((node) => {
                    const childIds = node.metadata?.batchChildIds?.filter((childId) => !allIds.has(childId));
                    if (!node.metadata?.isBatchRoot || childIds?.length === node.metadata.batchChildIds?.length) return node;
                    const primaryImageId = childIds?.includes(node.metadata.primaryImageId || "") ? node.metadata.primaryImageId : childIds?.[0];
                    const primaryNode = next.find((item) => item.id === primaryImageId);
                    return {
                        ...node,
                        metadata: {
                            ...node.metadata,
                            batchChildIds: childIds,
                            primaryImageId,
                            content: primaryNode?.metadata?.content || node.metadata.content,
                            naturalWidth: primaryNode?.metadata?.naturalWidth || node.metadata.naturalWidth,
                            naturalHeight: primaryNode?.metadata?.naturalHeight || node.metadata.naturalHeight,
                        },
                    };
                });
            });
            setConnections((prev) => prev.filter((conn) => !allIds.has(conn.fromNodeId) && !allIds.has(conn.toNodeId)));
            setGroups((prev) =>
                prev
                    .map((group) => ({ ...group, nodeIds: group.nodeIds.filter((nodeId) => !allIds.has(nodeId)) }))
                    .filter((group) => group.nodeIds.length > 0),
            );
            setSelectedNodeIds(new Set());
            setSelectedConnectionId(null);
            setSelectedGroupId(null);
            setHoveredNodeId((current) => (current && allIds.has(current) ? null : current));
            setToolbarNodeId((current) => (current && allIds.has(current) ? null : current));
            setDialogNodeId((current) => (current && allIds.has(current) ? null : current));
            setEditingNodeId((current) => (current && allIds.has(current) ? null : current));
            setInfoNodeId((current) => (current && allIds.has(current) ? null : current));
            setCropNodeId((current) => (current && allIds.has(current) ? null : current));
            setMaskEditNodeId((current) => (current && allIds.has(current) ? null : current));
            setAngleNodeId((current) => (current && allIds.has(current) ? null : current));
            setPreviewNodeId((current) => (current && allIds.has(current) ? null : current));
            setRunningNodeId((current) => (current && allIds.has(current) ? null : current));
            setContextMenu((current) => (current?.type === "node" && allIds.has(current.nodeId) ? null : current));
            cleanupCanvasFiles({ projectId, nodes: nodesRef.current.filter((node) => !allIds.has(node.id)), chatSessions });
        },
        [chatSessions, cleanupCanvasFiles, projectId],
    );

    const deleteConnection = useCallback((connectionId: string) => {
        setConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
        setSelectedConnectionId((current) => (current === connectionId ? null : current));
        setContextMenu((current) => (current?.type === "connection" && current.connectionId === connectionId ? null : current));
    }, []);

    const createGroupFromSelection = useCallback(() => {
        const selectedIds = selectedNodeIdsRef.current;
        if (selectedIds.size < 2) {
            message.warning("请先选择两个以上节点");
            return;
        }
        const groupNodes = nodesRef.current.filter((node) => selectedIds.has(node.id));
        if (groupNodes.length < 2) return;
        const bounds = getNodesBounds(groupNodes);
        const selected = new Set(groupNodes.map((node) => node.id));
        const groupId = nanoid();

        setGroups((prev) => [
            ...prev
                .map((group) => ({ ...group, nodeIds: group.nodeIds.filter((nodeId) => !selected.has(nodeId)) }))
                .filter((group) => group.nodeIds.length > 0),
            {
                id: groupId,
                title: nextGroupTitle(prev),
                nodeIds: Array.from(selected),
                position: { x: bounds.left, y: bounds.top },
                width: bounds.width,
                height: bounds.height,
            },
        ]);
        setSelectedNodeIds(new Set());
        setSelectedConnectionId(null);
        setSelectedGroupId(groupId);
        setContextMenu(null);
    }, [message]);

    const renameGroup = useCallback((groupId: string, title: string) => {
        setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, title } : group)));
    }, []);

    const ungroup = useCallback((groupId: string) => {
        setGroups((prev) => prev.filter((group) => group.id !== groupId));
        setSelectedGroupId((current) => (current === groupId ? null : current));
    }, []);

    const updateGroupColor = useCallback((groupId: string, color: string) => {
        setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, color } : group)));
    }, []);

    const arrangeNodesByIds = useCallback((nodeIds: string[], mode: CanvasArrangeMode) => {
        const idSet = new Set(nodeIds);
        const targetNodes = nodesRef.current.filter((node) => idSet.has(node.id));
        if (targetNodes.length < 2) return null;

        const bounds = getNodesBounds(targetNodes);
        const gap = 48;
        const maxWidth = Math.max(...targetNodes.map((node) => node.width));
        const maxHeight = Math.max(...targetNodes.map((node) => node.height));
        const columns = Math.max(1, Math.ceil(Math.sqrt(targetNodes.length)));
        const positionById = new Map<string, Position>();

        targetNodes.forEach((node, index) => {
            if (mode === "horizontal") {
                positionById.set(node.id, { x: bounds.left + index * (maxWidth + gap), y: bounds.top + (maxHeight - node.height) / 2 });
                return;
            }
            if (mode === "vertical") {
                positionById.set(node.id, { x: bounds.left + (maxWidth - node.width) / 2, y: bounds.top + index * (maxHeight + gap) });
                return;
            }
            const row = Math.floor(index / columns);
            const col = index % columns;
            positionById.set(node.id, { x: bounds.left + col * (maxWidth + gap), y: bounds.top + row * (maxHeight + gap) });
        });

        setNodes((prev) => prev.map((node) => (positionById.has(node.id) ? { ...node, position: positionById.get(node.id)! } : node)));
        return getNodesBounds(targetNodes.map((node) => ({ ...node, position: positionById.get(node.id) || node.position })));
    }, []);

    const arrangeGroupNodes = useCallback(
        (groupId: string, mode: CanvasArrangeMode) => {
            const group = groupsRef.current.find((item) => item.id === groupId);
            if (!group) return;
            const bounds = arrangeNodesByIds(group.nodeIds, mode);
            if (bounds) setGroups((prev) => prev.map((item) => (item.id === groupId ? { ...item, position: { x: bounds.left, y: bounds.top }, width: bounds.width, height: bounds.height } : item)));
        },
        [arrangeNodesByIds],
    );

    const arrangeSelectedNodes = useCallback(
        (mode: CanvasArrangeMode) => {
            arrangeNodesByIds(Array.from(selectedNodeIdsRef.current), mode);
        },
        [arrangeNodesByIds],
    );

    const handleGroupMouseDown = useCallback((event: ReactPointerEvent<HTMLDivElement>, groupId: string) => {
        event.preventDefault();
        event.stopPropagation();
        const group = groupsRef.current.find((item) => item.id === groupId);
        if (!group) return;
        const nodeIds = new Set(group.nodeIds);
        const groupNodes = nodesRef.current.filter((node) => nodeIds.has(node.id));
        if (!groupNodes.length) return;

        setSelectedGroupId(groupId);
        setSelectedNodeIds(new Set());
        setSelectedConnectionId(null);
        setDialogNodeId(null);
        setContextMenu(null);
        dragRef.current = {
            isDraggingNode: true,
            dragKind: "group",
            hasMoved: false,
            startX: event.clientX,
            startY: event.clientY,
            groupId,
            initialGroupPosition: { ...group.position },
            initialSelectedNodes: groupNodes.map((node) => ({ id: node.id, x: node.position.x, y: node.position.y })),
        };
        historyPausedRef.current = true;
        nodeDraggingRef.current = true;
        document.body.style.cursor = "grabbing";
        setIsNodeDragging(true);
    }, []);

    const handleGroupResizeStart = useCallback((event: ReactPointerEvent<HTMLElement>, groupId: string, corner: GroupResizeCorner) => {
        event.preventDefault();
        event.stopPropagation();
        const group = groupsRef.current.find((item) => item.id === groupId);
        if (!group) return;
        setSelectedGroupId(groupId);
        setSelectedNodeIds(new Set());
        setSelectedConnectionId(null);
        setDialogNodeId(null);
        setContextMenu(null);
        groupResizeRef.current = {
            isResizing: true,
            groupId,
            corner,
            startX: event.clientX,
            startY: event.clientY,
            initial: { x: group.position.x, y: group.position.y, width: group.width, height: group.height },
        };
        historyPausedRef.current = true;
        document.body.style.cursor = `${corner.includes("top") === corner.includes("left") ? "nwse" : "nesw"}-resize`;
    }, []);

    const handleSelectionFrameMouseDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const selectedIds = selectedNodeIdsRef.current;
        if (selectedIds.size < 2) return;
        const dragIds = new Set(selectedIds);
        nodesRef.current.forEach((node) => {
            if (selectedIds.has(node.id)) node.metadata?.batchChildIds?.forEach((childId) => dragIds.add(childId));
        });
        const selectedNodes = nodesRef.current.filter((node) => dragIds.has(node.id));
        if (selectedNodes.length < 2) return;

        setSelectedGroupId(null);
        setSelectedConnectionId(null);
        setDialogNodeId(null);
        setContextMenu(null);
        dragRef.current = {
            isDraggingNode: true,
            dragKind: "node",
            hasMoved: false,
            startX: event.clientX,
            startY: event.clientY,
            initialSelectedNodes: selectedNodes.map((node) => ({ id: node.id, x: node.position.x, y: node.position.y })),
        };
        historyPausedRef.current = true;
        nodeDraggingRef.current = true;
        document.body.style.cursor = "grabbing";
        setIsNodeDragging(true);
    }, []);

    const deselectCanvas = useCallback(() => {
        cancelPendingConnectionCreate();
        setSelectedNodeIds(new Set());
        setSelectedConnectionId(null);
        setSelectedGroupId(null);
        setContextMenu(null);
        setSelectionBox(null);
        setHoveredNodeId(null);
        setToolbarNodeId(null);
        setDialogNodeId(null);
        setEditingNodeId(null);
    }, [cancelPendingConnectionCreate]);

    const clearCanvas = useCallback(() => {
        setNodes([]);
        setConnections([]);
        setGroups([]);
        setInfoNodeId(null);
        setCropNodeId(null);
        setMaskEditNodeId(null);
        setAngleNodeId(null);
        setPreviewNodeId(null);
        setRunningNodeId(null);
        deselectCanvas();
        setClearConfirmOpen(false);
        cleanupCanvasFiles({ projectId, nodes: [], chatSessions: [] });
    }, [cleanupCanvasFiles, deselectCanvas, projectId]);

    const duplicateNode = useCallback((nodeId: string) => {
        const source = nodesRef.current.find((node) => node.id === nodeId);
        if (!source) return;

        const id = `${source.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const next: CanvasNodeData = {
            ...source,
            id,
            title: `${source.title} Copy`,
            position: { x: source.position.x + 36, y: source.position.y + 36 },
        };

        setNodes((prev) => [...prev, next]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
        setDialogNodeId(id);
    }, []);

    const copySelectedNodes = useCallback(() => {
        const selectedIds = selectedNodeIdsRef.current;
        if (!selectedIds.size) return;

        const copiedNodes = nodesRef.current
            .filter((node) => selectedIds.has(node.id))
            .map((node) => ({
                ...node,
                position: { ...node.position },
                metadata: node.metadata ? { ...node.metadata } : undefined,
            }));

        if (!copiedNodes.length) return;

        clipboardRef.current = {
            nodes: copiedNodes,
            connections: connectionsRef.current.filter((connection) => selectedIds.has(connection.fromNodeId) && selectedIds.has(connection.toNodeId)).map((connection) => ({ ...connection })),
        };
    }, []);

    const pasteCopiedNodes = useCallback(() => {
        const clipboard = clipboardRef.current;
        if (!clipboard?.nodes.length) return false;

        const center = getCanvasCenter();
        const bounds = clipboard.nodes.reduce(
            (acc, node) => ({
                left: Math.min(acc.left, node.position.x),
                top: Math.min(acc.top, node.position.y),
                right: Math.max(acc.right, node.position.x + node.width),
                bottom: Math.max(acc.bottom, node.position.y + node.height),
            }),
            { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
        );
        const dx = center.x - (bounds.left + bounds.right) / 2;
        const dy = center.y - (bounds.top + bounds.bottom) / 2;
        const idMap = new Map<string, string>();
        const nextNodes = clipboard.nodes.map((node, index) => {
            const id = `${node.type}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
            idMap.set(node.id, id);
            return {
                ...node,
                id,
                title: node.title.endsWith(" Copy") ? node.title : `${node.title} Copy`,
                position: {
                    x: node.position.x + dx,
                    y: node.position.y + dy,
                },
                metadata: node.metadata ? { ...node.metadata } : undefined,
            };
        });

        const nextConnections = clipboard.connections.flatMap((connection, index) => {
            const fromNodeId = idMap.get(connection.fromNodeId);
            const toNodeId = idMap.get(connection.toNodeId);
            if (!fromNodeId || !toNodeId) return [];
            return [
                {
                    ...connection,
                    id: `conn-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
                    fromNodeId,
                    toNodeId,
                },
            ];
        });

        setNodes((prev) => [...prev, ...nextNodes]);
        setConnections((prev) => [...prev, ...nextConnections]);
        setSelectedNodeIds(new Set(nextNodes.map((node) => node.id)));
        setSelectedConnectionId(null);
        setContextMenu(null);
        setDialogNodeId(nextNodes[0]?.id || null);
        return true;
    }, [getCanvasCenter]);

    const resetViewport = useCallback(() => {
        setViewport({ x: size.width / 2, y: size.height / 2, k: 1 });
        setContextMenu(null);
    }, [size.height, size.width]);

    const setZoomScale = useCallback(
        (scale: number) => {
            const nextScale = Math.min(Math.max(scale, 0.05), 5);
            setViewport((prev) => ({
                x: size.width / 2 - ((size.width / 2 - prev.x) / prev.k) * nextScale,
                y: size.height / 2 - ((size.height / 2 - prev.y) / prev.k) * nextScale,
                k: nextScale,
            }));
            setContextMenu(null);
        },
        [size.height, size.width],
    );

    const applyHistory = useCallback((entry: CanvasHistoryEntry) => {
        if (historyCommitTimerRef.current) {
            clearTimeout(historyCommitTimerRef.current);
            historyCommitTimerRef.current = null;
        }
        applyingHistoryRef.current = true;
        setNodes(entry.nodes);
        setConnections(entry.connections);
        setGroups(entry.groups || []);
        setChatSessions(entry.chatSessions);
        setActiveChatId(entry.activeChatId);
        setBackgroundMode(entry.backgroundMode);
        setShowImageInfo(entry.showImageInfo);
        setSelectedNodeIds(new Set());
        setSelectedConnectionId(null);
        setSelectedGroupId(null);
        setContextMenu(null);
        setTimeout(() => {
            lastHistoryRef.current = entry;
            applyingHistoryRef.current = false;
            setHistoryState({ canUndo: historyRef.current.past.length > 0, canRedo: historyRef.current.future.length > 0 });
        });
    }, []);

    const undoCanvas = useCallback(() => {
        const previous = historyRef.current.past.pop();
        const current = lastHistoryRef.current;
        if (!previous || !current) return;
        historyRef.current.future.push(current);
        applyHistory(previous);
    }, [applyHistory]);

    const redoCanvas = useCallback(() => {
        const next = historyRef.current.future.pop();
        const current = lastHistoryRef.current;
        if (!next || !current) return;
        historyRef.current.past.push(current);
        applyHistory(next);
    }, [applyHistory]);

    const createAndOpenProject = useCallback(() => {
        const id = createProject(`无限画布 ${useCanvasStore.getState().projects.length + 1}`);
        router.push(`/canvas/${id}`);
    }, [createProject, router]);

    const deleteCurrentProject = useCallback(() => {
        deleteProjects([projectId]);
        cleanupAssetImages();
        router.push("/canvas");
    }, [cleanupAssetImages, deleteProjects, projectId, router]);

    const handleCanvasMouseDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            setContextMenu(null);
            if (pendingConnectionCreateRef.current) cancelPendingConnectionCreate();
            if (event.button !== 0) return;

            const world = screenToCanvas(event.clientX, event.clientY);
            const nextSelectionBox = {
                startWorldX: world.x,
                startWorldY: world.y,
                currentWorldX: world.x,
                currentWorldY: world.y,
                additive: event.shiftKey,
                initialSelectedNodeIds: event.shiftKey ? Array.from(selectedNodeIdsRef.current) : [],
            };
            selectionBoxRef.current = nextSelectionBox;
            setSelectionBox(nextSelectionBox);
            if (!event.shiftKey) {
                setSelectedNodeIds(new Set());
            }

            setSelectedConnectionId(null);
            setSelectedGroupId(null);
        },
        [cancelPendingConnectionCreate, screenToCanvas],
    );

    const handleNodeMouseDown = useCallback((event: ReactMouseEvent, nodeId: string) => {
        event.stopPropagation();
        setContextMenu(null);
        setHoveredNodeId(null);
        setToolbarNodeId(null);
        setSelectedConnectionId(null);
        setSelectedGroupId(null);

        const currentSelected = selectedNodeIdsRef.current;
        const currentNodes = nodesRef.current;
        const nextSelected = new Set(currentSelected);

        if (event.shiftKey || event.metaKey || event.ctrlKey) {
            if (nextSelected.has(nodeId)) {
                nextSelected.delete(nodeId);
            } else {
                nextSelected.add(nodeId);
            }
        } else if (!nextSelected.has(nodeId)) {
            nextSelected.clear();
            nextSelected.add(nodeId);
        }

        setSelectedNodeIds(nextSelected);
        const dragIds = new Set(nextSelected);
        currentNodes.forEach((node) => {
            if (nextSelected.has(node.id)) node.metadata?.batchChildIds?.forEach((childId) => dragIds.add(childId));
        });
        dragRef.current = {
            isDraggingNode: true,
            dragKind: "node",
            hasMoved: false,
            startX: event.clientX,
            startY: event.clientY,
            initialSelectedNodes: currentNodes.filter((node) => dragIds.has(node.id)).map((node) => ({ id: node.id, x: node.position.x, y: node.position.y })),
        };
        historyPausedRef.current = true;
        nodeDraggingRef.current = true;
        setIsNodeDragging(true);
    }, []);

    const syncMovedNodesWithGroups = useCallback((movedNodes: CanvasNodeData[]) => {
        if (!movedNodes.length) return;
        setGroups((prev) => {
            if (!prev.length) return prev;
            const movedIds = new Set(movedNodes.map((node) => node.id));
            const targetGroupByNodeId = new Map<string, string>();

            movedNodes.forEach((node) => {
                const center = { x: node.position.x + node.width / 2, y: node.position.y + node.height / 2 };
                const target = [...prev].reverse().find((group) => isPointInGroup(center, group));
                if (target) targetGroupByNodeId.set(node.id, target.id);
            });

            let changed = false;
            const next = prev
                .map((group) => {
                    const nextIds = group.nodeIds.filter((nodeId) => !movedIds.has(nodeId) || targetGroupByNodeId.get(nodeId) === group.id);
                    movedNodes.forEach((node) => {
                        if (targetGroupByNodeId.get(node.id) === group.id && !nextIds.includes(node.id)) nextIds.push(node.id);
                    });
                    if (nextIds.length !== group.nodeIds.length || nextIds.some((nodeId, index) => nodeId !== group.nodeIds[index])) changed = true;
                    return { ...group, nodeIds: nextIds };
                })
                .filter((group) => group.nodeIds.length > 0);

            if (next.length !== prev.length) changed = true;
            return changed ? next : prev;
        });
    }, []);

    const updateGroupResize = useCallback((clientX: number, clientY: number) => {
        const state = groupResizeRef.current;
        if (!state.isResizing || !state.groupId || !state.corner) return;
        const dx = (clientX - state.startX) / viewportRef.current.k;
        const dy = (clientY - state.startY) / viewportRef.current.k;
        const fromLeft = state.corner.includes("left");
        const fromTop = state.corner.includes("top");
        const minWidth = 160;
        const minHeight = 120;
        const width = Math.max(minWidth, state.initial.width + (fromLeft ? -dx : dx));
        const height = Math.max(minHeight, state.initial.height + (fromTop ? -dy : dy));
        const x = fromLeft ? state.initial.x + state.initial.width - width : state.initial.x;
        const y = fromTop ? state.initial.y + state.initial.height - height : state.initial.y;

        setGroups((prev) => prev.map((group) => (group.id === state.groupId ? { ...group, position: { x, y }, width, height } : group)));
    }, []);

    const finishGroupResize = useCallback(() => {
        if (!groupResizeRef.current.isResizing) return;
        groupResizeRef.current = {
            isResizing: false,
            groupId: undefined,
            corner: undefined,
            startX: 0,
            startY: 0,
            initial: { x: 0, y: 0, width: 0, height: 0 },
        };
        historyPausedRef.current = false;
        document.body.style.cursor = "default";
    }, []);

    const finishNodeDrag = useCallback((clientX?: number, clientY?: number) => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (!dragRef.current.isDraggingNode) return;

        const dragKind = dragRef.current.dragKind;
        const wasClick = dragKind === "node" && !dragRef.current.hasMoved && dragRef.current.initialSelectedNodes.length === 1;
        const clickedNodeId = dragRef.current.initialSelectedNodes[0]?.id;
        const currentViewport = viewportRef.current;
        const dx = clientX == null ? 0 : (clientX - dragRef.current.startX) / currentViewport.k;
        const dy = clientY == null ? 0 : (clientY - dragRef.current.startY) / currentViewport.k;
        const initialPositions = dragRef.current.initialSelectedNodes;

        historyPausedRef.current = false;
        nodeDraggingRef.current = false;
        document.body.style.cursor = "default";
        setIsNodeDragging(false);
        if (dragRef.current.hasMoved && clientX != null && clientY != null) {
            const movedNodes = initialPositions
                .map((initial) => {
                    const node = nodesRef.current.find((item) => item.id === initial.id);
                    return node ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : null;
                })
                .filter((node): node is CanvasNodeData => Boolean(node));
            setNodes((prev) =>
                prev.map((node) => {
                    const initial = initialPositions.find((item) => item.id === node.id);
                    if (!initial) return node;
                    return { ...node, position: { x: initial.x + dx, y: initial.y + dy } };
                }),
            );
            if (dragKind === "group") {
                const groupId = dragRef.current.groupId;
                const initialGroupPosition = dragRef.current.initialGroupPosition;
                if (groupId && initialGroupPosition) setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, position: { x: initialGroupPosition.x + dx, y: initialGroupPosition.y + dy } } : group)));
            } else {
                syncMovedNodesWithGroups(movedNodes);
            }
        }

        dragRef.current.isDraggingNode = false;
        dragRef.current.dragKind = "node";
        dragRef.current.hasMoved = false;
        dragRef.current.groupId = undefined;
        dragRef.current.initialGroupPosition = undefined;
        dragRef.current.initialSelectedNodes = [];
        if (wasClick && clickedNodeId) {
            setDialogNodeId(clickedNodeId);
        }
    }, [syncMovedNodesWithGroups]);

    const handleGlobalMouseMove = useCallback(
        (event: MouseEvent) => {
            const currentViewport = viewportRef.current;

            if (dragRef.current.isDraggingNode) {
                const dx = (event.clientX - dragRef.current.startX) / currentViewport.k;
                const dy = (event.clientY - dragRef.current.startY) / currentViewport.k;
                const initialPositions = dragRef.current.initialSelectedNodes;
                if (Math.abs(event.clientX - dragRef.current.startX) > 3 || Math.abs(event.clientY - dragRef.current.startY) > 3) {
                    dragRef.current.hasMoved = true;
                }

                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(() => {
                    const groupId = dragRef.current.dragKind === "group" ? dragRef.current.groupId : undefined;
                    const initialGroupPosition = dragRef.current.dragKind === "group" ? dragRef.current.initialGroupPosition : undefined;
                    setNodes((prev) =>
                        prev.map((node) => {
                            const initial = initialPositions.find((item) => item.id === node.id);
                            return initial ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : node;
                        }),
                    );
                    if (groupId && initialGroupPosition) {
                        setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, position: { x: initialGroupPosition.x + dx, y: initialGroupPosition.y + dy } } : group)));
                    }
                    rafRef.current = null;
                });
                return;
            }

            if (connectingParamsRef.current && !pendingConnectionCreateRef.current) {
                const dropTarget = getConnectionDropTarget(event.clientX, event.clientY, connectingParamsRef.current);
                connectionTargetNodeIdRef.current = dropTarget.nodeId;
                setConnectionTargetNodeId(dropTarget.nodeId);
                setMouseWorld(screenToCanvas(event.clientX, event.clientY));
            }
        },
        [finishNodeDrag, getConnectionDropTarget, screenToCanvas],
    );

    const handleGlobalPointerMove = useCallback(
        (event: PointerEvent) => {
            if (groupResizeRef.current.isResizing) {
                updateGroupResize(event.clientX, event.clientY);
                return;
            }

            if (dragRef.current.isDraggingNode) {
                const currentViewport = viewportRef.current;
                const dx = (event.clientX - dragRef.current.startX) / currentViewport.k;
                const dy = (event.clientY - dragRef.current.startY) / currentViewport.k;
                const initialPositions = dragRef.current.initialSelectedNodes;
                if (Math.abs(event.clientX - dragRef.current.startX) > 3 || Math.abs(event.clientY - dragRef.current.startY) > 3) {
                    dragRef.current.hasMoved = true;
                }

                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(() => {
                    const groupId = dragRef.current.dragKind === "group" ? dragRef.current.groupId : undefined;
                    const initialGroupPosition = dragRef.current.dragKind === "group" ? dragRef.current.initialGroupPosition : undefined;
                    setNodes((prev) =>
                        prev.map((node) => {
                            const initial = initialPositions.find((item) => item.id === node.id);
                            return initial ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : node;
                        }),
                    );
                    if (groupId && initialGroupPosition) {
                        setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, position: { x: initialGroupPosition.x + dx, y: initialGroupPosition.y + dy } } : group)));
                    }
                    rafRef.current = null;
                });
                return;
            }

            const currentSelection = selectionBoxRef.current;
            if (!currentSelection) return;

            if (event.buttons === 0) {
                selectionBoxRef.current = null;
                setSelectionBox(null);
                return;
            }

            const world = screenToCanvas(event.clientX, event.clientY);
            const rectX = Math.min(currentSelection.startWorldX, world.x);
            const rectY = Math.min(currentSelection.startWorldY, world.y);
            const rectW = Math.abs(world.x - currentSelection.startWorldX);
            const rectH = Math.abs(world.y - currentSelection.startWorldY);
            const nextSelected = new Set<string>(currentSelection.additive ? currentSelection.initialSelectedNodeIds : []);

            nodesRef.current
                .filter((node) => !isHiddenBatchChild(node, nodesRef.current))
                .forEach((node) => {
                    const intersects = rectX < node.position.x + node.width && rectX + rectW > node.position.x && rectY < node.position.y + node.height && rectY + rectH > node.position.y;

                    if (intersects) nextSelected.add(node.id);
                });

            const nextSelectionBox = { ...currentSelection, currentWorldX: world.x, currentWorldY: world.y };
            selectionBoxRef.current = nextSelectionBox;
            setSelectionBox(nextSelectionBox);
            setSelectedNodeIds(nextSelected);
        },
        [screenToCanvas, updateGroupResize],
    );

    const handleGlobalMouseUp = useCallback(
        (event: MouseEvent) => {
            finishNodeDrag(event.clientX, event.clientY);
            updateGroupResize(event.clientX, event.clientY);
            finishGroupResize();

            selectionBoxRef.current = null;
            setSelectionBox(null);

            if (pendingConnectionCreateRef.current) return;

            const currentConnection = connectingParamsRef.current;
            if (currentConnection) {
                const dropTarget = getConnectionDropTarget(event.clientX, event.clientY, currentConnection);
                if (dropTarget.nodeId) {
                    connectNodes(currentConnection, dropTarget.nodeId);
                    setConnecting(null);
                } else if (dropTarget.isNearNode) {
                    setConnecting(null);
                } else {
                    setMouseWorld(screenToCanvas(event.clientX, event.clientY));
                    setPendingConnectionCreate({ connection: currentConnection, position: screenToCanvas(event.clientX, event.clientY) });
                }
            }
        },
        [connectNodes, finishGroupResize, finishNodeDrag, getConnectionDropTarget, screenToCanvas, setConnecting, updateGroupResize],
    );

    useEffect(() => {
        const handlePointerUp = (event: PointerEvent) => {
            finishNodeDrag(event.clientX, event.clientY);
            updateGroupResize(event.clientX, event.clientY);
            finishGroupResize();
        };
        const cancelNodeDrag = () => {
            finishNodeDrag();
            finishGroupResize();
        };
        window.addEventListener("mousemove", handleGlobalMouseMove);
        window.addEventListener("mouseup", handleGlobalMouseUp);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", cancelNodeDrag);
        window.addEventListener("blur", cancelNodeDrag);
        window.addEventListener("pointermove", handleGlobalPointerMove);
        return () => {
            window.removeEventListener("mousemove", handleGlobalMouseMove);
            window.removeEventListener("mouseup", handleGlobalMouseUp);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", cancelNodeDrag);
            window.removeEventListener("blur", cancelNodeDrag);
            window.removeEventListener("pointermove", handleGlobalPointerMove);
        };
    }, [finishGroupResize, finishNodeDrag, handleGlobalMouseMove, handleGlobalMouseUp, handleGlobalPointerMove, updateGroupResize]);

    const createImageFileNode = useCallback(async (file: File, position: Position) => {
        const image = await uploadImage(file);
        const size = fitNodeSize(image.width, image.height);
        const id = `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newNode: CanvasNodeData = {
            id,
            type: CanvasNodeType.Image,
            title: file.name,
            position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
            width: size.width,
            height: size.height,
            metadata: imageMetadata(image),
        };

        setNodes((prev) => [...prev, newNode]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
        setDialogNodeId(id);

        // 自动保存到素材库
        addAsset({
            kind: "image",
            title: file.name,
            coverUrl: image.url,
            tags: [],
            source: "上传",
            data: {
                dataUrl: image.storageKey ? "" : image.url,
                storageKey: image.storageKey,
                width: image.width,
                height: image.height,
                bytes: image.bytes,
                mimeType: image.mimeType,
            },
            metadata: { source: "upload", nodeId: id },
        });
    }, [addAsset]);

    const createVideoFileNode = useCallback(async (file: File, position: Position) => {
        const video = await uploadMediaFile(file, "video");
        const size = fitNodeSize(video.width || 1280, video.height || 720, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
        const id = `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setNodes((prev) => [
            ...prev,
            {
                id,
                type: CanvasNodeType.Video,
                title: file.name,
                position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
                width: size.width,
                height: size.height,
                metadata: videoMetadata(video),
            },
        ]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
        setDialogNodeId(id);

        // 自动保存到素材库
        addAsset({
            kind: "video",
            title: file.name,
            coverUrl: "",
            tags: [],
            source: "上传",
            data: {
                url: video.url,
                storageKey: video.storageKey,
                width: video.width || 1280,
                height: video.height || 720,
                bytes: video.bytes || 0,
                mimeType: video.mimeType || "video/mp4",
            },
            metadata: { source: "upload", nodeId: id },
        });
    }, [addAsset]);

    const createAudioFileNode = useCallback(async (file: File, position: Position) => {
        const audio = await uploadMediaFile(file, "audio");
        const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
        const id = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setNodes((prev) => [
            ...prev,
            {
                id,
                type: CanvasNodeType.Audio,
                title: file.name,
                position: { x: position.x - spec.width / 2, y: position.y - spec.height / 2 },
                width: spec.width,
                height: spec.height,
                metadata: audioMetadata(audio),
            },
        ]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);

        // 自动保存到素材库（音频暂不保存，因为素材库目前只支持 text/image/video）
        // 如需支持音频，需要先扩展 AssetKind 类型
    }, []);

    const createTextNodeFromClipboard = useCallback(
        (text: string) => {
            const trimmed = text.trim();
            if (!trimmed) return false;

            const node = {
                ...createCanvasNode(CanvasNodeType.Text, getCanvasCenter(), { content: trimmed, status: NODE_STATUS_SUCCESS }),
                title: trimmed.slice(0, 32) || "剪切板文本",
            };

            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([node.id]));
            setSelectedConnectionId(null);
            setContextMenu(null);
            setDialogNodeId(node.id);
            return true;
        },
        [getCanvasCenter],
    );

    const pasteSystemClipboard = useCallback(async () => {
        if (!navigator.clipboard) return;

        const items = await navigator.clipboard.read();
        const imageItem = items.find((item) => item.types.some((type) => type.startsWith("image/")));
        if (imageItem) {
            const imageType = imageItem.types.find((type) => type.startsWith("image/"));
            if (!imageType) return;
            const blob = await imageItem.getType(imageType);
            const file = new File([blob], "clipboard-image.png", { type: imageType });
            void createImageFileNode(file, getCanvasCenter());
            message.success("已从剪切板添加图片");
            return;
        }

        const text = await navigator.clipboard.readText();
        if (createTextNodeFromClipboard(text)) message.success("已从剪切板添加文本");
    }, [createImageFileNode, createTextNodeFromClipboard, getCanvasCenter, message]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target instanceof Element ? event.target : null;
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || target?.closest("[contenteditable='true'],[data-canvas-no-zoom]")) return;

            const key = event.key.toLowerCase();
            const isModifierShortcut = event.metaKey || event.ctrlKey;

            if (isModifierShortcut && !event.altKey && key === "z") {
                event.preventDefault();
                if (event.shiftKey) redoCanvas();
                else undoCanvas();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "y") {
                event.preventDefault();
                redoCanvas();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "a") {
                event.preventDefault();
                setSelectedNodeIds(new Set(nodesRef.current.map((node) => node.id)));
                setSelectedConnectionId(null);
                setContextMenu(null);
                setSelectionBox(null);
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "c") {
                event.preventDefault();
                copySelectedNodes();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "v") {
                event.preventDefault();
                if (!pasteCopiedNodes()) void pasteSystemClipboard();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "g") {
                event.preventDefault();
                if (event.shiftKey && selectedGroupIdRef.current) ungroup(selectedGroupIdRef.current);
                else createGroupFromSelection();
                return;
            }

            if (event.key === "Delete" || event.key === "Backspace") {
                if (selectedNodeIdsRef.current.size) {
                    deleteNodes(new Set(selectedNodeIdsRef.current));
                } else if (selectedGroupIdRef.current) {
                    ungroup(selectedGroupIdRef.current);
                } else if (selectedConnectionId) {
                    deleteConnection(selectedConnectionId);
                }
            }

            if (event.key === "Escape") {
                setSelectedNodeIds(new Set());
                setSelectedConnectionId(null);
                setSelectedGroupId(null);
                setContextMenu(null);
                setSelectionBox(null);
                setConnecting(null);
                setHoveredNodeId(null);
                setToolbarNodeId(null);
                setDialogNodeId(null);
                setEditingNodeId(null);
                setInfoNodeId(null);
                setCropNodeId(null);
                setMaskEditNodeId(null);
                setPendingConnectionCreate(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [copySelectedNodes, createGroupFromSelection, deleteConnection, deleteNodes, pasteCopiedNodes, pasteSystemClipboard, redoCanvas, selectedConnectionId, setConnecting, undoCanvas, ungroup]);

    const handleConnectStart = useCallback(
        (event: ReactMouseEvent, nodeId: string, handleType: "source" | "target") => {
            event.stopPropagation();
            setMouseWorld(screenToCanvas(event.clientX, event.clientY));
            setConnecting({ nodeId, handleType });
            connectionTargetNodeIdRef.current = null;
            setConnectionTargetNodeId(null);
            setSelectedConnectionId(null);
        },
        [screenToCanvas, setConnecting],
    );

    const handleNodeResize = useCallback((nodeId: string, width: number, height: number, position?: Position) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, width, height, position: position || node.position } : node)));
    }, []);

    const renameNode = useCallback((nodeId: string, title: string) => {
        const nextTitle = title.trim();
        if (!nextTitle) return;
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, title: nextTitle } : node)));
    }, []);

    const toggleNodeFreeResize = useCallback((nodeId: string) => {
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== nodeId) return node;
                const freeResize = !node.metadata?.freeResize;
                if (freeResize || node.type !== CanvasNodeType.Image) return { ...node, metadata: { ...node.metadata, freeResize } };
                const ratio = (node.metadata?.naturalWidth || node.width) / (node.metadata?.naturalHeight || node.height || 1);
                const height = node.width / ratio;
                return { ...node, height, position: { x: node.position.x, y: node.position.y + node.height / 2 - height / 2 }, metadata: { ...node.metadata, freeResize } };
            }),
        );
    }, []);

    const handleNodeContentChange = useCallback((nodeId: string, content: string) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, content, status: content.trim() ? NODE_STATUS_SUCCESS : undefined } } : node)));
    }, []);

    const toggleBatchExpanded = useCallback((nodeId: string) => {
        const isExpanded = Boolean(nodesRef.current.find((node) => node.id === nodeId)?.metadata?.imageBatchExpanded);
        if (isExpanded) {
            setCollapsingBatchIds((prev) => new Set(prev).add(nodeId));
            window.setTimeout(() => {
                setCollapsingBatchIds((prev) => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                });
            }, 320);
        } else {
            setOpeningBatchIds((prev) => new Set(prev).add(nodeId));
            window.setTimeout(() => {
                setOpeningBatchIds((prev) => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                });
            }, 260);
        }
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== nodeId) return node;
                return { ...node, metadata: { ...node.metadata, imageBatchExpanded: !node.metadata?.imageBatchExpanded } };
            }),
        );
    }, []);

    const setBatchPrimary = useCallback((child: CanvasNodeData) => {
        const rootId = child.metadata?.batchRootId;
        if (!rootId || !child.metadata?.content) return;
        setNodes((prev) =>
            prev.map((node) =>
                node.id === rootId
                    ? {
                          ...node,
                          width: child.width,
                          height: child.height,
                          metadata: {
                              ...node.metadata,
                              content: child.metadata?.content,
                              primaryImageId: child.id,
                              naturalWidth: child.metadata?.naturalWidth,
                              naturalHeight: child.metadata?.naturalHeight,
                              freeResize: child.metadata?.freeResize,
                          },
                      }
                    : node,
            ),
        );
    }, []);

    const openTextEditor = useCallback((node: CanvasNodeData) => {
        if (node.type !== CanvasNodeType.Text) return;
        setSelectedNodeIds(new Set([node.id]));
        setSelectedConnectionId(null);
        setDialogNodeId(node.id);
        setEditingNodeId(node.id);
        setEditRequestNonce((value) => value + 1);
    }, []);

    const handleNodePromptChange = useCallback((nodeId: string, prompt: string) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, prompt } } : node)));
    }, []);

    const handleConfigNodeChange = useCallback((nodeId: string, patch: Partial<CanvasNodeData["metadata"]>) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? applyNodeConfigPatch(node, patch) : node)));
    }, []);

    const downloadNodeImage = useCallback((node: CanvasNodeData) => {
        if ((node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video && node.type !== CanvasNodeType.Audio) || !node.metadata?.content) return;
        saveAs(node.metadata.content, `canvas-${node.type}-${node.id}.${node.type === CanvasNodeType.Video ? "mp4" : node.type === CanvasNodeType.Audio ? audioExtension(node.metadata.mimeType) : imageExtension(node.metadata.content)}`);
    }, []);

    const saveNodeAsset = useCallback(
        async (node: CanvasNodeData) => {
            if (node.type === CanvasNodeType.Text || isAgentNode(node)) {
                const content = node.metadata?.content?.trim();
                if (!content) return message.error("没有可保存的文本");
                addAsset({ kind: "text", title: node.metadata?.prompt?.slice(0, 24) || "画布文本", coverUrl: "", tags: [], source: "Canvas", data: { content }, metadata: { source: "canvas", nodeId: node.id } });
                message.success("已加入我的素材");
                return;
            }
            if (node.type === CanvasNodeType.Video) {
                if (!node.metadata?.content) return message.error("没有可保存的视频");
                addAsset({ kind: "video", title: node.metadata?.prompt?.slice(0, 24) || "画布视频", coverUrl: "", tags: [], source: "Canvas", data: { url: node.metadata.content, storageKey: node.metadata.storageKey, width: node.width, height: node.height, bytes: node.metadata.bytes || 0, mimeType: node.metadata.mimeType || "video/mp4" }, metadata: { source: "canvas", nodeId: node.id, prompt: node.metadata?.prompt } });
                message.success("已加入我的素材");
                return;
            }
            if (!node.metadata?.content) return message.error("没有可保存的图片");
            const dataUrl = node.metadata.storageKey ? "" : node.metadata.content;
            addAsset({
                kind: "image",
                title: node.metadata?.prompt?.slice(0, 24) || "画布图片",
                coverUrl: node.metadata.content,
                tags: [],
                source: "Canvas",
                data: {
                    dataUrl,
                    storageKey: node.metadata.storageKey,
                    width: node.metadata.naturalWidth || node.width,
                    height: node.metadata.naturalHeight || node.height,
                    bytes: node.metadata.bytes || getDataUrlByteSize(dataUrl),
                    mimeType: node.metadata.mimeType || "image/png",
                },
                metadata: { source: "canvas", nodeId: node.id, prompt: node.metadata?.prompt },
            });
            message.success("已加入我的素材");
        },
        [addAsset, message],
    );

    const saveSelectedNodesAsAssets = useCallback(() => {
        const selected = nodesRef.current.filter((node) => selectedNodeIdsRef.current.has(node.id));
        if (!selected.length) return;
        selected.forEach((node) => void saveNodeAsset(node));
    }, [saveNodeAsset]);

    const duplicateSelectedNodes = useCallback(() => {
        copySelectedNodes();
        if (!pasteCopiedNodes()) message.warning("没有可复制的节点");
    }, [copySelectedNodes, message, pasteCopiedNodes]);

    const downloadGroupMedia = useCallback(
        (groupId: string) => {
            const group = groupsRef.current.find((item) => item.id === groupId);
            if (!group) return;
            const groupIds = new Set(group.nodeIds);
            const mediaNodes = nodesRef.current.filter((node) => groupIds.has(node.id) && (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Video || node.type === CanvasNodeType.Audio) && node.metadata?.content);
            if (!mediaNodes.length) {
                message.warning("分组内没有可下载的媒体");
                return;
            }
            mediaNodes.forEach(downloadNodeImage);
        },
        [downloadNodeImage, message],
    );

    const createImageReversePromptNodes = useCallback(
        (node: CanvasNodeData) => {
            if (node.type !== CanvasNodeType.Image || !node.metadata?.content) {
                message.warning("图片节点为空，无法反推提示词");
                return;
            }

            const gap = 96;
            const textSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Text];
            const configSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Config];
            const centerY = node.position.y + node.height / 2;
            const textNode = {
                ...createCanvasNode(
                    CanvasNodeType.Text,
                    { x: node.position.x + node.width + gap + textSpec.width / 2, y: centerY },
                    { content: IMAGE_PROMPT_REVERSE_PRESET, prompt: IMAGE_PROMPT_REVERSE_PRESET, status: NODE_STATUS_SUCCESS, fontSize: 14 },
                ),
                title: "反推提示词",
            };
            const configNode = {
                ...createCanvasNode(
                    CanvasNodeType.Config,
                    { x: textNode.position.x + textNode.width + gap + configSpec.width / 2, y: centerY },
                    {
                        generationMode: "text",
                        model: effectiveConfig.textModel || effectiveConfig.model || defaultConfig.textModel,
                        count: 1,
                        prompt: "参考图片：图片1\n任务说明：文本1",
                    },
                ),
                title: "反推提示词配置",
            };

            setNodes((prev) => [...prev, textNode, configNode]);
            setConnections((prev) => [
                ...prev,
                { id: nanoid(), fromNodeId: node.id, toNodeId: configNode.id },
                { id: nanoid(), fromNodeId: textNode.id, toNodeId: configNode.id },
            ]);
            setSelectedNodeIds(new Set([configNode.id]));
            setSelectedConnectionId(null);
            setDialogNodeId(configNode.id);
            setContextMenu(null);
        },
        [effectiveConfig.model, effectiveConfig.textModel, message],
    );

    const cropImageNode = useCallback(async (node: CanvasNodeData, crop: CanvasImageCropRect) => {
        if (!node.metadata?.content) return;
        const cropped = await cropDataUrl(node.metadata.content, crop);
        const image = await uploadImage(cropped);
        const width = Math.min(node.width, Math.max(220, image.width));
        const childId = nanoid();
        const child: CanvasNodeData = {
            id: childId,
            type: CanvasNodeType.Image,
            title: "Cropped Image",
            position: { x: node.position.x + node.width + 96, y: node.position.y },
            width,
            height: width * (image.height / image.width),
            metadata: {
                ...imageMetadata(image),
                prompt: node.metadata?.prompt,
            },
        };
        setNodes((prev) => [...prev, child]);
        setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
        setSelectedNodeIds(new Set([childId]));
        setDialogNodeId(childId);
        setCropNodeId(null);
    }, []);

    const maskEditImageNode = useCallback(
        async (node: CanvasNodeData, payload: CanvasImageMaskEditPayload) => {
            if (!node.metadata?.content) return;
            const generationConfig = { ...buildGenerationConfig(effectiveConfig, node, "image"), count: "1", size: node.metadata?.size || "auto" };
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }
            const userPrompt = payload.prompt.trim();
            const prompt = `只修改蒙版透明区域，其他区域保持不变。${userPrompt}`;
            const childId = nanoid();
            const source = { id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: node.metadata.content, storageKey: node.metadata.storageKey };
            const generationMetadata = buildImageGenerationMetadata("edit", generationConfig, 1, [source]);
            setMaskEditNodeId(null);
            setRunningNodeId(childId);
            setNodes((prev) => [
                ...prev,
                {
                    id: childId,
                    type: CanvasNodeType.Image,
                    title: userPrompt.slice(0, 32) || "局部编辑结果",
                    position: { x: node.position.x + node.width + 96, y: node.position.y },
                    width: node.width,
                    height: node.height,
                    metadata: { prompt, status: NODE_STATUS_LOADING, ...generationMetadata },
                },
            ]);
            setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
            setSelectedNodeIds(new Set([childId]));
            setSelectedConnectionId(null);
            setDialogNodeId(childId);
            try {
                const image = await requestEdit(generationConfig, prompt, [source], { id: `${node.id}-mask`, name: "mask.png", type: "image/png", dataUrl: payload.maskDataUrl }).then((items) => items[0]);
                const uploaded = await uploadImage(image.dataUrl);
                const size = fitNodeSize(uploaded.width, uploaded.height, node.width, node.height);
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, width: size.width, height: size.height, metadata: { ...item.metadata, ...imageMetadata(uploaded), prompt, ...generationMetadata } } : item)));
            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : "局部修改失败";
                message.error(errorDetails);
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            } finally {
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, isAiConfigReady, message, openConfigDialog],
    );

    const upscaleImageNode = useCallback(async (node: CanvasNodeData, params: CanvasImageUpscaleParams) => {
        if (!node.metadata?.content) return;
        setUpscaleNodeId(null);
        const upscaled = await upscaleDataUrl(node.metadata.content, params);
        const image = await uploadImage(upscaled);
        const size = fitNodeSize(image.width, image.height);
        const childId = nanoid();
        const child: CanvasNodeData = {
            id: childId,
            type: CanvasNodeType.Image,
            title: "Upscaled Image",
            position: { x: node.position.x + node.width + 96, y: node.position.y },
            width: size.width,
            height: size.height,
            metadata: {
                ...imageMetadata(image),
                prompt: node.metadata?.prompt,
            },
        };
        setNodes((prev) => [...prev, child]);
        setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
        setSelectedNodeIds(new Set([childId]));
        setDialogNodeId(childId);
    }, []);

    const generateAngleNode = useCallback(
        async (node: CanvasNodeData, params: CanvasImageAngleParams) => {
            if (!node.metadata?.content) return;
            const generationConfig = { ...buildGenerationConfig(effectiveConfig, node, "image"), count: "1" };
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }
            const childId = nanoid();
            const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
            const title = buildAngleLabel(params);
            const prompt = buildAnglePrompt(params);
            const generationMetadata = buildImageGenerationMetadata("edit", generationConfig, 1, [
                { id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: node.metadata.content, storageKey: node.metadata.storageKey },
            ]);
            setAngleNodeId(null);
            setRunningNodeId(childId);
            setNodes((prev) => [
                ...prev,
                {
                    id: childId,
                    type: CanvasNodeType.Image,
                    title,
                    position: { x: node.position.x + node.width + 96, y: node.position.y },
                    width: imageConfig.width,
                    height: imageConfig.height,
                    metadata: { prompt, status: NODE_STATUS_LOADING, ...generationMetadata },
                },
            ]);
            setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
            setSelectedNodeIds(new Set([childId]));
            setDialogNodeId(childId);
            try {
                const image = await requestEdit(generationConfig, prompt, [{ id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: node.metadata.content, storageKey: node.metadata.storageKey }]).then(
                    (items) => items[0],
                );
                const uploaded = await uploadImage(image.dataUrl);
                const size = fitNodeSize(uploaded.width, uploaded.height, imageConfig.width, imageConfig.height);
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, width: size.width, height: size.height, metadata: { ...item.metadata, ...imageMetadata(uploaded), prompt, ...generationMetadata } } : item)));
            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            } finally {
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, openConfigDialog],
    );

    const handleFontSizeChange = useCallback((nodeId: string, fontSize: number) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, fontSize } } : node)));
    }, []);

    const selectTextMode = useCallback((node: CanvasNodeData, textMode: CanvasTextMode) => {
        if (textMode === "imagePrompt" || textMode === "videoPrompt") {
            const targetType = textMode === "imagePrompt" ? CanvasNodeType.Image : CanvasNodeType.Video;
            const hasUpstream = connectionsRef.current.some((connection) => {
                if (connection.toNodeId !== node.id) return false;
                return nodesRef.current.find((item) => item.id === connection.fromNodeId)?.type === targetType;
            });
            if (!hasUpstream) {
                const spec = NODE_DEFAULT_SIZE[targetType];
                const referenceNode = createCanvasNode(targetType, { x: node.position.x - spec.width / 2 - 96, y: node.position.y + node.height / 2 }, {});
                referenceNode.title = targetType === CanvasNodeType.Image ? "上游图片" : "上游视频";
                referenceNode.position = { x: node.position.x - spec.width - 96, y: node.position.y + node.height / 2 - spec.height / 2 };
                setNodes((prev) => [...prev, referenceNode]);
                setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: referenceNode.id, toNodeId: node.id }]);
            }
        }
        setNodes((prev) =>
            prev.map((item) => {
                if (item.id !== node.id) return item;
                const currentPrompt = item.metadata?.prompt || "";
                const previousDefault = defaultTextModePrompt(item.metadata?.textMode);
                const prompt = !currentPrompt || currentPrompt === previousDefault ? defaultTextModePrompt(textMode) : currentPrompt;
                return { ...item, metadata: { ...item.metadata, textMode, prompt, content: textMode === "write" ? item.metadata?.content : undefined, status: undefined } };
            }),
        );
        setDialogNodeId(node.id);
        setSelectedNodeIds(new Set([node.id]));
        setSelectedConnectionId(null);
        if (textMode === "write") {
            setEditingNodeId(node.id);
            setEditRequestNonce((value) => value + 1);
        }
    }, []);

    const toggleTextExpanded = useCallback((node: CanvasNodeData) => {
        const nextExpanded = !node.metadata?.textExpanded;
        const minHeight = NODE_DEFAULT_SIZE[CanvasNodeType.Text].height;
        const expandedHeight = 420;
        setNodes((prev) =>
            prev.map((item) =>
                item.id === node.id
                    ? {
                          ...item,
                          height: nextExpanded ? Math.max(item.height, expandedHeight) : Math.min(item.height, minHeight),
                          metadata: { ...item.metadata, textExpanded: nextExpanded },
                      }
                    : item,
            ),
        );
    }, []);

    const handleUploadRequest = useCallback((nodeId?: string, position?: Position) => {
        uploadTargetRef.current = { nodeId, position };
        imageInputRef.current?.click();
    }, []);

    const handleImageInputChange = useCallback(
        async (event: ReactChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            const target = uploadTargetRef.current;
            if (!file || (!file.type.startsWith("image/") && !file.type.startsWith("video/") && !isAudioFile(file))) return;

            if (target?.nodeId) {
                if (isAudioFile(file)) {
                    const audio = await uploadMediaFile(file, "audio");
                    const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
                    setNodes((prev) => prev.map((node) => (node.id === target.nodeId ? { ...node, type: CanvasNodeType.Audio, title: file.name, position: { x: node.position.x + node.width / 2 - spec.width / 2, y: node.position.y + node.height / 2 - spec.height / 2 }, width: spec.width, height: spec.height, metadata: { ...node.metadata, ...audioMetadata(audio), errorDetails: undefined } } : node)));
                    setSelectedNodeIds(new Set([target.nodeId]));
                    setSelectedConnectionId(null);
                    uploadTargetRef.current = null;
                    event.target.value = "";
                    return;
                }
                if (file.type.startsWith("video/")) {
                    const video = await uploadMediaFile(file, "video");
                    const nextSize = fitNodeSize(video.width || 1280, video.height || 720, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                    setNodes((prev) => prev.map((node) => (node.id === target.nodeId ? { ...node, type: CanvasNodeType.Video, title: file.name, position: { x: node.position.x + node.width / 2 - nextSize.width / 2, y: node.position.y + node.height / 2 - nextSize.height / 2 }, width: nextSize.width, height: nextSize.height, metadata: { ...node.metadata, ...videoMetadata(video), errorDetails: undefined } } : node)));
                    setSelectedNodeIds(new Set([target.nodeId]));
                    setSelectedConnectionId(null);
                    setDialogNodeId(target.nodeId);
                    uploadTargetRef.current = null;
                    event.target.value = "";
                    return;
                }
                const image = await uploadImage(file);
                const size = fitNodeSize(image.width, image.height);
                setNodes((prev) =>
                    prev.map((node) =>
                        node.id === target.nodeId
                            ? {
                                  ...node,
                                  type: CanvasNodeType.Image,
                                  title: file.name,
                                  width: size.width,
                                  height: size.height,
                                  metadata: {
                                      ...node.metadata,
                                      ...imageMetadata(image),
                                      errorDetails: undefined,
                                      freeResize: false,
                                      isBatchRoot: undefined,
                                      batchRootId: undefined,
                                      batchChildIds: undefined,
                                      batchUsesReferenceImages: undefined,
                                      generationType: undefined,
                                      model: undefined,
                                      size: undefined,
                                      quality: undefined,
                                      count: undefined,
                                      references: undefined,
                                      primaryImageId: undefined,
                                      imageBatchExpanded: undefined,
                                  },
                              }
                            : node,
                    ),
                );
                setSelectedNodeIds(new Set([target.nodeId]));
                setSelectedConnectionId(null);
                setDialogNodeId(target.nodeId);
            } else {
                const position = target?.position || screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
                void (isAudioFile(file) ? createAudioFileNode(file, position) : file.type.startsWith("video/") ? createVideoFileNode(file, position) : createImageFileNode(file, position));
            }

            uploadTargetRef.current = null;
            event.target.value = "";
        },
        [createAudioFileNode, createImageFileNode, createVideoFileNode, screenToCanvas, size.height, size.width],
    );

    const addReferenceNodeToText = useCallback((textNodeId: string, referenceNode: CanvasNodeData) => {
        setNodes((prev) => [...prev, referenceNode]);
        setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: referenceNode.id, toNodeId: textNodeId }]);
        setSelectedNodeIds(new Set([textNodeId]));
        setSelectedConnectionId(null);
        setDialogNodeId(textNodeId);
    }, []);

    const uploadTextReference = useCallback(
        async (textNodeId: string, file: File, kind: "image" | "video") => {
            const textNode = nodesRef.current.find((node) => node.id === textNodeId);
            if (!textNode) return;
            const basePosition = { x: textNode.position.x - 420, y: textNode.position.y };
            if (kind === "image") {
                if (!file.type.startsWith("image/")) {
                    message.warning("请上传图片文件");
                    return;
                }
                const image = await uploadImage(file);
                const nodeSize = fitNodeSize(image.width, image.height);
                addReferenceNodeToText(textNodeId, {
                    id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    type: CanvasNodeType.Image,
                    title: file.name,
                    position: { x: basePosition.x, y: basePosition.y + textNode.height / 2 - nodeSize.height / 2 },
                    width: nodeSize.width,
                    height: nodeSize.height,
                    metadata: imageMetadata(image),
                });
                return;
            }
            if (!file.type.startsWith("video/")) {
                message.warning("请上传视频文件");
                return;
            }
            const video = await uploadMediaFile(file, "video");
            const nodeSize = fitNodeSize(video.width || 1280, video.height || 720, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
            addReferenceNodeToText(textNodeId, {
                id: `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: CanvasNodeType.Video,
                title: file.name,
                position: { x: basePosition.x, y: basePosition.y + textNode.height / 2 - nodeSize.height / 2 },
                width: nodeSize.width,
                height: nodeSize.height,
                metadata: videoMetadata(video),
            });
        },
        [addReferenceNodeToText, message],
    );

    const insertTextReferenceAsset = useCallback(
        async (textNodeId: string, payload: InsertAssetPayload) => {
            const textNode = nodesRef.current.find((node) => node.id === textNodeId);
            if (!textNode) return;
            const basePosition = { x: textNode.position.x - 420, y: textNode.position.y };
            if (payload.kind === "text") {
                const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Text];
                addReferenceNodeToText(textNodeId, {
                    id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    type: CanvasNodeType.Text,
                    title: payload.title,
                    position: { x: basePosition.x, y: basePosition.y + textNode.height / 2 - spec.height / 2 },
                    width: spec.width,
                    height: spec.height,
                    metadata: { content: payload.content, status: NODE_STATUS_SUCCESS },
                });
                return;
            }
            if (payload.kind === "image") {
                const content = payload.storageKey ? await resolveImageUrl(payload.storageKey, payload.dataUrl) : payload.dataUrl;
                if (!content) return;
                const meta = await readImageMeta(content).catch(() => ({ width: 1024, height: 1024, mimeType: "image/png" }));
                const nodeSize = fitNodeSize(meta.width, meta.height);
                addReferenceNodeToText(textNodeId, {
                    id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    type: CanvasNodeType.Image,
                    title: payload.title,
                    position: { x: basePosition.x, y: basePosition.y + textNode.height / 2 - nodeSize.height / 2 },
                    width: nodeSize.width,
                    height: nodeSize.height,
                    metadata: { content, storageKey: payload.storageKey, status: NODE_STATUS_SUCCESS, naturalWidth: meta.width, naturalHeight: meta.height, mimeType: meta.mimeType || "image/png" },
                });
                return;
            }
            const nodeSize = fitNodeSize(payload.width || 1280, payload.height || 720, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
            addReferenceNodeToText(textNodeId, {
                id: `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: CanvasNodeType.Video,
                title: payload.title,
                position: { x: basePosition.x, y: basePosition.y + textNode.height / 2 - nodeSize.height / 2 },
                width: nodeSize.width,
                height: nodeSize.height,
                metadata: { content: payload.url, storageKey: payload.storageKey, status: NODE_STATUS_SUCCESS, naturalWidth: payload.width, naturalHeight: payload.height, mimeType: "video/mp4" },
            });
        },
        [addReferenceNodeToText],
    );

    const handleDrop = useCallback(
        (event: ReactDragEvent<HTMLDivElement>) => {
            event.preventDefault();
            const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/") || item.type.startsWith("video/") || isAudioFile(item));
            if (!file) return;

            const pos = screenToCanvas(event.clientX, event.clientY);
            void (isAudioFile(file) ? createAudioFileNode(file, pos) : file.type.startsWith("video/") ? createVideoFileNode(file, pos) : createImageFileNode(file, pos));
        },
        [createAudioFileNode, createImageFileNode, createVideoFileNode, screenToCanvas],
    );

    const pasteAssistantImage = useCallback(
        (file: File) => {
            const position = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
            void createImageFileNode(file, position);
            message.success("已从剪切板添加图片");
        },
        [createImageFileNode, message, screenToCanvas, size.height, size.width],
    );

    const handleAssistantSessionsChange = useCallback((sessions: CanvasAssistantSession[], activeId: string | null) => {
        setChatSessions(sessions);
        setActiveChatId(activeId);
    }, []);

    const startTitleEditing = useCallback(() => {
        setTitleDraft(currentProject?.title || "未命名画布");
        setTitleEditing(true);
    }, [currentProject?.title]);

    const finishTitleEditing = useCallback(() => {
        const nextTitle = titleDraft.trim();
        if (nextTitle) renameProject(projectId, nextTitle);
        setTitleEditing(false);
    }, [projectId, renameProject, titleDraft]);

    const openCanvasCreateMenu = useCallback(
        (event: ReactMouseEvent) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            if (target?.closest("[data-node-id],[data-connection-id],[data-canvas-no-zoom]")) return;
            event.preventDefault();
            setContextMenu(null);
            setSelectedNodeIds(new Set());
            setSelectedConnectionId(null);
            setSelectedGroupId(null);
            setPendingConnectionCreate({ position: screenToCanvas(event.clientX, event.clientY) });
        },
        [screenToCanvas],
    );

    const preventCanvasContextMenu = useCallback((event: ReactMouseEvent) => {
        if ((event.target as HTMLElement).closest("[data-node-id],[data-connection-id],[data-canvas-no-zoom]")) return;
        event.preventDefault();
        openCanvasCreateMenu(event);
    }, [openCanvasCreateMenu]);

    const handleCanvasDoubleClick = useCallback((event: ReactMouseEvent) => {
        openCanvasCreateMenu(event);
    }, [openCanvasCreateMenu]);

    const handleGenerateNode = useCallback(
        async (nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => {
            const sourceNode = nodesRef.current.find((node) => node.id === nodeId);
            const generationConfig = buildGenerationConfig(effectiveConfig, sourceNode, mode);
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }

            setRunningNodeId(nodeId);
            const sourceTextContent = sourceNode?.type === CanvasNodeType.Text ? sourceNode.metadata?.content?.trim() || "" : "";
            const editingTextNode = mode === "text" && Boolean(sourceTextContent);
            const textMode = sourceNode?.type === CanvasNodeType.Text ? sourceNode.metadata?.textMode || "write" : undefined;
            const submittedPrompt = mode === "text" ? buildTextModePrompt(textMode, prompt) : prompt;
            const generationContext = await hydrateNodeGenerationContext(
                buildNodeGenerationContext(nodeId, nodesRef.current, connectionsRef.current, editingTextNode ? `请根据要求修改以下文本。\n\n原文：\n${sourceTextContent}\n\n修改要求：\n${submittedPrompt}` : submittedPrompt),
            );
            const selectedStyle = mode === "image" || mode === "video" ? findGenerationStyle(visualStyles, sourceNode?.metadata?.styleName) : null;
            const styledGenerationContext =
                selectedStyle && (mode === "image" || mode === "video")
                    ? { ...generationContext, prompt: applyGenerationStylePrompt(generationContext.prompt, selectedStyle), referenceImages: prependStyleReference(selectedStyle, generationContext.referenceImages) }
                    : generationContext;
            const effectivePrompt = styledGenerationContext.prompt.trim();
            const markSourceStatus = sourceNode?.type !== CanvasNodeType.Image && !editingTextNode;
            const statusPrompt = sourceNode?.type === CanvasNodeType.Config ? effectivePrompt : prompt;
            if (!effectivePrompt && (mode === "text" || mode === "audio")) {
                setRunningNodeId(null);
                return;
            }
            let pendingChildIds: string[] = [];
            if (markSourceStatus) setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, prompt: statusPrompt, status: NODE_STATUS_LOADING, errorDetails: undefined } } : node)));

            try {
                if (mode === "image") {
                    const count = getGenerationCount(generationConfig.count);
                    const isConfigNode = sourceNode?.type === CanvasNodeType.Config;
                    const isImageNode = sourceNode?.type === CanvasNodeType.Image;
                    const isEmptyImageNode = isImageNode && !sourceNode?.metadata?.content;
                    const sourceReference =
                        isImageNode && sourceNode?.metadata?.content
                            ? [{ id: sourceNode.id, name: `${sourceNode.title || sourceNode.id}.png`, type: sourceNode.metadata.mimeType || "image/png", dataUrl: sourceNode.metadata.content, storageKey: sourceNode.metadata.storageKey }]
                            : [];
                    const referenceImages = sourceReference.length ? prependStyleReference(selectedStyle, sourceReference) : styledGenerationContext.referenceImages;
                    const generationType = referenceImages.length ? ("edit" as const) : ("generation" as const);
                    const generationMetadata = { ...buildImageGenerationMetadata(generationType, generationConfig, count, referenceImages), styleName: selectedStyle?.name };
                    const parentConfig = NODE_DEFAULT_SIZE[isConfigNode ? CanvasNodeType.Config : isImageNode ? CanvasNodeType.Image : CanvasNodeType.Text];
                    const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
                    const parentPosition = sourceNode?.position || { x: 0, y: 0 };
                    const gap = 96;
                    const rowGap = 36;
                    const rootId = isEmptyImageNode ? nodeId : nanoid();
                    const childIds = count > 1 ? Array.from({ length: count }, () => nanoid()) : [];
                    const targetIds = count > 1 ? childIds : [rootId];
                    pendingChildIds = isEmptyImageNode ? childIds : [rootId, ...childIds];
                    if (isEmptyImageNode) setNodes((prev) => patchLinkedStoryboardSlot(prev, sourceNode, "image", { status: "generating" }));
                    const rootNode: CanvasNodeData = {
                        id: rootId,
                        type: CanvasNodeType.Image,
                        title: effectivePrompt.slice(0, 32) || "Generated Image",
                        position: {
                            x: isEmptyImageNode ? parentPosition.x : parentPosition.x + parentConfig.width + gap,
                            y: parentPosition.y + parentConfig.height / 2 - imageConfig.height / 2,
                        },
                        width: isEmptyImageNode ? sourceNode?.width || imageConfig.width : imageConfig.width,
                        height: isEmptyImageNode ? sourceNode?.height || imageConfig.height : imageConfig.height,
                        metadata: {
                            prompt: effectivePrompt,
                            status: NODE_STATUS_LOADING,
                            isBatchRoot: count > 1,
                            batchChildIds: count > 1 ? childIds : undefined,
                            batchUsesReferenceImages: referenceImages.length > 0,
                            ...generationMetadata,
                            imageBatchExpanded: count > 1 ? true : undefined,
                        },
                    };
                    const childNodes: CanvasNodeData[] = childIds.map((id, index) => ({
                        id,
                        type: CanvasNodeType.Image,
                        title: effectivePrompt.slice(0, 32) || "Generated Image",
                        position: {
                            x: rootNode.position.x + rootNode.width + 120 + (index % 2) * (imageConfig.width + 36),
                            y: rootNode.position.y + Math.floor(index / 2) * (imageConfig.height + rowGap),
                        },
                        width: imageConfig.width,
                        height: imageConfig.height,
                        metadata: { prompt: effectivePrompt, status: NODE_STATUS_LOADING, batchRootId: count > 1 ? rootId : undefined, ...generationMetadata },
                    }));
                    const batchConnections = [...(isEmptyImageNode ? [] : [{ id: nanoid(), fromNodeId: nodeId, toNodeId: rootId }]), ...childIds.map((childId) => ({ id: nanoid(), fromNodeId: rootId, toNodeId: childId }))];

                    setNodes((prev) => [
                        ...prev.map((node) =>
                            node.id === nodeId
                                ? isConfigNode
                                    ? {
                                          ...node,
                                          metadata: { ...node.metadata, prompt: effectivePrompt, status: NODE_STATUS_LOADING, errorDetails: undefined },
                                      }
                                    : isEmptyImageNode
                                      ? {
                                            ...node,
                                            position: rootNode.position,
                                            width: rootNode.width,
                                            height: rootNode.height,
                                            title: rootNode.title,
                                            metadata: { ...node.metadata, ...rootNode.metadata, errorDetails: undefined },
                                        }
                                      : isImageNode
                                        ? {
                                              ...node,
                                              metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS, errorDetails: undefined },
                                          }
                                        : {
                                              ...node,
                                              type: CanvasNodeType.Text,
                                              title: prompt.slice(0, 32) || "Prompt",
                                              width: parentConfig.width,
                                              height: parentConfig.height,
                                              metadata: { ...node.metadata, content: prompt, prompt, status: NODE_STATUS_SUCCESS, fontSize: 14, errorDetails: undefined },
                                          }
                                : node,
                        ),
                        ...(isEmptyImageNode ? [] : [rootNode]),
                        ...childNodes,
                    ]);
                    setConnections((prev) => [...prev, ...batchConnections]);
                    setSelectedNodeIds(new Set([nodeId]));
                    setSelectedConnectionId(null);
                    setDialogNodeId(nodeId);

                    let hasSuccess = false;
                    let hasFailure = false;
                    await Promise.all(
                        targetIds.map(async (targetId) => {
                            try {
                                const image = referenceImages.length
                                    ? await requestEdit({ ...generationConfig, count: "1" }, effectivePrompt, referenceImages).then((items) => items[0])
                                    : await requestGeneration({ ...generationConfig, count: "1" }, effectivePrompt).then((items) => items[0]);
                                const uploaded = await uploadImage(image.dataUrl);
                                const imageSize = fitNodeSize(uploaded.width, uploaded.height, imageConfig.width, imageConfig.height);
                                const shouldFillStoryboard = isEmptyImageNode && !hasSuccess;
                                setNodes((prev) => {
                                    const root = prev.find((node) => node.id === rootId);
                                    return prev.map((node) => {
                                        if (node.id !== targetId && node.id !== rootId) return node;
                                        const center = { x: node.position.x + node.width / 2, y: node.position.y + node.height / 2 };
                                        if (node.id === rootId && (targetId === rootId || !root?.metadata?.primaryImageId))
                                            return {
                                                ...node,
                                                position: { x: center.x - imageSize.width / 2, y: center.y - imageSize.height / 2 },
                                                width: imageSize.width,
                                                height: imageSize.height,
                                                metadata: { ...node.metadata, ...imageMetadata(uploaded), primaryImageId: targetId },
                                            };
                                        if (node.id === targetId)
                                            return {
                                                ...node,
                                                position: { x: center.x - imageSize.width / 2, y: center.y - imageSize.height / 2 },
                                                width: imageSize.width,
                                                height: imageSize.height,
                                                metadata: { ...node.metadata, ...imageMetadata(uploaded) },
                                            };
                                        return node;
                                    });
                                });
                                if (shouldFillStoryboard) setNodes((prev) => patchLinkedStoryboardSlot(prev, sourceNode, "image", { status: "done", url: uploaded.url, nodeId: targetId }));
                                hasSuccess = true;
                                if (isConfigNode) setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS, errorDetails: undefined } } : node)));
                                return true;
                            } catch (error) {
                                const errorDetails = error instanceof Error ? error.message : "生成失败";
                                hasFailure = true;
                                setNodes((prev) => prev.map((node) => (node.id === targetId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } } : node)));
                                return false;
                            }
                        }),
                    );
                    if (hasFailure) message.error(hasSuccess ? "部分图片生成失败" : "全部图片生成失败");
                    if (isEmptyImageNode && !hasSuccess) setNodes((prev) => patchLinkedStoryboardSlot(prev, sourceNode, "image", { status: "error", error: "全部图片生成失败" }));
                    setNodes((prev) =>
                        prev.map((node) =>
                            node.id === nodeId && isConfigNode
                                ? { ...node, metadata: { ...node.metadata, status: hasSuccess ? NODE_STATUS_SUCCESS : NODE_STATUS_ERROR, errorDetails: hasSuccess ? undefined : "全部图片生成失败" } }
                                : node.id === nodeId && isEmptyImageNode
                                  ? { ...node, metadata: { ...node.metadata, status: hasSuccess ? NODE_STATUS_SUCCESS : NODE_STATUS_ERROR, errorDetails: hasSuccess ? undefined : "全部图片生成失败" } }
                                  : node.id === rootId && !hasSuccess
                                    ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails: "全部图片生成失败" } }
                                    : node,
                        ),
                    );
                    return;
                }

                if (mode === "video") {
                    const spec = nodeSizeFromRatio(generationConfig.size, NODE_DEFAULT_SIZE[CanvasNodeType.Video].width, NODE_DEFAULT_SIZE[CanvasNodeType.Video].height) || NODE_DEFAULT_SIZE[CanvasNodeType.Video];
                    const isEmptyVideoNode = sourceNode?.type === CanvasNodeType.Video && !sourceNode.metadata?.content;
                    const refMode: CanvasVideoRefMode = sourceNode?.metadata?.videoRefMode || "text";
                    const ownReferences = await resolveVideoReferences(sourceNode?.metadata?.videoReferences);
                    const storyboardShotImage = linkedStoryboardShotImageReference(nodesRef.current, sourceNode);
                    const effectiveRefMode: CanvasVideoRefMode = storyboardShotImage && refMode === "text" ? "first" : refMode;
                    const videoReferences = clampVideoReferences(effectiveRefMode, [...ownReferences, ...(storyboardShotImage ? [storyboardShotImage] : []), ...styledGenerationContext.referenceImages]);
                    const referenceKeys = videoReferences.map(referenceUrl).filter((url): url is string => Boolean(url));
                    const videoId = isEmptyVideoNode ? nodeId : nanoid();
                    const parent = sourceNode?.position || { x: 0, y: 0 };
                    const videoNode: CanvasNodeData = {
                        id: videoId,
                        type: CanvasNodeType.Video,
                        title: effectivePrompt.slice(0, 32) || "Generated Video",
                        position: isEmptyVideoNode ? sourceNode.position : { x: parent.x + (sourceNode?.width || spec.width) + 96, y: parent.y },
                        width: isEmptyVideoNode ? sourceNode.width : spec.width,
                        height: isEmptyVideoNode ? sourceNode.height : spec.height,
                        metadata: { prompt: effectivePrompt, status: NODE_STATUS_LOADING, model: generationConfig.model, styleName: selectedStyle?.name, size: generationConfig.size, seconds: generationConfig.videoSeconds, vquality: generationConfig.vquality, generateAudio: generationConfig.videoGenerateAudio, watermark: generationConfig.videoWatermark, videoRefMode: effectiveRefMode, references: referenceKeys },
                    };
                    pendingChildIds = [videoId];
                    if (isEmptyVideoNode) setNodes((prev) => patchLinkedStoryboardSlot(prev, sourceNode, "video", { status: "generating" }));
                    setNodes((prev) => (isEmptyVideoNode ? prev.map((node) => (node.id === nodeId ? { ...node, ...videoNode } : node)) : [...prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS } } : node)), videoNode]));
                    if (!isEmptyVideoNode) setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: nodeId, toNodeId: videoId }]);
                    const video = await storeGeneratedVideo(await requestVideoGeneration(generationConfig, effectivePrompt, videoReferences, styledGenerationContext.referenceVideos, styledGenerationContext.referenceAudios));
                    const videoSize = fitNodeSize(video.width || spec.width, video.height || spec.height, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                    setNodes((prev) => prev.map((node) => (node.id === videoId ? { ...node, width: videoSize.width, height: videoSize.height, position: { x: node.position.x + node.width / 2 - videoSize.width / 2, y: node.position.y + node.height / 2 - videoSize.height / 2 }, metadata: { ...node.metadata, ...videoMetadata(video), prompt: effectivePrompt, model: generationConfig.model, styleName: selectedStyle?.name, size: generationConfig.size, seconds: generationConfig.videoSeconds, vquality: generationConfig.vquality, generateAudio: generationConfig.videoGenerateAudio, watermark: generationConfig.videoWatermark, videoRefMode: effectiveRefMode, references: referenceKeys } } : node)));
                    if (isEmptyVideoNode) setNodes((prev) => patchLinkedStoryboardSlot(prev, sourceNode, "video", { status: "done", url: video.url, nodeId: videoId }));
                    return;
                }

                if (mode === "audio") {
                    const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
                    const isEmptyAudioNode = sourceNode?.type === CanvasNodeType.Audio && !sourceNode.metadata?.content;
                    const audioId = isEmptyAudioNode ? nodeId : nanoid();
                    const parent = sourceNode?.position || { x: 0, y: 0 };
                    const audioNode: CanvasNodeData = {
                        id: audioId,
                        type: CanvasNodeType.Audio,
                        title: effectivePrompt.slice(0, 32) || "Generated Audio",
                        position: isEmptyAudioNode ? sourceNode.position : { x: parent.x + (sourceNode?.width || spec.width) + 96, y: parent.y + ((sourceNode?.height || spec.height) - spec.height) / 2 },
                        width: isEmptyAudioNode ? sourceNode.width : spec.width,
                        height: isEmptyAudioNode ? sourceNode.height : spec.height,
                        metadata: { prompt: effectivePrompt, status: NODE_STATUS_LOADING, ...buildAudioGenerationMetadata(generationConfig) },
                    };
                    pendingChildIds = [audioId];
                    setNodes((prev) => (isEmptyAudioNode ? prev.map((node) => (node.id === nodeId ? { ...node, ...audioNode } : node)) : [...prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS } } : node)), audioNode]));
                    if (!isEmptyAudioNode) setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: nodeId, toNodeId: audioId }]);
                    const audio = await storeGeneratedAudio(await requestAudioGeneration(generationConfig, effectivePrompt), generationConfig.audioFormat);
                    setNodes((prev) => prev.map((node) => (node.id === audioId ? { ...node, metadata: { ...node.metadata, ...audioMetadata(audio), prompt: effectivePrompt, ...buildAudioGenerationMetadata(generationConfig) } } : node)));
                    return;
                }

                let textContext = generationContext;
                if (sourceNode?.type === CanvasNodeType.Text && textMode === "imagePrompt" && !textContext.referenceImages.length) {
                    message.warning("请先上传或连接上游图片");
                    return;
                }
                if (sourceNode?.type === CanvasNodeType.Text && textMode === "videoPrompt") {
                    if (!textContext.referenceVideos.length) {
                        message.warning("请先上传或连接上游视频");
                        return;
                    }
                    const nextTextContext = await attachVideoFramesToTextModelContext(textContext);
                    if (!nextTextContext.framesAdded) {
                        message.warning("无法读取视频帧，请使用本地上传的视频或换一个素材");
                        return;
                    }
                    textContext = nextTextContext.context;
                } else if (textContext.referenceVideos.length) {
                    const nextTextContext = await attachVideoFramesToTextModelContext(textContext);
                    if (!nextTextContext.framesAdded) message.warning("视频引用未读取到画面帧，将仅按素材编号写入提示词");
                    textContext = nextTextContext.context;
                }

                let streamed = "";
                const isConfigNode = sourceNode?.type === CanvasNodeType.Config;
                const textCount = isConfigNode ? getGenerationCount(generationConfig.count) : 1;
                const parentConfig = NODE_DEFAULT_SIZE[isConfigNode ? CanvasNodeType.Config : CanvasNodeType.Text];
                const textConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Text];
                const parentPosition = sourceNode?.position || { x: 0, y: 0 };
                const childIds = isConfigNode || editingTextNode ? Array.from({ length: textCount }, () => nanoid()) : [];
                pendingChildIds = childIds;
                if (isConfigNode || editingTextNode) {
                    const childNodes: CanvasNodeData[] = childIds.map((id, index) => ({
                        id,
                        type: CanvasNodeType.Text,
                        title: effectivePrompt.slice(0, 32) || "Generated Text",
                        position: {
                            x: parentPosition.x + parentConfig.width + 96,
                            y: parentPosition.y + parentConfig.height / 2 - textConfig.height / 2 + (index - (textCount - 1) / 2) * (textConfig.height + 36),
                        },
                        width: textConfig.width,
                        height: textConfig.height,
                        metadata: { prompt: effectivePrompt, status: NODE_STATUS_LOADING, fontSize: 14 },
                    }));
                    setNodes((prev) => [...prev.map((node) => (node.id === nodeId && isConfigNode ? { ...node, metadata: { ...node.metadata, prompt: effectivePrompt, status: NODE_STATUS_LOADING, errorDetails: undefined } } : node)), ...childNodes]);
                    setConnections((prev) => [...prev, ...childIds.map((childId) => ({ id: nanoid(), fromNodeId: nodeId, toNodeId: childId }))]);
                }

                const answers = await Promise.all(
                    (childIds.length ? childIds : [nodeId]).map((targetNodeId) => {
                        let localStreamed = "";
                        return requestImageQuestion(generationConfig, buildNodeChatMessages({ ...textContext, prompt: effectivePrompt }), (text) => {
                            localStreamed = text;
                            streamed = text;
                            if (isConfigNode) return;
                            setNodes((prev) => prev.map((node) => (node.id === targetNodeId ? { ...node, type: CanvasNodeType.Text, metadata: { ...node.metadata, content: text, status: NODE_STATUS_LOADING } } : node)));
                        }).then((answer) => ({ nodeId: targetNodeId, content: answer || localStreamed }));
                    }),
                );
                const answerByNodeId = new Map(answers.map((item) => [item.nodeId, item.content]));
                setNodes((prev) =>
                    prev.map((node) =>
                        childIds.includes(node.id)
                            ? { ...node, metadata: { ...node.metadata, content: answerByNodeId.get(node.id) || streamed, status: NODE_STATUS_SUCCESS } }
                            : node.id === nodeId && isConfigNode
                              ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS } }
                              : node.id === nodeId && !editingTextNode
                                ? { ...node, type: CanvasNodeType.Text, title: submittedPrompt.slice(0, 32) || "Generated Text", metadata: { ...node.metadata, content: answerByNodeId.get(node.id) || streamed, prompt: submittedPrompt, model: generationConfig.model, status: NODE_STATUS_SUCCESS } }
                                : node,
                    ),
                );
            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                message.error(errorDetails);
                if (mode === "image" && sourceNode?.type === CanvasNodeType.Image && !sourceNode.metadata?.content) setNodes((prev) => patchLinkedStoryboardSlot(prev, sourceNode, "image", { status: "error", error: errorDetails }));
                if (mode === "video" && sourceNode?.type === CanvasNodeType.Video && !sourceNode.metadata?.content) setNodes((prev) => patchLinkedStoryboardSlot(prev, sourceNode, "video", { status: "error", error: errorDetails }));
                setNodes((prev) =>
                    prev.map((node) => (node.id === nodeId || pendingChildIds.includes(node.id) ? (node.id === nodeId && !markSourceStatus ? node : { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } }) : node)),
                );
            } finally {
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, openConfigDialog],
    );

    useEffect(() => {
        generateNodeRef.current = handleGenerateNode;
    }, [handleGenerateNode]);

    const handleGenerateStoryboardShot = useCallback(
        async (nodeId: string, shotId: string, mode: CanvasStoryboardGenerationMode, prompt: string) => {
            const sourceNode = nodesRef.current.find((node) => node.id === nodeId);
            const shot = sourceNode?.metadata?.storyboard?.shots.find((item) => item.id === shotId);
            const submittedPrompt = prompt.trim();
            if (!sourceNode || !shot) return;
            if (!submittedPrompt) {
                message.warning(mode === "image" ? "请先填写分镜图提示词" : "请先填写视频提示词");
                return;
            }

            const generationConfig = buildGenerationConfig(
                effectiveConfig,
                { ...sourceNode, metadata: { ...sourceNode.metadata, model: mode === "image" ? sourceNode.metadata?.storyboardImageModel : sourceNode.metadata?.storyboardVideoModel } },
                mode,
            );
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }

            setRunningNodeId(nodeId);
            setNodes((prev) => prev.map((node) => (node.id === nodeId ? patchStoryboardShot(node, shotId, mode === "image" ? { image: { status: "generating" } } : { video: { status: "generating" } }) : node)));

            try {
                const context = await hydrateNodeGenerationContext(buildNodeGenerationContext(nodeId, nodesRef.current, connectionsRef.current, submittedPrompt));
                const selectedStyle = findGenerationStyle(visualStyles, sourceNode.metadata?.styleName);
                const styledContext = selectedStyle ? { ...context, prompt: applyGenerationStylePrompt(context.prompt, selectedStyle), referenceImages: prependStyleReference(selectedStyle, context.referenceImages) } : context;
                const effectivePrompt = styledContext.prompt.trim();
                if (!effectivePrompt) return;

                if (mode === "image") {
                    const image = styledContext.referenceImages.length ? await requestEdit({ ...generationConfig, count: "1" }, effectivePrompt, styledContext.referenceImages).then((items) => items[0]) : await requestGeneration({ ...generationConfig, count: "1" }, effectivePrompt).then((items) => items[0]);
                    const uploaded = await uploadImage(image.dataUrl);
                    const imageSize = fitNodeSize(uploaded.width, uploaded.height);
                    const resultId = findStoryboardResultNodeId(nodesRef.current, nodeId, shotId, "image") || nanoid();
                    setNodes((prev) =>
                        upsertStoryboardResultNode(
                            prev.map((node) => {
                                if (node.id !== nodeId) return node;
                                const slot: CanvasMediaSlot = { status: "done", url: uploaded.url, nodeId: resultId };
                                const currentShot = node.metadata?.storyboard?.shots.find((item) => item.id === shotId);
                                return patchStoryboardShot(node, shotId, { image: slot, imageHistory: appendMediaHistory(currentShot?.imageHistory, slot) });
                            }),
                            sourceNode,
                            shotId,
                            "image",
                            resultId,
                            imageSize,
                            { ...imageMetadata(uploaded), prompt: effectivePrompt, model: generationConfig.model, styleName: selectedStyle?.name, size: generationConfig.size, quality: generationConfig.quality },
                        ),
                    );
                    setConnections((prev) => (prev.some((connection) => connection.fromNodeId === nodeId && connection.toNodeId === resultId) ? prev : [...prev, { id: nanoid(), fromNodeId: nodeId, toNodeId: resultId }]));
                    setGroups((prev) => upsertAutoCanvasGroup(prev, "分镜组", resultId, sourceNode));
                    return;
                }

                const latestShot = nodesRef.current.find((node) => node.id === nodeId)?.metadata?.storyboard?.shots.find((item) => item.id === shotId) || shot;
                const shotImage = storyboardShotImageReference(latestShot);
                const videoReferences = [...(shotImage ? [shotImage] : []), ...styledContext.referenceImages];
                const video = await storeGeneratedVideo(await requestVideoGeneration(generationConfig, effectivePrompt, videoReferences, styledContext.referenceVideos, styledContext.referenceAudios));
                const videoSize = fitNodeSize(video.width || NODE_DEFAULT_SIZE[CanvasNodeType.Video].width, video.height || NODE_DEFAULT_SIZE[CanvasNodeType.Video].height, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                const resultId = findStoryboardResultNodeId(nodesRef.current, nodeId, shotId, "video") || nanoid();
                setNodes((prev) =>
                    upsertStoryboardResultNode(
                        prev.map((node) => {
                            if (node.id !== nodeId) return node;
                            const slot: CanvasMediaSlot = { status: "done", url: video.url, nodeId: resultId };
                            const currentShot = node.metadata?.storyboard?.shots.find((item) => item.id === shotId);
                            return patchStoryboardShot(node, shotId, { video: slot, videoHistory: appendMediaHistory(currentShot?.videoHistory, slot) });
                        }),
                        sourceNode,
                        shotId,
                        "video",
                        resultId,
                        videoSize,
                        { ...videoMetadata(video), prompt: effectivePrompt, model: generationConfig.model, styleName: selectedStyle?.name, size: generationConfig.size, seconds: generationConfig.videoSeconds, vquality: generationConfig.vquality, generateAudio: generationConfig.videoGenerateAudio, watermark: generationConfig.videoWatermark },
                    ),
                );
                setConnections((prev) => (prev.some((connection) => connection.fromNodeId === nodeId && connection.toNodeId === resultId) ? prev : [...prev, { id: nanoid(), fromNodeId: nodeId, toNodeId: resultId }]));
                setGroups((prev) => upsertAutoCanvasGroup(prev, "视频组", resultId, sourceNode));
            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                message.error(errorDetails);
                setNodes((prev) => prev.map((node) => (node.id === nodeId ? patchStoryboardShot(node, shotId, mode === "image" ? { image: { status: "error", error: errorDetails } } : { video: { status: "error", error: errorDetails } }) : node)));
            } finally {
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, message, openConfigDialog, visualStyles],
    );

    const updateBoardMediaPrompt = useCallback((target: CanvasBoardMediaEditorTarget, prompt: string) => {
        const key = boardMediaKey(target);
        setBoardMediaDrafts((prev) => ({ ...prev, [key]: { ...prev[key], prompt } }));
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== target.nodeId) return node;
                if (target.boardType === "subject") return patchSubjectBoardItem(node, target.groupId, target.itemId, { prompt });
                return patchStoryboardShot(node, target.shotId, target.kind === "image" ? { imagePrompt: prompt } : { videoPrompt: prompt });
            }),
        );
    }, []);

    const updateBoardMediaConfig = useCallback((target: CanvasBoardMediaEditorTarget, patch: Partial<CanvasNodeMetadata>) => {
        const key = boardMediaKey(target);
        setBoardMediaDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    }, []);

    const selectBoardMediaSlot = useCallback((target: CanvasBoardMediaEditorTarget, slot: CanvasMediaSlot) => {
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== target.nodeId || slot.status !== "done" || !slot.url) return node;
                if (target.boardType === "subject") return patchSubjectBoardItem(node, target.groupId, target.itemId, target.kind === "image" ? { image: slot, thumbnail: slot.url } : { video: slot });
                return patchStoryboardShot(node, target.shotId, target.kind === "image" ? { image: slot } : { video: slot });
            }),
        );
    }, []);

    const handleGenerateBoardMedia = useCallback(
        async (target: CanvasBoardMediaEditorTarget, mode: CanvasNodeGenerationMode, prompt: string) => {
            if (mode !== target.kind) return;
            const sourceNode = nodesRef.current.find((node) => node.id === target.nodeId) || null;
            const key = boardMediaKey(target);
            const panelNode = buildBoardMediaPanelNode(sourceNode, target, boardMediaDrafts[key]);
            if (!sourceNode || !panelNode) return;
            const generationConfig = buildGenerationConfig(effectiveConfig, panelNode, mode);
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }

            setRunningNodeId(key);
            setNodes((prev) =>
                prev.map((node) => {
                    if (node.id !== target.nodeId) return node;
                    const loadingSlot: CanvasMediaSlot = { status: "generating" };
                    if (target.boardType === "subject") return patchSubjectBoardItem(node, target.groupId, target.itemId, target.kind === "image" ? { image: loadingSlot } : { video: loadingSlot });
                    return patchStoryboardShot(node, target.shotId, target.kind === "image" ? { image: loadingSlot } : { video: loadingSlot });
                }),
            );

            try {
                const details = getBoardMediaDetails(sourceNode, target);
                if (mode === "image") {
                    const image = await requestGeneration({ ...generationConfig, count: "1" }, prompt).then((items) => items[0]);
                    const uploaded = await uploadImage(image.dataUrl);
                    const slot: CanvasMediaSlot = { status: "done", url: uploaded.url };
                    setNodes((prev) =>
                        prev.map((node) => {
                            if (node.id !== target.nodeId) return node;
                            if (target.boardType === "subject") {
                                const item = node.metadata?.subjectBoard?.groups.find((group) => group.id === target.groupId)?.items.find((entry) => entry.id === target.itemId);
                                return patchSubjectBoardItem(node, target.groupId, target.itemId, { image: slot, thumbnail: slot.url, imageHistory: appendMediaHistory(item?.imageHistory, slot) });
                            }
                            const shot = node.metadata?.storyboard?.shots.find((entry) => entry.id === target.shotId);
                            return patchStoryboardShot(node, target.shotId, { image: slot, imageHistory: appendMediaHistory(shot?.imageHistory, slot) });
                        }),
                    );
                    return;
                }

                const reference = details?.imageUrl ? boardImageReference(details.imageUrl, target) : null;
                const video = await storeGeneratedVideo(await requestVideoGeneration(generationConfig, prompt, reference ? [reference] : [], [], []));
                const slot: CanvasMediaSlot = { status: "done", url: video.url };
                setNodes((prev) =>
                    prev.map((node) => {
                        if (node.id !== target.nodeId) return node;
                        if (target.boardType === "subject") {
                            const item = node.metadata?.subjectBoard?.groups.find((group) => group.id === target.groupId)?.items.find((entry) => entry.id === target.itemId);
                            return patchSubjectBoardItem(node, target.groupId, target.itemId, { video: slot, videoHistory: appendMediaHistory(item?.videoHistory, slot) });
                        }
                        const shot = node.metadata?.storyboard?.shots.find((entry) => entry.id === target.shotId);
                        return patchStoryboardShot(node, target.shotId, { video: slot, videoHistory: appendMediaHistory(shot?.videoHistory, slot) });
                    }),
                );
            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                message.error(errorDetails);
                setNodes((prev) =>
                    prev.map((node) => {
                        if (node.id !== target.nodeId) return node;
                        const errorSlot: CanvasMediaSlot = { status: "error", error: errorDetails };
                        if (target.boardType === "subject") return patchSubjectBoardItem(node, target.groupId, target.itemId, target.kind === "image" ? { image: errorSlot } : { video: errorSlot });
                        return patchStoryboardShot(node, target.shotId, target.kind === "image" ? { image: errorSlot } : { video: errorSlot });
                    }),
                );
            } finally {
                setRunningNodeId(null);
            }
        },
        [boardMediaDrafts, effectiveConfig, isAiConfigReady, message, openConfigDialog],
    );

    const renderSubjectGenerationPanel = useCallback(
        (node: CanvasNodeData) => {
            const target = subjectPanelTarget(node);
            if (!target) return null;
            const key = boardMediaKey(target);
            const panelNode = buildBoardMediaPanelNode(node, target, boardMediaDrafts[key]);
            if (!panelNode) return null;
            const selectedKey = `${target.groupId}:${target.itemId}`;

            return (
                <CanvasNodePromptPanel
                    node={panelNode}
                    isRunning={runningNodeId === key}
                    modeOverride="image"
                    keepPromptAfterSubmit
                    selectionLabel="角色选择"
                    selectionOptions={subjectBoardPromptOptions(node)}
                    selectedSelectionValue={selectedKey}
                    onSelectionChange={(value, option) => {
                        const [groupId, itemId] = value.split(":");
                        const nextTarget: CanvasBoardMediaEditorTarget = { boardType: "subject", nodeId: node.id, groupId, itemId, kind: "image" };
                        setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, subjectPanelGroupId: groupId, subjectPanelItemId: itemId, status: "success" } } : item)));
                        if (option?.prompt !== undefined) updateBoardMediaPrompt(nextTarget, option.prompt);
                    }}
                    onPromptChange={(_nodeId, prompt) => updateBoardMediaPrompt(target, prompt)}
                    onConfigChange={(_nodeId, patch) => updateBoardMediaConfig(target, patch)}
                    onGenerate={(_nodeId, _mode, prompt) => void handleGenerateBoardMedia(target, "image", prompt)}
                    onImageSettingsOpenChange={(open) => {
                        setNodeImageSettingsOpen(open);
                        if (open) setToolbarNodeId(null);
                    }}
                />
            );
        },
        [boardMediaDrafts, handleGenerateBoardMedia, runningNodeId, updateBoardMediaConfig, updateBoardMediaPrompt],
    );

    const renderStoryboardGenerationPanel = useCallback(
        (node: CanvasNodeData) => {
            const panelNode = buildStoryboardGenerationPanelNode(node);
            if (!panelNode) return null;
            const mode = node.metadata?.storyboardPanelMode || "image";
            const shotId = node.metadata?.storyboardPanelShotId || "";
            const shot = node.metadata?.storyboard?.shots.find((item) => item.id === shotId);

            return (
                <CanvasNodePromptPanel
                    node={panelNode}
                    isRunning={runningNodeId === node.id}
                    modeOverride={mode}
                    keepPromptAfterSubmit
                    storyboardShots={storyboardShotOptions(node)}
                    upstreamVideoRefs={mode === "video" && shot?.image?.status === "done" && shot.image.url ? [{ id: `${node.id}-${shot.id}`, url: shot.image.url, storageKey: shot.image.url.startsWith("image:") ? shot.image.url : undefined }] : []}
                    onPromptChange={(_nodeId, prompt) => setNodes((prev) => prev.map((item) => (item.id === node.id ? applyStoryboardGenerationPanelPatch(item, { prompt }) : item)))}
                    onConfigChange={(_nodeId, patch) => setNodes((prev) => prev.map((item) => (item.id === node.id ? applyStoryboardGenerationPanelPatch(item, patch) : item)))}
                    onGenerate={(_nodeId, nextMode, prompt) => void handleGenerateStoryboardShot(node.id, node.metadata?.storyboardPanelShotId || shotId, nextMode === "video" ? "video" : "image", prompt)}
                    onStoryboardShotSelect={(_sourceNodeId, nextShotId) => setNodes((prev) => prev.map((item) => (item.id === node.id ? applyStoryboardGenerationPanelPatch(item, { storyboardShotId: nextShotId }) : item)))}
                    onImageSettingsOpenChange={(open) => {
                        setNodeImageSettingsOpen(open);
                        if (open) setToolbarNodeId(null);
                    }}
                />
            );
        },
        [handleGenerateStoryboardShot, runningNodeId],
    );

    const handleRunAgentNode = useCallback(
        async (nodeId: string, prompt: string) => {
            const sourceNode = nodesRef.current.find((node) => node.id === nodeId);
            if (!sourceNode) return;
            const generationConfig = buildGenerationConfig(effectiveConfig, sourceNode, "text");
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }

            const agentInstruction = sourceNode.metadata?.agentInstruction?.trim();
            const configWithAgentInstruction = {
                ...generationConfig,
                systemPrompt: [generationConfig.systemPrompt.trim(), agentInstruction].filter(Boolean).join("\n\n"),
            };
            setRunningNodeId(nodeId);
            const storyboardSubjectReferences = sourceNode.type === CanvasNodeType.StoryboardAgent ? buildStoryboardAgentSubjectReferences(nodeId, nodesRef.current, connectionsRef.current) : [];
            const formattedPrompt = buildAgentPrompt(sourceNode.type === CanvasNodeType.StoryboardAgent ? `${prompt}${buildStoryboardAgentSubjectPrompt(storyboardSubjectReferences)}` : prompt, sourceNode.metadata?.agentOutputFormat);
            setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, ...agentTaskMetadata(node.type, "start"), prompt, model: generationConfig.model, content: undefined } } : node)));

            try {
                const context = await hydrateNodeGenerationContext(buildNodeGenerationContext(nodeId, nodesRef.current, connectionsRef.current, formattedPrompt));
                const effectivePrompt = context.prompt.trim();
                if (!effectivePrompt) return;

                let streamed = "";
                setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, ...agentTaskMetadata(node.type, "generating"), prompt, model: generationConfig.model, content: undefined } } : node)));
                const answer = await requestImageQuestion(configWithAgentInstruction, buildNodeChatMessages({ ...context, prompt: effectivePrompt }), (text) => {
                    streamed = text;
                });
                const finalAnswer = answer || streamed;
                const latestSource = nodesRef.current.find((node) => node.id === nodeId) || sourceNode;
                const directSubjectBoardId = latestSource.type === CanvasNodeType.CharacterAgent ? findDirectSubjectBoardTarget(nodeId, nodesRef.current, connectionsRef.current) : undefined;
                const directStoryboardId = latestSource.type === CanvasNodeType.StoryboardAgent ? findDirectStoryboardTarget(nodeId, nodesRef.current, connectionsRef.current) : undefined;
                const directTextId = latestSource.type === CanvasNodeType.ScriptAgent ? findDirectTextTarget(nodeId, nodesRef.current, connectionsRef.current) : undefined;
                const resultId = directSubjectBoardId || directStoryboardId || directTextId || latestSource.metadata?.agentResultNodeId || nanoid();
                setNodes((prev) => {
                    const nextNodes = prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, ...agentTaskMetadata(node.type, finalAnswer.trim() ? "success" : "writing"), prompt, model: generationConfig.model, content: undefined, agentResultNodeId: finalAnswer.trim() ? resultId : node.metadata?.agentResultNodeId } } : node));
                    if (!finalAnswer.trim()) return nextNodes;
                    if (latestSource.type === CanvasNodeType.CharacterAgent) return upsertCharacterAgentResultNode(nextNodes, latestSource, resultId, finalAnswer, prompt);
                    if (latestSource.type === CanvasNodeType.StoryboardAgent) return upsertStoryboardAgentResultNode(nextNodes, latestSource, resultId, finalAnswer, prompt, storyboardSubjectReferences);
                    return upsertAgentResultNode(nextNodes, latestSource, resultId, finalAnswer, prompt);
                });
                if (finalAnswer.trim()) {
                    setConnections((prev) => (prev.some((connection) => connection.fromNodeId === nodeId && connection.toNodeId === resultId) ? prev : [...prev, { id: nanoid(), fromNodeId: nodeId, toNodeId: resultId }]));
                }
            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                message.error(errorDetails);
                setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, ...agentTaskMetadata(node.type, "error", errorDetails), content: undefined } } : node)));
            } finally {
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, isAiConfigReady, message, openConfigDialog],
    );

    const sendNodeToNext = useCallback(
        (node: CanvasNodeData) => {
            const targets = connectionsRef.current
                .filter((connection) => connection.fromNodeId === node.id)
                .map((connection) => nodesRef.current.find((item) => item.id === connection.toNodeId))
                .filter((item): item is CanvasNodeData => Boolean(item));
            if (!targets.length) {
                message.warning("请先连接下一个节点");
                return;
            }

            let executableCount = 0;
            targets.forEach((target) => {
                if (isAgentNode(target)) {
                    executableCount += 1;
                    void handleRunAgentNode(target.id, target.metadata?.prompt?.trim() || "请基于上游故事设定继续执行。");
                    return;
                }
                const mode = target.type === CanvasNodeType.Config ? target.metadata?.generationMode || "image" : target.type === CanvasNodeType.Text ? "text" : target.type === CanvasNodeType.Video ? "video" : target.type === CanvasNodeType.Audio ? "audio" : target.type === CanvasNodeType.Image ? "image" : null;
                if (!mode) return;
                executableCount += 1;
                void handleGenerateNode(target.id, mode as CanvasNodeGenerationMode, target.metadata?.prompt || "");
            });

            if (!executableCount) message.warning("下一个节点暂不支持自动执行");
        },
        [handleGenerateNode, handleRunAgentNode, message],
    );

    const runGroupNodes = useCallback(
        (groupId: string) => {
            const group = groupsRef.current.find((item) => item.id === groupId);
            if (!group) return;
            const groupIds = new Set(group.nodeIds);
            const groupNodes = nodesRef.current.filter((node) => groupIds.has(node.id));
            let executableCount = 0;

            groupNodes.forEach((node) => {
                if (isAgentNode(node)) {
                    executableCount += 1;
                    void handleRunAgentNode(node.id, node.metadata?.prompt?.trim() || "请基于上游内容执行。");
                    return;
                }
                const mode = node.type === CanvasNodeType.Config ? node.metadata?.generationMode || "image" : node.type === CanvasNodeType.Text ? "text" : node.type === CanvasNodeType.Video ? "video" : node.type === CanvasNodeType.Audio ? "audio" : node.type === CanvasNodeType.Image ? "image" : null;
                if (!mode) return;
                executableCount += 1;
                void handleGenerateNode(node.id, mode as CanvasNodeGenerationMode, node.metadata?.prompt || "");
            });

            if (!executableCount) message.warning("分组内没有可执行节点");
        },
        [handleGenerateNode, handleRunAgentNode, message],
    );

    const handleRetryNode = useCallback(
        async (node: CanvasNodeData) => {
            const sourceNode = findRetrySourceNode(node.id, nodesRef.current, connectionsRef.current) || node;
            const batchRoot = node.metadata?.batchRootId ? nodesRef.current.find((item) => item.id === node.metadata?.batchRootId) : null;
            const savedImageMetadata = node.type === CanvasNodeType.Image ? { ...batchRoot?.metadata, ...node.metadata } : undefined;
            const hasSavedImageMetadata = Boolean(savedImageMetadata?.generationType);
            const generationConfig =
                hasSavedImageMetadata && savedImageMetadata
                    ? {
                          ...effectiveConfig,
                          model: savedImageMetadata.model || effectiveConfig.imageModel || effectiveConfig.model,
                          quality: savedImageMetadata.quality || effectiveConfig.quality,
                          size: savedImageMetadata.size || effectiveConfig.size,
                          count: "1",
                      }
                    : { ...buildGenerationConfig(effectiveConfig, sourceNode, node.type === CanvasNodeType.Text || isAgentNode(node) ? "text" : node.type === CanvasNodeType.Video ? "video" : node.type === CanvasNodeType.Audio ? "audio" : "image"), count: "1" };
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }

            const context = hasSavedImageMetadata ? null : await hydrateNodeGenerationContext(buildNodeGenerationContext(sourceNode.id, nodesRef.current, connectionsRef.current, sourceNode.metadata?.prompt || node.metadata?.prompt || ""));
            const prompt = (savedImageMetadata?.prompt || context?.prompt || "").trim();
            if (!prompt) {
                message.warning("找不到提示词，无法重试");
                return;
            }
            const generationType = savedImageMetadata?.generationType;
            const useReferenceImages = generationType ? generationType === "edit" : Boolean(context?.referenceImages.length);
            const retryReferenceImages =
                hasSavedImageMetadata && savedImageMetadata ? await resolveMetadataReferences(savedImageMetadata) : useReferenceImages ? (context?.referenceImages.length ? context.referenceImages : sourceNodeReferenceImages(batchRoot || sourceNode)) : [];
            if (useReferenceImages && !retryReferenceImages) {
                message.error("参考图片已丢失，无法继续重试");
                setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails: "参考图片已丢失，无法继续重试" } } : item)));
                return;
            }
            const retryImages = retryReferenceImages || [];

            setRunningNodeId(node.id);
            setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, ...(isAgentNode(item) ? agentTaskMetadata(item.type, "start") : { status: NODE_STATUS_LOADING, errorDetails: undefined }), content: isAgentNode(item) ? undefined : item.metadata?.content } } : item)));

            try {
                if (isAgentNode(node)) {
                    setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, ...agentTaskMetadata(item.type, "generating"), prompt, content: undefined } } : item)));
                    const agentInstruction = node.metadata?.agentInstruction?.trim();
                    const configWithAgentInstruction = {
                        ...generationConfig,
                        systemPrompt: [generationConfig.systemPrompt.trim(), agentInstruction].filter(Boolean).join("\n\n"),
                    };
                    const storyboardSubjectReferences = node.type === CanvasNodeType.StoryboardAgent ? buildStoryboardAgentSubjectReferences(node.id, nodesRef.current, connectionsRef.current) : [];
                    const retryAgentPrompt = node.type === CanvasNodeType.StoryboardAgent ? `${prompt}${buildStoryboardAgentSubjectPrompt(storyboardSubjectReferences)}` : prompt;
                    const hydratedAgentContext = await hydrateNodeGenerationContext(buildNodeGenerationContext(node.id, nodesRef.current, connectionsRef.current, buildAgentPrompt(retryAgentPrompt, node.metadata?.agentOutputFormat)));
                    const agentContext = (await attachVideoFramesToTextModelContext(hydratedAgentContext)).context;
                    let streamed = "";
                    const answer = await requestImageQuestion(configWithAgentInstruction, buildNodeChatMessages(agentContext), (text) => {
                        streamed = text;
                    });
                    const finalAnswer = answer || streamed;
                    const latestSource = nodesRef.current.find((item) => item.id === node.id) || node;
                    const directSubjectBoardId = latestSource.type === CanvasNodeType.CharacterAgent ? findDirectSubjectBoardTarget(node.id, nodesRef.current, connectionsRef.current) : undefined;
                    const directStoryboardId = latestSource.type === CanvasNodeType.StoryboardAgent ? findDirectStoryboardTarget(node.id, nodesRef.current, connectionsRef.current) : undefined;
                    const directTextId = latestSource.type === CanvasNodeType.ScriptAgent ? findDirectTextTarget(node.id, nodesRef.current, connectionsRef.current) : undefined;
                    const resultId = directSubjectBoardId || directStoryboardId || directTextId || latestSource.metadata?.agentResultNodeId || nanoid();
                    setNodes((prev) => {
                        const nextNodes = prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, ...agentTaskMetadata(item.type, finalAnswer.trim() ? "success" : "writing"), prompt, content: undefined, agentResultNodeId: finalAnswer.trim() ? resultId : item.metadata?.agentResultNodeId } } : item));
                        if (!finalAnswer.trim()) return nextNodes;
                        if (latestSource.type === CanvasNodeType.CharacterAgent) return upsertCharacterAgentResultNode(nextNodes, latestSource, resultId, finalAnswer, prompt);
                        if (latestSource.type === CanvasNodeType.StoryboardAgent) return upsertStoryboardAgentResultNode(nextNodes, latestSource, resultId, finalAnswer, prompt, storyboardSubjectReferences);
                        return upsertAgentResultNode(nextNodes, latestSource, resultId, finalAnswer, prompt);
                    });
                    if (finalAnswer.trim()) {
                        setConnections((prev) => (prev.some((connection) => connection.fromNodeId === node.id && connection.toNodeId === resultId) ? prev : [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: resultId }]));
                    }
                    return;
                }
                if (node.type === CanvasNodeType.Text) {
                    if (!context) return;
                    let retryTextContext = context;
                    const retryTextMode = node.metadata?.textMode || "write";
                    if (retryTextMode === "imagePrompt" && !retryTextContext.referenceImages.length) {
                        message.warning("请先上传或连接上游图片");
                        return;
                    }
                    if (retryTextMode === "videoPrompt") {
                        if (!retryTextContext.referenceVideos.length) {
                            message.warning("请先上传或连接上游视频");
                            return;
                        }
                        const nextRetryTextContext = await attachVideoFramesToTextModelContext(retryTextContext);
                        if (!nextRetryTextContext.framesAdded) {
                            message.warning("无法读取视频帧，请使用本地上传的视频或换一个素材");
                            return;
                        }
                        retryTextContext = nextRetryTextContext.context;
                    } else if (retryTextContext.referenceVideos.length) {
                        retryTextContext = (await attachVideoFramesToTextModelContext(retryTextContext)).context;
                    }
                    let streamed = "";
                    const answer = await requestImageQuestion(generationConfig, buildNodeChatMessages({ ...retryTextContext, prompt }), (text) => {
                        streamed = text;
                        setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, type: CanvasNodeType.Text, metadata: { ...item.metadata, content: text, status: NODE_STATUS_LOADING } } : item)));
                    });
                    setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, type: CanvasNodeType.Text, metadata: { ...item.metadata, content: answer || streamed, prompt, status: NODE_STATUS_SUCCESS } } : item)));
                    return;
                }
                if (node.type === CanvasNodeType.Video) {
                    const refMode: CanvasVideoRefMode = node.metadata?.videoRefMode || "text";
                    const savedReferences = clampVideoReferences(refMode, await resolveVideoReferences(node.metadata?.references));
                    const video = await storeGeneratedVideo(await requestVideoGeneration(generationConfig, prompt, savedReferences.length ? savedReferences : retryImages, context?.referenceVideos || [], context?.referenceAudios || []));
                    const videoSize = fitNodeSize(video.width || node.width, video.height || node.height, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                    setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, width: videoSize.width, height: videoSize.height, position: { x: item.position.x + item.width / 2 - videoSize.width / 2, y: item.position.y + item.height / 2 - videoSize.height / 2 }, metadata: { ...item.metadata, ...videoMetadata(video), prompt, model: generationConfig.model, size: generationConfig.size, seconds: generationConfig.videoSeconds, vquality: generationConfig.vquality, generateAudio: generationConfig.videoGenerateAudio, watermark: generationConfig.videoWatermark } } : item)));
                    return;
                }
                if (node.type === CanvasNodeType.Audio) {
                    const audio = await storeGeneratedAudio(await requestAudioGeneration(generationConfig, prompt), generationConfig.audioFormat);
                    setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, ...audioMetadata(audio), prompt, ...buildAudioGenerationMetadata(generationConfig) } } : item)));
                    return;
                }

                const image = useReferenceImages ? await requestEdit(generationConfig, prompt, retryImages).then((items) => items[0]) : await requestGeneration(generationConfig, prompt).then((items) => items[0]);
                const uploadedImage = await uploadImage(image.dataUrl);
                const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
                const imageSize = fitNodeSize(uploadedImage.width, uploadedImage.height, imageConfig.width, imageConfig.height);
                const generationMetadata = savedImageMetadata?.generationType
                    ? { generationType: savedImageMetadata.generationType, model: generationConfig.model, size: generationConfig.size, quality: generationConfig.quality, count: savedImageMetadata.count || 1, references: savedImageMetadata.references }
                    : buildImageGenerationMetadata(useReferenceImages ? "edit" : "generation", generationConfig, 1, retryImages);
                setNodes((prev) =>
                    prev.map((item) =>
                        item.id === node.id
                            ? {
                                  ...item,
                                  type: CanvasNodeType.Image,
                                  width: imageSize.width,
                                  height: imageSize.height,
                                  metadata: { ...item.metadata, ...imageMetadata(uploadedImage), prompt, ...generationMetadata },
                              }
                            : item,
                    ),
                );
            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                message.error(errorDetails);
                setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, ...(isAgentNode(item) ? agentTaskMetadata(item.type, "error", errorDetails) : { status: NODE_STATUS_ERROR, errorDetails }), content: isAgentNode(item) ? undefined : item.metadata?.content } } : item)));
            } finally {
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, message, openConfigDialog, visualStyles],
    );

    const generateImageFromTextNode = useCallback(
        (node: CanvasNodeData) => {
            const prompt = (node.metadata?.content || node.metadata?.prompt || "").trim();
            if (!prompt) {
                message.warning("文本节点为空，无法生图");
                return;
            }
            const sourceNode = nodesRef.current.find((item) => item.id === node.id);
            if (!sourceNode) return;
            const nodeSize = getNodeSpec(CanvasNodeType.Config);
            const configNode = createCanvasNode(
                CanvasNodeType.Config,
                {
                    x: sourceNode.position.x + sourceNode.width + 96 + nodeSize.width / 2,
                    y: sourceNode.position.y + sourceNode.height / 2,
                },
                {
                    prompt: "",
                    model: effectiveConfig.imageModel || effectiveConfig.model,
                    size: effectiveConfig.size,
                    count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count),
                    ...(config.defaultStyleName ? { styleName: config.defaultStyleName } : {}),
                },
            );
            const connection = { id: nanoid(), fromNodeId: sourceNode.id, toNodeId: configNode.id };
            const nextNodes = nodesRef.current.map((item) => (item.id === sourceNode.id ? { ...item, metadata: { ...item.metadata, content: prompt, prompt, status: NODE_STATUS_SUCCESS } } : item)).concat(configNode);
            const nextConnections = [...connectionsRef.current, connection];
            nodesRef.current = nextNodes;
            connectionsRef.current = nextConnections;
            setNodes(nextNodes);
            setConnections(nextConnections);
            setSelectedNodeIds(new Set([configNode.id]));
            setSelectedConnectionId(null);
            setDialogNodeId(configNode.id);
        },
        [config.defaultStyleName, effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, message],
    );

    const insertAssistantImage = useCallback(
        async (image: CanvasAssistantImage) => {
            const storedImage = image.storageKey ? { url: image.dataUrl, storageKey: image.storageKey, width: 1, height: 1, bytes: 0, mimeType: "image/png" } : await uploadImage(image.dataUrl);
            const meta = storedImage.width === 1 && storedImage.height === 1 ? await readImageMeta(storedImage.url) : storedImage;
            const config = fitNodeSize(meta.width, meta.height);
            const center = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
            const id = `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const node: CanvasNodeData = {
                id,
                type: CanvasNodeType.Image,
                title: image.prompt.slice(0, 32) || "Generated Image",
                position: { x: center.x - config.width / 2, y: center.y - config.height / 2 },
                width: config.width,
                height: config.height,
                metadata: { ...imageMetadata({ ...storedImage, width: meta.width, height: meta.height }), prompt: image.prompt },
            };

            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([id]));
            setSelectedConnectionId(null);
            setDialogNodeId(id);
        },
        [screenToCanvas, size.height, size.width],
    );

    const insertAssistantText = useCallback(
        (text: string) => {
            const center = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
            const node = {
                ...createCanvasNode(CanvasNodeType.Text, center, { content: text, status: NODE_STATUS_SUCCESS }),
                title: text.slice(0, 32) || "Assistant Text",
            };

            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([node.id]));
            setSelectedConnectionId(null);
        },
        [screenToCanvas, size.height, size.width],
    );

    const handleAssetInsert = useCallback(
        (payload: InsertAssetPayload) => {
            if (payload.kind === "text") {
                insertAssistantText(payload.content);
            } else if (payload.kind === "video") {
                const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Video];
                const center = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
                const id = `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const nextSize = fitNodeSize(payload.width || spec.width, payload.height || spec.height, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                setNodes((prev) => [...prev, { id, type: CanvasNodeType.Video, title: payload.title, position: { x: center.x - nextSize.width / 2, y: center.y - nextSize.height / 2 }, width: nextSize.width, height: nextSize.height, metadata: { content: payload.url, storageKey: payload.storageKey, status: NODE_STATUS_SUCCESS, naturalWidth: payload.width, naturalHeight: payload.height } }]);
                setSelectedNodeIds(new Set([id]));
            } else {
                insertAssistantImage({ id: `asset-${Date.now()}`, prompt: payload.title, dataUrl: payload.dataUrl, storageKey: payload.storageKey });
            }
            setAssetPickerOpen(false);
        },
        [insertAssistantImage, insertAssistantText, screenToCanvas, size.height, size.width],
    );

    const assistantOpen = assistantMounted && !assistantCollapsed;
    const openAgent = useCallback(
        (mode: CanvasAgentMode = agentMode) => {
            if (agentCloseTimerRef.current) {
                clearTimeout(agentCloseTimerRef.current);
                agentCloseTimerRef.current = null;
            }
            setAgentMode(mode);
            setAssistantMounted(true);
            setAssistantClosing(false);
            setAssistantCollapsed(false);
        },
        [agentMode],
    );
    const closeAgent = useCallback(() => {
        if (!assistantMounted || assistantClosing) return;
        setAssistantCollapsed(true);
        setAssistantClosing(true);
        agentCloseTimerRef.current = setTimeout(() => {
            agentCloseTimerRef.current = null;
            setAssistantMounted(false);
            setAssistantClosing(false);
        }, CANVAS_AGENT_PANEL_MOTION_MS);
    }, [assistantClosing, assistantMounted]);

    useEffect(
        () => () => {
            if (agentCloseTimerRef.current) clearTimeout(agentCloseTimerRef.current);
        },
        [],
    );

    useEffect(() => {
        if (!projectLoaded || !codexAutoConnect) return;
        if (searchParams.has("agentUrl")) {
            setAgentMode("local");
            return;
        }
        openAgent("local");
    }, [codexAutoConnect, openAgent, projectLoaded, searchParams]);

    if (!projectLoaded) return <CanvasRefreshShell />;

    return (
        <main className="flex h-full min-h-0 overflow-hidden" style={{ background: theme.canvas.background, color: theme.node.text }}>
            <section className="relative min-w-0 flex-1 overflow-hidden">
                <CanvasTopBar
                    title={currentProject?.title || "未命名画布"}
                    titleDraft={titleDraft}
                    isTitleEditing={titleEditing}
                    onTitleDraftChange={setTitleDraft}
                    onStartTitleEditing={startTitleEditing}
                    onFinishTitleEditing={finishTitleEditing}
                    onCancelTitleEditing={() => setTitleEditing(false)}
                    canUndo={historyState.canUndo}
                    canRedo={historyState.canRedo}
                    onHome={() => router.push("/")}
                    onProjects={() => router.push("/canvas")}
                    onCreateProject={createAndOpenProject}
                    onDeleteProject={deleteCurrentProject}
                    onImportImage={() => handleUploadRequest()}
                    onUndo={undoCanvas}
                    onRedo={redoCanvas}
                    agentOpen={assistantOpen}
                    compactAgentStatus={codexCompactAgent ? { connected: localAgentConnected, enabled: localAgentEnabled, activity: localAgentActivity } : undefined}
                    onToggleAgent={() => (assistantOpen ? closeAgent() : openAgent())}
                />

                <InfiniteCanvas
                    containerRef={containerRef}
                    viewport={viewport}
                    backgroundMode={backgroundMode}
                    onViewportChange={(next) => {
                        setViewport(next);
                        setContextMenu(null);
                    }}
                    onCanvasMouseDown={handleCanvasMouseDown}
                    onCanvasDeselect={deselectCanvas}
                    onCanvasDoubleClick={handleCanvasDoubleClick}
                    onContextMenu={preventCanvasContextMenu}
                    onDrop={handleDrop}
                >
                    <svg className="absolute left-0 top-0 h-[10000px] w-[10000px] overflow-visible" style={{ pointerEvents: "none", transform: "translateZ(0)", zIndex: 0 }}>
                        {connections
                            .filter((connection) => {
                                const from = nodeById.get(connection.fromNodeId);
                                const to = nodeById.get(connection.toNodeId);
                                return Boolean(from && to && !isHiddenBatchConnectionEndpoint(from, nodes) && !isHiddenBatchConnectionEndpoint(to, nodes));
                            })
                            .map((connection) => {
                                const from = nodeById.get(connection.fromNodeId);
                                const to = nodeById.get(connection.toNodeId);
                                if (!from || !to) return null;

                                return (
                                    <ConnectionPath
                                        key={connection.id}
                                        connection={connection}
                                        from={from}
                                        to={to}
                                        active={selectedConnectionId === connection.id || relatedHighlight.connectionIds.has(connection.id)}
                                        onSelect={() => {
                                            setSelectedConnectionId(connection.id);
                                            setSelectedNodeIds(new Set());
                                            setSelectedGroupId(null);
                                            setContextMenu(null);
                                        }}
                                        onContextMenu={(event) => {
                                            setSelectedConnectionId(connection.id);
                                            setSelectedNodeIds(new Set());
                                            setSelectedGroupId(null);
                                            setContextMenu({ type: "connection", x: event.clientX, y: event.clientY, connectionId: connection.id });
                                        }}
                                        onDelete={() => {
                                            setConnections((prev) => prev.filter((conn) => conn.id !== connection.id));
                                            setSelectedConnectionId((current) => (current === connection.id ? null : current));
                                        }}
                                    />
                                );
                            })}
                        {connectingParams ? <ActiveConnectionPath node={nodeById.get(connectingParams.nodeId)} handle={connectingParams} mouseWorld={mouseWorld} target={connectionTargetNodeId ? nodeById.get(connectionTargetNodeId) : undefined} /> : null}
                    </svg>

                    {groupFrames.map(({ group, bounds, nodeCount }) => (
                        <CanvasGroupFrame
                            key={group.id}
                            group={group}
                            bounds={bounds}
                            nodeCount={nodeCount}
                            scale={viewport.k}
                            selected={selectedGroupId === group.id}
                            onSelect={() => {
                                setSelectedGroupId(group.id);
                                setSelectedNodeIds(new Set());
                                setSelectedConnectionId(null);
                                setContextMenu(null);
                            }}
                            onDragStart={(event) => handleGroupMouseDown(event, group.id)}
                            onRename={(title) => renameGroup(group.id, title)}
                            onColorChange={(color) => updateGroupColor(group.id, color)}
                            onArrange={(mode) => arrangeGroupNodes(group.id, mode)}
                            onRun={() => runGroupNodes(group.id)}
                            onBatchDownload={() => downloadGroupMedia(group.id)}
                            onUngroup={() => ungroup(group.id)}
                            onResizeStart={(event, corner) => handleGroupResizeStart(event, group.id, corner)}
                        />
                    ))}

                    {visibleNodes.map((node) => (
                        <CanvasNode
                            key={node.id}
                            data={node}
                            scale={viewport.k}
                            isSelected={selectedNodeIds.has(node.id)}
                            isRelated={relatedHighlight.nodeIds.has(node.id)}
                            isFocusRelated={activeNodeId === node.id}
                            isConnectionTarget={connectionTargetNodeId === node.id}
                            isConnecting={Boolean(connectingParams)}
                            isRunning={runningNodeId === node.id}
                            editRequestNonce={editingNodeId === node.id ? editRequestNonce : 0}
                            showPanel={dialogNodeId === node.id && !selectionBox}
                            batchCount={batchChildCountById.get(node.id) || 0}
                            batchExpanded={Boolean(node.metadata?.imageBatchExpanded)}
                            batchClosing={Boolean(node.metadata?.batchRootId && collapsingBatchIds.has(node.metadata.batchRootId))}
                            batchOpening={openingBatchIds.has(node.id)}
                            batchRecovering={collapsingBatchIds.has(node.id)}
                            batchMotion={batchMotionById.get(node.id)}
                            showImageInfo={showImageInfo}
                            upstreamImagePreviews={upstreamImagePreviewsById.get(node.id) || []}
                            resourceLabel={resourceReferenceByNodeId.get(node.id)}
                            mentionReferences={mentionReferencesByNodeId.get(node.id) || []}
                            storyboardSubjectReferences={storyboardSubjectReferencesById.get(node.id) || []}
                            renderPanel={(panelNode) =>
                                panelNode.type === CanvasNodeType.SubjectBoard ? (
                                    renderSubjectGenerationPanel(panelNode)
                                ) : panelNode.type === CanvasNodeType.Storyboard ? (
                                    renderStoryboardGenerationPanel(panelNode)
                                ) : isAgentNode(panelNode) ? (
                                    <CanvasAgentNodePanel
                                        node={panelNode}
                                        isRunning={runningNodeId === panelNode.id}
                                        inputSummary={getInputSummary(agentInputsById.get(panelNode.id) || [])}
                                        inputs={agentInputsById.get(panelNode.id) || []}
                                        onConfigChange={handleConfigNodeChange}
                                        onRun={handleRunAgentNode}
                                    />
                                ) : (
                                    <CanvasNodePromptPanel
                                        node={panelNode}
                                        isRunning={runningNodeId === panelNode.id}
                                        upstreamInputs={generationInputsById.get(panelNode.id) || []}
                                        upstreamVideoRefs={videoUpstreamRefsById.get(panelNode.id) || []}
                                        storyboardShots={storyboardShotOptionsById.get(panelNode.id) || []}
                                        mentionReferences={mentionReferencesByNodeId.get(panelNode.id) || []}
                                        onPromptChange={handleNodePromptChange}
                                        onConfigChange={handleConfigNodeChange}
                                        onGenerate={handleGenerateNode}
                                        onReferenceUpload={uploadTextReference}
                                        onReferenceInsert={insertTextReferenceAsset}
                                        onImageSettingsOpenChange={(open) => {
                                            setNodeImageSettingsOpen(open);
                                            if (open) setToolbarNodeId(null);
                                        }}
                                    />
                                )
                            }
                            renderNodeContent={(contentNode) => (
                                <CanvasConfigNodePanel
                                    node={contentNode}
                                    isRunning={runningNodeId === contentNode.id}
                                    inputs={configInputsById.get(contentNode.id) || []}
                                    upstreamVideoRefs={videoUpstreamRefsById.get(contentNode.id) || []}
                                    mentionReferences={mentionReferencesByNodeId.get(contentNode.id) || []}
                                    onPromptChange={handleNodePromptChange}
                                    onConfigChange={handleConfigNodeChange}
                                    onGenerate={handleGenerateNode}
                                    onReferenceUpload={uploadTextReference}
                                    onReferenceInsert={insertTextReferenceAsset}
                                    onImageSettingsOpenChange={(open) => {
                                        setNodeImageSettingsOpen(open);
                                        if (open) setToolbarNodeId(null);
                                    }}
                                />
                            )}
                            onMouseDown={handleNodeMouseDown}
                            onHoverStart={(nodeId) => {
                                if (nodeDraggingRef.current) return;
                                setHoveredNodeId(nodeId);
                                keepNodeToolbar(nodeId);
                            }}
                            onHoverEnd={(nodeId) => {
                                setHoveredNodeId((current) => (current === nodeId ? null : current));
                                hideNodeToolbar();
                            }}
                            onConnectStart={handleConnectStart}
                            onResize={handleNodeResize}
                            onRename={renameNode}
                            onMetadataChange={handleConfigNodeChange}
                            onContentChange={handleNodeContentChange}
                            onToggleBatch={toggleBatchExpanded}
                            onSetBatchPrimary={setBatchPrimary}
                            onRetry={(node) => void handleRetryNode(node)}
                            onGenerateImage={generateImageFromTextNode}
                            onViewImage={(node) => setPreviewNodeId(node.id)}
                            onTextModeSelect={selectTextMode}
                            onToggleTextExpanded={toggleTextExpanded}
                            onSendNode={sendNodeToNext}
                            shortDramaNextLabel={shortDramaNextLabel(node)}
                            onShortDramaNext={createShortDramaNextFromNode}
                            onOpenBoardMediaEditor={(target) => {
                                setBoardMediaEditor(target);
                                setBoardMediaReturnFullscreenNodeId(null);
                            }}
                            onOpenFullscreen={(node) => setFullscreenNodeId(node.id)}
                            onContextMenu={(event, id) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setContextMenu({ type: "node", x: event.clientX, y: event.clientY, nodeId: id });
                            }}
                        />
                    ))}

                    {selectionBox ? (
                        <div
                            className="pointer-events-none absolute z-[100] border"
                            style={{
                                left: Math.min(selectionBox.startWorldX, selectionBox.currentWorldX),
                                top: Math.min(selectionBox.startWorldY, selectionBox.currentWorldY),
                                width: Math.abs(selectionBox.currentWorldX - selectionBox.startWorldX),
                                height: Math.abs(selectionBox.currentWorldY - selectionBox.startWorldY),
                                borderColor: theme.canvas.selectionStroke,
                                background: theme.canvas.selectionFill,
                            }}
                        />
                    ) : null}
                    {selectedNodesBounds && !selectionBox ? (
                        <SelectionToolbarFrame bounds={selectedNodesBounds} scale={viewport.k} theme={theme} onDragStart={handleSelectionFrameMouseDown} onArrange={arrangeSelectedNodes} onSaveAssets={saveSelectedNodesAsAssets} onDuplicate={duplicateSelectedNodes} onGroup={createGroupFromSelection} />
                    ) : null}
                    {pendingConnectionCreate ? <ConnectionCreateMenu pending={pendingConnectionCreate} onCreate={(type) => createConnectedNode(type, pendingConnectionCreate)} onClose={cancelPendingConnectionCreate} /> : null}
                </InfiniteCanvas>

                <CanvasNodeHoverToolbar
                    node={isNodeDragging || nodeImageSettingsOpen ? null : activeToolbarNode}
                    viewport={viewport}
                    onKeep={keepNodeToolbar}
                    onLeave={hideNodeToolbar}
                    onInfo={(node) => setInfoNodeId(node.id)}
                    onEditText={openTextEditor}
                    onDecreaseFont={(node) => handleFontSizeChange(node.id, Math.max(10, (node.metadata?.fontSize || 14) - 2))}
                    onIncreaseFont={(node) => handleFontSizeChange(node.id, Math.min(32, (node.metadata?.fontSize || 14) + 2))}
                    onMetadataChange={handleConfigNodeChange}
                    onContentChange={handleNodeContentChange}
                    onToggleTextExpanded={toggleTextExpanded}
                    onToggleDialog={(node) => setDialogNodeId((current) => (current === node.id ? null : node.id))}
                    onGenerateImage={generateImageFromTextNode}
                    onUpload={(node) => handleUploadRequest(node.id)}
                    onDownload={downloadNodeImage}
                    onSaveAsset={(node) => void saveNodeAsset(node)}
                    onMaskEdit={(node) => setMaskEditNodeId(node.id)}
                    onCrop={(node) => setCropNodeId(node.id)}
                    onUpscale={(node) => setUpscaleNodeId(node.id)}
                    onSuperResolve={(node) => setSuperResolveNodeId(node.id)}
                    onAngle={(node) => setAngleNodeId(node.id)}
                    onViewImage={(node) => setPreviewNodeId(node.id)}
                    onReversePrompt={createImageReversePromptNodes}
                    onRetry={(node) => void handleRetryNode(node)}
                    onToggleFreeResize={(node) => toggleNodeFreeResize(node.id)}
                    onDelete={(node) => deleteNodes(new Set([node.id]))}
                />

                <CanvasToolbar
                    selectedCount={selectedNodeIds.size}
                    canUndo={historyState.canUndo}
                    canRedo={historyState.canRedo}
                    backgroundMode={backgroundMode}
                    showImageInfo={showImageInfo}
                    onAddImage={() => createNode(CanvasNodeType.Image)}
                    onAddVideo={() => createNode(CanvasNodeType.Video)}
                    onAddAudio={() => createNode(CanvasNodeType.Audio)}
                    onAddText={() => createNode(CanvasNodeType.Text)}
                    onAddAgent={() => createNode(CanvasNodeType.Agent)}
                    onAddConfig={() => createNode(CanvasNodeType.Config)}
                    onUndo={undoCanvas}
                    onRedo={redoCanvas}
                    onUpload={() => handleUploadRequest()}
                    onGroupSelected={createGroupFromSelection}
                    onDelete={() => deleteNodes(new Set(selectedNodeIds))}
                    onClear={() => setClearConfirmOpen(true)}
                    onDeselect={deselectCanvas}
                    onBackgroundModeChange={setBackgroundMode}
                    onShowImageInfoChange={setShowImageInfo}
                    onOpenAssetLibrary={() => {
                        setAssetPickerTab("library");
                        setAssetPickerOpen(true);
                    }}
                    onOpenMyAssets={() => {
                        setAssetPickerTab("my-assets");
                        setAssetPickerOpen(true);
                    }}
                />

                <CanvasShortDramaNav activeNode={activeShortDramaStepType ? { stepType: activeShortDramaStepType, title: activeShortDramaNode?.title } : null} recommendedTypes={activeShortDramaNextTypes} onCreateNode={createShortDramaStep} onCreateFlow={createShortDramaFlow} />

                {isMiniMapOpen ? <Minimap nodes={nodes} viewport={viewport} viewportSize={size} onViewportChange={setViewport} /> : null}

                <CanvasZoomControls scale={viewport.k} onScaleChange={setZoomScale} onReset={resetViewport} isMiniMapOpen={isMiniMapOpen} onToggleMiniMap={() => setIsMiniMapOpen((value) => !value)} />

                {contextMenu ? (
                    <CanvasNodeContextMenu
                        menu={contextMenu}
                        onClose={() => setContextMenu(null)}
                        onDuplicate={() => {
                            if (contextMenu.type !== "node") return;
                            duplicateNode(contextMenu.nodeId);
                            setContextMenu(null);
                        }}
                        onDelete={() => {
                            if (contextMenu.type === "node") {
                                deleteNodes(new Set([contextMenu.nodeId]));
                            } else {
                                deleteConnection(contextMenu.connectionId);
                            }
                            setContextMenu(null);
                        }}
                    />
                ) : null}

                <input ref={imageInputRef} type="file" accept="image/*,video/*,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav" className="hidden" onChange={handleImageInputChange} />

                <CanvasNodeInfoModal node={infoNode} open={Boolean(infoNode)} onClose={() => setInfoNodeId(null)} />

                {cropNode?.metadata?.content ? <CanvasNodeCropDialog dataUrl={cropNode.metadata.content} open={Boolean(cropNode)} onClose={() => setCropNodeId(null)} onConfirm={(crop) => void cropImageNode(cropNode!, crop)} /> : null}

                {maskEditNode?.metadata?.content ? <CanvasNodeMaskEditDialog dataUrl={maskEditNode.metadata.content} open={Boolean(maskEditNode)} onClose={() => setMaskEditNodeId(null)} onConfirm={(payload) => void maskEditImageNode(maskEditNode!, payload)} /> : null}

                {upscaleNode?.metadata?.content ? <CanvasNodeUpscaleDialog dataUrl={upscaleNode.metadata.content} open={Boolean(upscaleNode)} onClose={() => setUpscaleNodeId(null)} onConfirm={(params) => void upscaleImageNode(upscaleNode!, params)} /> : null}

                <Modal title="AI 超分" open={Boolean(superResolveNode?.metadata?.content)} centered footer={null} onCancel={() => setSuperResolveNodeId(null)}>
                    <div className="py-8 text-center text-base font-medium">暂未实现</div>
                </Modal>

                {angleNode?.metadata?.content ? <CanvasNodeAngleDialog dataUrl={angleNode.metadata.content} open={Boolean(angleNode)} onClose={() => setAngleNodeId(null)} onConfirm={(params) => void generateAngleNode(angleNode!, params)} /> : null}

                <Modal
                    title="图片详情"
                    open={Boolean(previewNode?.metadata?.content)}
                    centered
                    onCancel={() => setPreviewNodeId(null)}
                    footer={null}
                    width="auto"
                    styles={{ body: { padding: 0, display: "flex", justifyContent: "center", alignItems: "center", maxHeight: "80vh" } }}
                >
                    {previewNode?.metadata?.content ? (
                        <img
                            src={previewNode.metadata.content}
                            alt={previewNode.title || "图片"}
                            style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }}
                        />
                    ) : null}
                </Modal>

                <Modal
                    title="清空画布？"
                    open={clearConfirmOpen}
                    centered
                    onCancel={() => setClearConfirmOpen(false)}
                    footer={
                        <>
                            <Button onClick={() => setClearConfirmOpen(false)}>取消</Button>
                            <Button danger type="primary" onClick={clearCanvas}>
                                清空
                            </Button>
                        </>
                    }
                >
                    <p className="text-sm opacity-60">这会删除当前画布上的所有节点和连线。</p>
                </Modal>

                <AssetPickerModal open={assetPickerOpen} defaultTab={assetPickerTab} onInsert={handleAssetInsert} onClose={() => setAssetPickerOpen(false)} />
                {fullscreenNode && (fullscreenNode.type === CanvasNodeType.Text || fullscreenNode.type === CanvasNodeType.ProjectBrief || fullscreenNode.type === CanvasNodeType.SubjectBoard || fullscreenNode.type === CanvasNodeType.Storyboard) ? (
                    <CanvasNodeFullscreenEditor
                        node={fullscreenNode}
                        theme={theme}
                        onClose={() => setFullscreenNodeId(null)}
                        onContentChange={handleNodeContentChange}
                        onMetadataChange={handleConfigNodeChange}
                        subjectReferences={storyboardSubjectReferencesById.get(fullscreenNode.id) || []}
                        onOpenMediaEditor={(target) => {
                            setBoardMediaEditor(target);
                            setBoardMediaReturnFullscreenNodeId(fullscreenNode.id);
                            setFullscreenNodeId(null);
                        }}
                    />
                ) : null}
                {boardMediaEditor && boardMediaNode ? (
                    (() => {
                        const details = getBoardMediaDetails(boardMediaNode, boardMediaEditor);
                        const key = boardMediaKey(boardMediaEditor);
                        const panelNode = buildBoardMediaPanelNode(boardMediaNode, boardMediaEditor, boardMediaDrafts[key]);
                        return details && panelNode ? (
                            <BoardMediaFullscreenEditor
                                node={boardMediaNode}
                                target={boardMediaEditor}
                                panelNode={panelNode}
                                details={details}
                                theme={theme}
                                isRunning={runningNodeId === key}
                                onClose={() => {
                                    setBoardMediaEditor(null);
                                    setBoardMediaReturnFullscreenNodeId(null);
                                }}
                                onBack={
                                    boardMediaReturnFullscreenNodeId
                                        ? () => {
                                              setBoardMediaEditor(null);
                                              setFullscreenNodeId(boardMediaReturnFullscreenNodeId);
                                              setBoardMediaReturnFullscreenNodeId(null);
                                          }
                                        : undefined
                                }
                                onSelectSlot={selectBoardMediaSlot}
                                onDescriptionChange={(target, value) =>
                                    setNodes((prev) =>
                                        prev.map((node) => {
                                            if (node.id !== target.nodeId) return node;
                                            if (target.boardType === "subject") return patchSubjectBoardItem(node, target.groupId, target.itemId, { description: value });
                                            return patchStoryboardShot(node, target.shotId, { description: value });
                                        }),
                                    )
                                }
                                onPromptChange={updateBoardMediaPrompt}
                                onConfigChange={updateBoardMediaConfig}
                                onGenerate={(target, mode, prompt) => void handleGenerateBoardMedia(target, mode, prompt)}
                            />
                        ) : null;
                    })()
                ) : null}
                {codexCompactAgent && !assistantMounted ? <CanvasLocalAgentPanel headless snapshot={agentSnapshot} canUndoOps={Boolean(agentUndoSnapshot)} onApplyOps={applyAgentOps} onUndoOps={undoAgentOps} autoConnect={codexAutoConnect} /> : null}
            </section>
            {assistantMounted ? (
                <CanvasAssistantPanel
                    nodes={nodes}
                    selectedNodeIds={selectedNodeIds}
                    snapshot={agentSnapshot}
                    sessions={chatSessions}
                    activeSessionId={activeChatId}
                    onSelectNodeIds={setSelectedNodeIds}
                    onSessionsChange={handleAssistantSessionsChange}
                    onApplyOps={applyAgentOps}
                    canUndoOps={Boolean(agentUndoSnapshot)}
                    onUndoOps={undoAgentOps}
                    onPasteImage={pasteAssistantImage}
                    agentMode={agentMode}
                    onAgentModeChange={setAgentMode}
                    autoConnectLocal={codexAutoConnect}
                    closing={assistantClosing}
                    onCollapse={closeAgent}
                />
            ) : null}
        </main>
    );
}

function CanvasNodeFullscreenEditor({
    node,
    theme,
    onClose,
    onContentChange,
    onMetadataChange,
    subjectReferences,
    onOpenMediaEditor,
}: {
    node: CanvasNodeData;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    onClose: () => void;
    onContentChange: (nodeId: string, content: string) => void;
    onMetadataChange: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    subjectReferences: CanvasStoryboardReference[];
    onOpenMediaEditor: (target: CanvasBoardMediaEditorTarget) => void;
}) {
    return (
        <div className="fixed inset-0 z-[120] flex flex-col" style={{ background: theme.canvas.background, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <FullscreenHeader title={node.title} meta={nodeTypeName(node.type)} theme={theme} onClose={onClose} />
            <div className="min-h-0 flex-1 overflow-hidden p-4">
                {node.type === CanvasNodeType.Text ? (
                    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3">
                        <CanvasFullscreenTextToolbar format={node.metadata} theme={theme} onFormatChange={(patch) => onMetadataChange(node.id, patch)} />
                        <textarea
                            className="thin-scrollbar min-h-0 flex-1 resize-none rounded-xl border bg-transparent p-6 leading-7 outline-none"
                            style={{ ...canvasFullscreenTextStyle(node.metadata, theme), borderColor: theme.toolbar.border }}
                            value={node.metadata?.content || ""}
                            onChange={(event) => onContentChange(node.id, event.target.value)}
                        />
                    </div>
                ) : node.type === CanvasNodeType.ProjectBrief ? (
                    <div className="mx-auto h-full w-full max-w-6xl overflow-hidden rounded-xl border" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                        <ProjectBriefNodeContent node={node} theme={theme} onMetadataChange={onMetadataChange} fullscreen />
                    </div>
                ) : node.type === CanvasNodeType.SubjectBoard ? (
                    <div className="h-full overflow-hidden rounded-xl border" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                        <SubjectBoardNodeContent node={node} theme={theme} onMetadataChange={onMetadataChange} onOpenMediaEditor={onOpenMediaEditor} fullscreen />
                    </div>
                ) : node.type === CanvasNodeType.Storyboard ? (
                    <div className="h-full overflow-hidden rounded-xl border" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                        <StoryboardNodeContent node={node} theme={theme} onMetadataChange={onMetadataChange} onOpenMediaEditor={onOpenMediaEditor} subjectReferences={subjectReferences} fullscreen />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function BoardMediaFullscreenEditor({
    node,
    target,
    panelNode,
    details,
    theme,
    isRunning,
    onClose,
    onBack,
    onSelectSlot,
    onDescriptionChange,
    onPromptChange,
    onConfigChange,
    onGenerate,
}: {
    node: CanvasNodeData;
    target: CanvasBoardMediaEditorTarget;
    panelNode: CanvasNodeData;
    details: NonNullable<ReturnType<typeof getBoardMediaDetails>>;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    isRunning: boolean;
    onClose: () => void;
    onBack?: () => void;
    onSelectSlot: (target: CanvasBoardMediaEditorTarget, slot: CanvasMediaSlot) => void;
    onDescriptionChange: (target: CanvasBoardMediaEditorTarget, value: string) => void;
    onPromptChange: (target: CanvasBoardMediaEditorTarget, prompt: string) => void;
    onConfigChange: (target: CanvasBoardMediaEditorTarget, patch: Partial<CanvasNodeMetadata>) => void;
    onGenerate: (target: CanvasBoardMediaEditorTarget, mode: CanvasNodeGenerationMode, prompt: string) => void;
}) {
    const mediaItems = doneMediaItems(details.slot, details.history);
    const current = details.slot?.status === "done" && details.slot.url ? details.slot : mediaItems.at(-1);
    const isImage = target.kind === "image";

    return (
        <div className="fixed inset-0 z-[130] flex flex-col" style={{ background: theme.canvas.background, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <FullscreenHeader title={details.title} meta={`${node.title || nodeTypeName(node.type)} / ${isImage ? "图片编辑" : "视频编辑"}`} theme={theme} onClose={onClose} onBack={onBack} />
            <div className="grid min-h-0 flex-1 grid-cols-[180px_minmax(360px,1fr)_630px] gap-4 p-4">
                <aside className="thin-scrollbar min-h-0 overflow-y-auto rounded-xl border p-2" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                    <div className="mb-2 px-1 text-xs font-semibold" style={{ color: theme.node.muted }}>
                        已生成
                    </div>
                    <div className="space-y-2">
                        {mediaItems.length ? (
                            mediaItems.map((item) => (
                                <button key={item.url} type="button" className="block aspect-video w-full overflow-hidden rounded-lg border" style={{ borderColor: item.url === current?.url ? theme.node.activeStroke : theme.node.stroke, background: theme.toolbar.panel }} onClick={() => onSelectSlot(target, item)}>
                                    {isImage ? <img src={item.url} alt="历史图片" className="h-full w-full object-cover" /> : <video src={item.url} muted className="h-full w-full object-cover" />}
                                </button>
                            ))
                        ) : (
                            <div className="rounded-lg border px-2 py-8 text-center text-xs" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                                暂无结果
                            </div>
                        )}
                    </div>
                </aside>

                <main className="flex min-h-0 items-center justify-center overflow-hidden rounded-xl border" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                    {current?.url ? isImage ? <img src={current.url} alt={details.title} className="max-h-full max-w-full object-contain" /> : <video src={current.url} controls className="max-h-full max-w-full object-contain" /> : <div className="text-sm" style={{ color: theme.node.placeholder }}>暂无{isImage ? "图片" : "视频"}</div>}
                </main>

                <aside className="flex min-h-0 flex-col gap-3">
                    <section className="rounded-xl border p-3" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                        <div className="mb-2 text-xs font-semibold" style={{ color: theme.node.muted }}>
                            {target.boardType === "storyboard" ? "分镜描述" : "角色/场景/道具描述"}
                        </div>
                        <textarea className="thin-scrollbar h-32 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm leading-6 outline-none" style={{ borderColor: theme.node.stroke, color: theme.node.text }} value={details.description} onChange={(event) => onDescriptionChange(target, event.target.value)} />
                    </section>
                    <section className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden rounded-xl border p-3" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}>
                        <CanvasNodePromptPanel
                            node={panelNode}
                            isRunning={isRunning}
                            modeOverride={target.kind}
                            embedded
                            keepPromptAfterSubmit
                            promptCollapsedClassName="!h-48"
                            promptExpandedClassName="!h-[calc(100vh-390px)]"
                            upstreamVideoRefs={!isImage && details.imageUrl ? [{ id: `${target.nodeId}-cover`, url: details.imageUrl, storageKey: details.imageUrl.startsWith("image:") ? details.imageUrl : undefined }] : []}
                            onPromptChange={(_nodeId, prompt) => onPromptChange(target, prompt)}
                            onConfigChange={(_nodeId, patch) => onConfigChange(target, patch)}
                            onGenerate={(_nodeId, mode, prompt) => onGenerate(target, mode, prompt)}
                        />
                    </section>
                </aside>
            </div>
        </div>
    );
}

function FullscreenHeader({ title, meta, theme, onClose, onBack }: { title: string; meta: string; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onClose: () => void; onBack?: () => void }) {
    return (
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-5" style={{ borderColor: theme.toolbar.border, background: theme.toolbar.panel }}>
            <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{title}</div>
                <div className="truncate text-[11px]" style={{ color: theme.node.muted }}>
                    {meta}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {onBack ? (
                    <Button className="!grid !size-9 !place-items-center !rounded-full !p-0" title="返回全屏板" aria-label="返回全屏板" onClick={onBack}>
                        <ArrowLeft className="size-4" />
                    </Button>
                ) : null}
                <Button className="!grid !size-9 !place-items-center !rounded-full !p-0" title="关闭" aria-label="关闭" onClick={onClose}>
                    <X className="size-4" />
                </Button>
            </div>
        </header>
    );
}

function nodeTypeName(type: CanvasNodeType) {
    if (type === CanvasNodeType.Text) return "文本节点";
    if (type === CanvasNodeType.Agent) return "智能体节点";
    if (type === CanvasNodeType.ScriptAgent) return "剧本Agent";
    if (type === CanvasNodeType.CharacterAgent) return "角色Agent";
    if (type === CanvasNodeType.StoryboardAgent) return "分镜Agent";
    if (type === CanvasNodeType.ProjectBrief) return "故事设定";
    if (type === CanvasNodeType.SubjectBoard) return "角色板";
    if (type === CanvasNodeType.Storyboard) return "分镜板";
    return "画布节点";
}

function CanvasTopBar({
    title,
    titleDraft,
    isTitleEditing,
    onTitleDraftChange,
    onStartTitleEditing,
    onFinishTitleEditing,
    onCancelTitleEditing,
    canUndo,
    canRedo,
    onHome,
    onProjects,
    onCreateProject,
    onDeleteProject,
    onImportImage,
    onUndo,
    onRedo,
    agentOpen,
    compactAgentStatus,
    onToggleAgent,
}: {
    title: string;
    titleDraft: string;
    isTitleEditing: boolean;
    onTitleDraftChange: (value: string) => void;
    onStartTitleEditing: () => void;
    onFinishTitleEditing: () => void;
    onCancelTitleEditing: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onHome: () => void;
    onProjects: () => void;
    onCreateProject: () => void;
    onDeleteProject: () => void;
    onImportImage: () => void;
    onUndo: () => void;
    onRedo: () => void;
    agentOpen: boolean;
    compactAgentStatus?: { connected: boolean; enabled: boolean; activity: string };
    onToggleAgent: () => void;
}) {
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const titleRef = useRef<HTMLDivElement>(null);
    const accountRef = useRef<HTMLDivElement>(null);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);

    useEffect(() => {
        if (!isTitleEditing) return;
        const close = (event: PointerEvent) => {
            if (!titleRef.current?.contains(event.target as Node)) onFinishTitleEditing();
        };
        document.addEventListener("pointerdown", close, true);
        return () => document.removeEventListener("pointerdown", close, true);
    }, [isTitleEditing, onFinishTitleEditing]);

    useEffect(() => {
        if (!accountOpen) return;
        const close = (event: PointerEvent) => {
            if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
        };
        document.addEventListener("pointerdown", close, true);
        return () => document.removeEventListener("pointerdown", close, true);
    }, [accountOpen]);

    return (
        <>
            <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex h-16 items-center justify-between px-4">
                <div className="pointer-events-auto flex min-w-0 items-center gap-3">
                    <Dropdown
                        trigger={["click"]}
                        menu={{
                            items: [
                                { key: "home", icon: <Home className="size-4" />, label: "主页", onClick: onHome },
                                { key: "projects", icon: <Images className="size-4" />, label: "我的画布", onClick: onProjects },
                                { type: "divider" },
                                { key: "new", icon: <Plus className="size-4" />, label: "新建画布", onClick: onCreateProject },
                                { key: "delete", danger: true, icon: <Trash2 className="size-4" />, label: "删除当前画布", onClick: onDeleteProject },
                                { type: "divider" },
                                { key: "import", icon: <Upload className="size-4" />, label: "导入素材", onClick: onImportImage },
                                { type: "divider" },
                                { key: "undo", disabled: !canUndo, icon: <Undo2 className="size-4" />, label: <MenuLabel text="撤销" shortcut="⌘ Z" />, onClick: onUndo },
                                { key: "redo", disabled: !canRedo, icon: <Redo2 className="size-4" />, label: <MenuLabel text="重做" shortcut="⌘ ⇧ Z / ⌘ Y" />, onClick: onRedo },
                            ],
                        }}
                    >
                        <button type="button" className="grid size-9 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.text }} aria-label="打开画布菜单">
                            <Menu className="size-5" />
                        </button>
                    </Dropdown>

                    <div ref={titleRef} className="flex min-w-0 items-center gap-2">
                        {isTitleEditing ? (
                            <input
                                autoFocus
                                value={titleDraft}
                                onChange={(event) => onTitleDraftChange(event.target.value)}
                                onBlur={onFinishTitleEditing}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") onFinishTitleEditing();
                                    if (event.key === "Escape") onCancelTitleEditing();
                                }}
                                className="max-w-[280px] bg-transparent p-0 text-left text-lg font-semibold tracking-normal outline-none"
                                style={{ color: theme.node.text }}
                            />
                        ) : (
                            <button
                                type="button"
                                className="max-w-[280px] truncate border-b border-dashed border-transparent text-left text-lg font-semibold tracking-normal transition hover:border-current"
                                onDoubleClick={onStartTitleEditing}
                                title="双击修改画布名称"
                            >
                                {title}
                            </button>
                        )}
                    </div>
                </div>

                <div className="pointer-events-auto flex items-center gap-1.5">
                    <UserStatusActions
                        variant="canvas"
                        accountOpen={accountOpen}
                        onAccountOpenChange={setAccountOpen}
                        accountRef={accountRef}
                        getPopupContainer={(node) => node.parentElement || document.body}
                        onOpenShortcuts={() => {
                            setShortcutsOpen(true);
                            setAccountOpen(false);
                        }}
                    />
                    <span className="h-6 w-px" style={{ background: theme.toolbar.border }} />
                    <Button
                        type="text"
                        className="!h-10 !rounded-xl !px-3 !font-medium"
                        style={{ background: agentOpen ? theme.toolbar.activeBg : theme.toolbar.panel, color: theme.node.text, boxShadow: "0 10px 30px rgba(28,25,23,.10)" }}
                        icon={<Bot className="size-4" />}
                        onClick={onToggleAgent}
                    >
                        Agent
                        {compactAgentStatus ? (
                            <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-normal opacity-70">
                                <span className={`size-1.5 rounded-full ${compactAgentStatus.connected ? "bg-emerald-500" : compactAgentStatus.enabled ? "bg-amber-500" : "bg-zinc-400"}`} />
                                {compactAgentStatus.activity}
                            </span>
                        ) : null}
                    </Button>
                </div>
            </div>
            <Modal title="快捷键" open={shortcutsOpen} onCancel={() => setShortcutsOpen(false)} footer={null} centered>
                <div className="space-y-2 border-t pt-4 text-sm" style={{ borderColor: theme.node.stroke }}>
                    <Shortcut keys={["空格", "左键拖动"]} value="平移视图" />
                    <Shortcut keys={["滚轮"]} value="缩放画布" />
                    <Shortcut keys={["缩放滑杆"]} value="精确调整缩放" />
                    <Shortcut keys={["左键拖动画布"]} value="框选多个节点" />
                    <Shortcut keys={["Shift / Ctrl / Cmd", "点击"]} value="追加选择节点" />
                    <Shortcut keys={["Ctrl / Cmd", "A"]} value="全选节点" />
                    <Shortcut keys={["Ctrl / Cmd", "G"]} value="将选中节点打组" />
                    <Shortcut keys={["Ctrl / Cmd", "C / V"]} value="复制 / 粘贴节点，或粘贴剪切板文本/图片" />
                    <Shortcut keys={["Ctrl / Cmd", "Z"]} value="撤销" />
                    <Shortcut keys={["Ctrl / Cmd", "Shift", "Z"]} value="重做" />
                    <Shortcut keys={["Ctrl / Cmd", "Y"]} value="重做" />
                    <Shortcut keys={["Delete / Backspace"]} value="删除选中" />
                    <Shortcut keys={["Esc"]} value="取消选择并关闭浮层" />
                    <Shortcut keys={["拖入图片/视频/音频"]} value="上传到画布" />
                </div>
            </Modal>
        </>
    );
}

function MenuLabel({ text, shortcut }: { text: string; shortcut: string }) {
    return (
        <span className="flex min-w-36 items-center justify-between gap-8">
            <span>{text}</span>
            <span className="text-xs opacity-45">{shortcut}</span>
        </span>
    );
}

function Shortcut({ keys, value }: { keys: string[]; value: string }) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-6 rounded-lg px-1 py-1.5">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                {keys.map((key, index) => (
                    <span key={`${key}-${index}`} className="flex items-center gap-1.5">
                        {index ? <span className="text-xs opacity-35">+</span> : null}
                        <kbd
                            className="min-w-9 rounded-md border px-2.5 py-1.5 text-center text-xs font-medium leading-none shadow-[inset_0_-1px_0_rgba(0,0,0,.08),0_1px_2px_rgba(0,0,0,.06)]"
                            style={{ borderColor: "rgba(120,113,108,.28)", background: "linear-gradient(#fff, rgba(245,245,244,.92))", color: "rgb(68,64,60)" }}
                        >
                            {key}
                        </kbd>
                    </span>
                ))}
            </span>
            <span className="text-right text-sm opacity-55">{value}</span>
        </div>
    );
}

function imageExtension(dataUrl: string) {
    return dataUrl.match(/^data:image[/]([^;]+)/)?.[1] || dataUrl.match(/image[/]([^;]+)/)?.[1] || "png";
}

function audioExtension(mimeType?: string) {
    if (mimeType?.includes("wav")) return "wav";
    if (mimeType?.includes("opus")) return "opus";
    if (mimeType?.includes("aac")) return "aac";
    if (mimeType?.includes("flac")) return "flac";
    if (mimeType?.includes("pcm")) return "pcm";
    return "mp3";
}

function imageMetadata(image: UploadedImage): CanvasNodeMetadata {
    return { content: image.url, storageKey: image.storageKey, status: "success", naturalWidth: image.width, naturalHeight: image.height, bytes: image.bytes, mimeType: image.mimeType };
}

function patchStoryboardShot(node: CanvasNodeData, shotId: string, patch: Partial<CanvasStoryboardShot>): CanvasNodeData {
    const storyboard = node.metadata?.storyboard;
    if (!storyboard) return node;
    return {
        ...node,
        metadata: {
            ...node.metadata,
            storyboard: {
                shots: storyboard.shots.map((shot) => (shot.id === shotId ? { ...shot, ...patch } : shot)),
            },
            status: "success",
        },
    };
}

function patchSubjectBoardItem(node: CanvasNodeData, groupId: string, itemId: string, patch: Partial<NonNullable<CanvasSubjectBoard["groups"][number]["items"][number]>>): CanvasNodeData {
    const board = node.metadata?.subjectBoard;
    if (!board) return node;
    return {
        ...node,
        metadata: {
            ...node.metadata,
            subjectBoard: {
                groups: board.groups.map((group) => (group.id === groupId ? { ...group, items: group.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) } : group)),
            },
            status: "success",
        },
    };
}

function boardMediaKey(target: CanvasBoardMediaEditorTarget) {
    return target.boardType === "subject" ? `${target.nodeId}:subject:${target.groupId}:${target.itemId}:${target.kind}` : `${target.nodeId}:storyboard:${target.shotId}:${target.kind}`;
}

function subjectPanelTarget(node: CanvasNodeData): CanvasBoardMediaEditorTarget | null {
    const groupId = node.metadata?.subjectPanelGroupId;
    const itemId = node.metadata?.subjectPanelItemId;
    if (!groupId || !itemId) return null;
    const item = node.metadata?.subjectBoard?.groups.find((group) => group.id === groupId)?.items.find((entry) => entry.id === itemId);
    if (!item) return null;
    return { boardType: "subject", nodeId: node.id, groupId, itemId, kind: "image" };
}

function subjectBoardPromptOptions(node: CanvasNodeData): CanvasPromptSelectOption[] {
    return (node.metadata?.subjectBoard?.groups || []).flatMap((group) =>
        group.items.map((item) => ({
            value: `${group.id}:${item.id}`,
            label: `${group.title} / ${item.name || item.id}`,
            prompt: item.prompt || item.description || item.name,
        })),
    );
}

function appendMediaHistory(history: CanvasMediaSlot[] | undefined, ...slots: CanvasMediaSlot[]) {
    const items = [...(history || []), ...slots].filter((item) => item.status === "done" && item.url);
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = item.url || "";
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function doneMediaItems(current: CanvasMediaSlot | undefined, history: CanvasMediaSlot[] | undefined) {
    return appendMediaHistory(history, ...(current?.status === "done" && current.url ? [current] : []));
}

function getBoardMediaDetails(node: CanvasNodeData | null, target: CanvasBoardMediaEditorTarget | null) {
    if (!node || !target) return null;
    if (target.boardType === "subject") {
        const group = node.metadata?.subjectBoard?.groups.find((item) => item.id === target.groupId);
        const item = group?.items.find((entry) => entry.id === target.itemId);
        if (!group || !item) return null;
        const slot = target.kind === "image" ? item.image : item.video;
        const history = target.kind === "image" ? item.imageHistory : item.videoHistory;
        return {
            title: `${group.title} / ${item.name}`,
            name: item.name,
            description: item.description || "",
            prompt: item.prompt || item.description || item.name,
            slot,
            history,
            imageUrl: item.image?.status === "done" ? item.image.url : undefined,
        };
    }
    const shot = node.metadata?.storyboard?.shots.find((item) => item.id === target.shotId);
    if (!shot) return null;
    return {
        title: `镜头 ${shot.id}`,
        name: `镜头 ${shot.id}`,
        description: shot.description,
        prompt: target.kind === "image" ? shot.imagePrompt || shot.description : shot.videoPrompt || shot.description,
        slot: target.kind === "image" ? shot.image : shot.video,
        history: target.kind === "image" ? shot.imageHistory : shot.videoHistory,
        imageUrl: shot.image?.status === "done" ? shot.image.url : undefined,
    };
}

function buildBoardMediaPanelNode(node: CanvasNodeData | null, target: CanvasBoardMediaEditorTarget | null, draft: CanvasNodeMetadata | undefined): CanvasNodeData | null {
    const details = getBoardMediaDetails(node, target);
    if (!node || !target || !details) return null;
    const type = target.kind === "image" ? CanvasNodeType.Image : CanvasNodeType.Video;
    const spec = NODE_DEFAULT_SIZE[type];
    return {
        id: boardMediaKey(target),
        type,
        title: `${details.title} / ${target.kind === "image" ? "图片生成" : "视频生成"}`,
        position: node.position,
        width: spec.width,
        height: spec.height,
        metadata: {
            ...draft,
            prompt: draft?.prompt ?? details.prompt,
            content: undefined,
            status: "idle",
            videoRefMode: target.kind === "video" && details.imageUrl ? draft?.videoRefMode || "first" : draft?.videoRefMode,
        },
    };
}

function storyboardShotOptions(node: CanvasNodeData): CanvasStoryboardShotOption[] {
    return (node.metadata?.storyboard?.shots || []).map((shot) => ({
        sourceNodeId: node.id,
        shotId: shot.id,
        label: `${node.title || "分镜板"} / 镜头 ${shot.id}`,
        description: shot.description,
        imagePrompt: shot.imagePrompt,
        videoPrompt: shot.videoPrompt,
        imageUrl: shot.image?.status === "done" ? shot.image.url : undefined,
    }));
}

function buildStoryboardGenerationPanelNode(node: CanvasNodeData): CanvasNodeData | null {
    const mode = node.metadata?.storyboardPanelMode;
    const shotId = node.metadata?.storyboardPanelShotId;
    const shot = node.metadata?.storyboard?.shots.find((item) => item.id === shotId);
    if (!mode || !shot) return null;
    return {
        ...node,
        type: mode === "image" ? CanvasNodeType.Image : CanvasNodeType.Video,
        title: `${mode === "image" ? "分镜图生成" : "分镜视频生成"} / 镜头 ${shot.id}`,
        metadata: {
            ...node.metadata,
            prompt: mode === "image" ? shot.imagePrompt || shot.description : shot.videoPrompt || shot.description,
            model: mode === "image" ? node.metadata?.storyboardImageModel : node.metadata?.storyboardVideoModel,
            content: undefined,
            status: "idle",
            storyboardSourceNodeId: node.id,
            storyboardShotId: shot.id,
            videoRefMode: mode === "video" && shot.image?.status === "done" && shot.image.url ? node.metadata?.videoRefMode || "first" : node.metadata?.videoRefMode,
        },
    };
}

function applyStoryboardGenerationPanelPatch(node: CanvasNodeData, patch: Partial<CanvasNodeMetadata>): CanvasNodeData {
    const mode = node.metadata?.storyboardPanelMode || "image";
    const targetShotId = patch.storyboardShotId || patch.storyboardPanelShotId || node.metadata?.storyboardPanelShotId;
    const prompt = patch.prompt;
    const configPatch: Partial<CanvasNodeMetadata> = { ...patch, storyboardPanelShotId: targetShotId };
    delete configPatch.prompt;
    delete configPatch.storyboardSourceNodeId;
    delete configPatch.storyboardShotId;
    delete configPatch.content;
    delete configPatch.status;
    if (configPatch.model) {
        if (mode === "image") configPatch.storyboardImageModel = configPatch.model;
        else configPatch.storyboardVideoModel = configPatch.model;
        delete configPatch.model;
    }

    const storyboard = node.metadata?.storyboard;
    const nextShots =
        storyboard?.shots.map((shot) =>
            shot.id === targetShotId && prompt !== undefined ? { ...shot, ...(mode === "image" ? { imagePrompt: prompt } : { videoPrompt: prompt }) } : shot,
        ) || [];
    return { ...node, metadata: { ...node.metadata, ...configPatch, storyboard: storyboard ? { shots: nextShots } : node.metadata?.storyboard, status: "success" } };
}

function findStoryboardResultNodeId(nodes: CanvasNodeData[], sourceNodeId: string, shotId: string, mode: CanvasStoryboardGenerationMode) {
    return nodes.find((node) => node.metadata?.storyboardSourceNodeId === sourceNodeId && node.metadata?.storyboardShotId === shotId && node.metadata?.storyboardResultKind === mode)?.id;
}

function SelectionToolbarFrame({
    bounds,
    scale,
    theme,
    onDragStart,
    onArrange,
    onSaveAssets,
    onDuplicate,
    onGroup,
}: {
    bounds: { left: number; top: number; width: number; height: number };
    scale: number;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    onDragStart: (event: ReactPointerEvent<HTMLElement>) => void;
    onArrange: (mode: CanvasArrangeMode) => void;
    onSaveAssets: () => void;
    onDuplicate: () => void;
    onGroup: () => void;
}) {
    const [arrangeOpen, setArrangeOpen] = useState(false);
    const padding = 24;
    const frameLeft = bounds.left - padding;
    const frameTop = bounds.top - padding;
    const frameWidth = bounds.width + padding * 2;
    const frameHeight = bounds.height + padding * 2;
    const toolbarScale = 1 / Math.max(scale, 0.05);

    return (
        <div className="pointer-events-none absolute z-[105]" style={{ left: frameLeft, top: frameTop, width: frameWidth, height: frameHeight }}>
            <div className="pointer-events-auto absolute inset-0 cursor-move rounded-sm border border-dashed" style={{ borderColor: theme.canvas.selectionStroke, background: theme.canvas.selectionFill }} onPointerDown={onDragStart} />
            {["left-0 top-0 -translate-x-1/2 -translate-y-1/2", "right-0 top-0 translate-x-1/2 -translate-y-1/2", "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", "bottom-0 right-0 translate-x-1/2 translate-y-1/2"].map((className) => (
                <span key={className} className={`pointer-events-auto absolute size-2 cursor-move rounded-sm ${className}`} style={{ background: theme.canvas.selectionStroke }} onPointerDown={onDragStart} />
            ))}
            <div
                data-canvas-no-zoom
                className="pointer-events-auto absolute left-1/2 top-0 flex items-center gap-1 rounded-xl border px-2 py-2 shadow-xl backdrop-blur"
                style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.toolbar.item, transform: `translate(-50%, -58px) scale(${toolbarScale})`, transformOrigin: "top center" }}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <div className="relative">
                    <SelectionToolbarButton title="排列" onClick={() => setArrangeOpen((open) => !open)} theme={theme}>
                        <Grid2x2 className="size-4" />
                        <ChevronDown className="size-3" />
                    </SelectionToolbarButton>
                    {arrangeOpen ? (
                        <div className="absolute bottom-10 left-0 z-30 w-32 rounded-xl border p-1.5 shadow-xl backdrop-blur" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}>
                            <SelectionMenuItem icon={<Grid2x2 className="size-4" />} label="宫格排列" theme={theme} onClick={() => onArrange("grid")} />
                            <SelectionMenuItem icon={<Menu className="size-4" />} label="水平排列" theme={theme} onClick={() => onArrange("horizontal")} />
                            <SelectionMenuItem icon={<List className="size-4" />} label="垂直排列" theme={theme} onClick={() => onArrange("vertical")} />
                        </div>
                    ) : null}
                </div>
                <SelectionDivider theme={theme} />
                <SelectionToolbarButton label="保存到资产" theme={theme} onClick={onSaveAssets}>
                    <Save className="size-4" />
                </SelectionToolbarButton>
                <SelectionToolbarButton label="创建副本" theme={theme} onClick={onDuplicate}>
                    <Copy className="size-4" />
                </SelectionToolbarButton>
                <SelectionDivider theme={theme} />
                <SelectionToolbarButton label="打组" theme={theme} onClick={onGroup}>
                    <Group className="size-4" />
                    <ChevronDown className="size-3" />
                </SelectionToolbarButton>
            </div>
        </div>
    );
}

function SelectionToolbarButton({ children, label, title, theme, onClick }: { children: ReactNode; label?: string; title?: string; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onClick: () => void }) {
    return (
        <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition hover:scale-[1.02]"
            style={{ color: theme.toolbar.item }}
            title={title || label}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
        >
            {children}
            {label ? <span className="whitespace-nowrap">{label}</span> : null}
        </button>
    );
}

function SelectionMenuItem({ icon, label, theme, onClick }: { icon: ReactNode; label: string; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onClick: () => void }) {
    return (
        <button
            type="button"
            className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-medium transition hover:scale-[1.01]"
            style={{ color: theme.toolbar.item }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
        >
            {icon}
            {label}
        </button>
    );
}

function SelectionDivider({ theme }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return <span className="mx-1 h-6 w-px" style={{ background: theme.toolbar.border }} />;
}

function getNodesBounds(nodes: CanvasNodeData[]) {
    const bounds = nodes.reduce(
        (bounds, node) => ({
            left: Math.min(bounds.left, node.position.x),
            top: Math.min(bounds.top, node.position.y),
            right: Math.max(bounds.right, node.position.x + node.width),
            bottom: Math.max(bounds.bottom, node.position.y + node.height),
        }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
    return { ...bounds, width: Math.max(1, bounds.right - bounds.left), height: Math.max(1, bounds.bottom - bounds.top) };
}

function isPointInGroup(point: Position, group: CanvasGroup) {
    return point.x >= group.position.x && point.x <= group.position.x + group.width && point.y >= group.position.y && point.y <= group.position.y + group.height;
}

function nextGroupTitle(groups: CanvasGroup[]) {
    const used = new Set(groups.map((group) => group.title.trim()));
    let index = 1;
    while (used.has(`分组${index}`)) index += 1;
    return `分组${index}`;
}

function upsertAutoCanvasGroup(groups: CanvasGroup[], title: string, nodeId: string, fallback: CanvasNodeData) {
    const existing = groups.find((group) => group.title === title);
    if (existing) {
        return groups.map((group) => (group.id === existing.id ? { ...group, nodeIds: Array.from(new Set([...group.nodeIds, nodeId])) } : group));
    }
    return [
        ...groups,
        {
            id: nanoid(),
            title,
            nodeIds: [nodeId],
            position: { x: fallback.position.x, y: fallback.position.y },
            width: fallback.width,
            height: fallback.height,
        },
    ];
}

function upsertStoryboardResultNode(nodes: CanvasNodeData[], sourceNode: CanvasNodeData, shotId: string, mode: CanvasStoryboardGenerationMode, resultId: string, size: { width: number; height: number }, metadata: CanvasNodeMetadata): CanvasNodeData[] {
    const existing = nodes.find((node) => node.id === resultId);
    const shotIndex = Math.max(0, sourceNode.metadata?.storyboard?.shots.findIndex((shot) => shot.id === shotId) ?? 0);
    const groupX = mode === "image" ? sourceNode.position.x + sourceNode.width + 96 : sourceNode.position.x + sourceNode.width + 96 + NODE_DEFAULT_SIZE[CanvasNodeType.Image].width + 96;
    const groupY = sourceNode.position.y + 48 + shotIndex * 240;
    const title = `${mode === "image" ? "分镜组" : "视频组"} / 镜头 ${shotId}`;
    const nextMetadata = { ...metadata, storyboardSourceNodeId: sourceNode.id, storyboardShotId: shotId, storyboardResultKind: mode };

    if (existing) {
        return nodes.map((node) =>
            node.id === resultId
                ? {
                      ...node,
                      title,
                      width: size.width,
                      height: size.height,
                      position: { x: node.position.x + node.width / 2 - size.width / 2, y: node.position.y + node.height / 2 - size.height / 2 },
                      metadata: { ...node.metadata, ...nextMetadata },
                  }
                : node,
        );
    }

    return [
        ...nodes,
        {
            id: resultId,
            type: mode === "image" ? CanvasNodeType.Image : CanvasNodeType.Video,
            title,
            position: { x: groupX, y: groupY },
            width: size.width,
            height: size.height,
            metadata: nextMetadata,
        },
    ];
}

function patchLinkedStoryboardSlot(nodes: CanvasNodeData[], sourceNode: CanvasNodeData | undefined, kind: "image" | "video", slot: NonNullable<CanvasStoryboardShot["image"]>): CanvasNodeData[] {
    const storyboardNodeId = sourceNode?.metadata?.storyboardSourceNodeId;
    const shotId = sourceNode?.metadata?.storyboardShotId;
    if (!storyboardNodeId || !shotId) return nodes;
    return nodes.map((node) => (node.id === storyboardNodeId ? patchStoryboardShot(node, shotId, kind === "image" ? { image: slot } : { video: slot }) : node));
}

function linkedStoryboardShotImageReference(nodes: CanvasNodeData[], sourceNode: CanvasNodeData | undefined): ReferenceImage | null {
    const storyboardNodeId = sourceNode?.metadata?.storyboardSourceNodeId;
    const shotId = sourceNode?.metadata?.storyboardShotId;
    if (!storyboardNodeId || !shotId) return null;
    const shot = nodes.find((node) => node.id === storyboardNodeId)?.metadata?.storyboard?.shots.find((item) => item.id === shotId);
    if (!shot) return null;
    return storyboardShotImageReference(shot);
}

function storyboardShotImageReference(shot: CanvasStoryboardShot): ReferenceImage | null {
    if (shot.image?.status !== "done" || !shot.image.url) return null;
    return {
        id: `storyboard-${shot.id}`,
        name: `分镜${shot.id}.png`,
        type: "image/png",
        dataUrl: shot.image.url,
        storageKey: shot.image.url.startsWith("image:") ? shot.image.url : undefined,
    };
}

function boardImageReference(url: string, target: CanvasBoardMediaEditorTarget): ReferenceImage {
    return {
        id: boardMediaKey(target),
        name: target.boardType === "storyboard" ? `分镜${target.shotId}.png` : "参考图.png",
        type: "image/png",
        dataUrl: url,
        storageKey: url.startsWith("image:") ? url : undefined,
    };
}

function videoMetadata(video: UploadedFile): CanvasNodeMetadata {
    return { content: video.url, storageKey: video.storageKey, status: "success", naturalWidth: video.width, naturalHeight: video.height, bytes: video.bytes, mimeType: video.mimeType || "video/mp4", durationMs: video.durationMs };
}

function audioMetadata(audio: UploadedFile): CanvasNodeMetadata {
    return { content: audio.url, storageKey: audio.storageKey, status: "success", bytes: audio.bytes, mimeType: audio.mimeType || "audio/mpeg", durationMs: audio.durationMs };
}

function buildImageGenerationMetadata(type: CanvasImageGenerationType, config: AiConfig, count: number, references: ReferenceImage[]): CanvasNodeMetadata {
    return {
        generationType: type,
        model: config.model,
        size: config.size,
        quality: config.quality,
        count,
        references: references.map(referenceUrl).filter((url): url is string => Boolean(url)),
    };
}

function buildAudioGenerationMetadata(config: AiConfig): CanvasNodeMetadata {
    return {
        model: config.model,
        audioVoice: config.audioVoice,
        audioFormat: config.audioFormat,
        audioSpeed: config.audioSpeed,
        audioInstructions: config.audioInstructions,
    };
}

function referenceUrl(image: ReferenceImage) {
    return image.storageKey || image.url || (!image.dataUrl.startsWith("data:") ? image.dataUrl : undefined);
}

function generationReferenceUrls(context: { referenceImages: ReferenceImage[]; referenceVideos: Array<{ storageKey?: string; url?: string }>; referenceAudios?: Array<{ storageKey?: string; url?: string }> }) {
    return [
        ...context.referenceImages.map(referenceUrl).filter((url): url is string => Boolean(url)),
        ...context.referenceVideos.map((video) => video.storageKey || video.url).filter((url): url is string => Boolean(url)),
        ...(context.referenceAudios || []).map((audio) => audio.storageKey || audio.url).filter((url): url is string => Boolean(url)),
    ];
}

async function resolveMetadataReferences(metadata: CanvasNodeMetadata) {
    if (metadata.generationType !== "edit") return [];
    if (!metadata.references?.length) return null;
    const references = await Promise.all(
        metadata.references.map(async (url, index) => {
            const dataUrl = url.startsWith("image:") ? await resolveImageUrl(url, "") : url;
            return dataUrl ? { id: `${index}`, name: `reference-${index}.png`, type: "image/png", dataUrl, storageKey: url.startsWith("image:") ? url : undefined } : null;
        }),
    );
    return references.every(Boolean) ? (references as ReferenceImage[]) : null;
}

async function resolveVideoReferences(keys?: string[]): Promise<ReferenceImage[]> {
    if (!keys?.length) return [];
    const references = await Promise.all(
        keys.map(async (url, index): Promise<ReferenceImage | null> => {
            const dataUrl = url.startsWith("image:") ? await resolveImageUrl(url, "") : url;
            return dataUrl ? { id: `${index}`, name: `reference-${index}.png`, type: "image/png", dataUrl, storageKey: url.startsWith("image:") ? url : undefined } : null;
        }),
    );
    return references.filter((item): item is ReferenceImage => Boolean(item));
}

async function hydrateCanvasImages(nodes: CanvasNodeData[]) {
    return Promise.all(
        nodes.map(async (node) => {
            const content = node.metadata?.content;
            if ((node.type === CanvasNodeType.Video || node.type === CanvasNodeType.Audio) && node.metadata?.storageKey) return { ...node, metadata: { ...node.metadata, content: await resolveMediaUrl(node.metadata.storageKey, content) } };
            if (node.type !== CanvasNodeType.Image || !content) return node;
            if (node.metadata?.storageKey) return { ...node, metadata: { ...node.metadata, content: await resolveImageUrl(node.metadata.storageKey, content) } };
            if (!content.startsWith("data:image/")) return node;
            return { ...node, metadata: { ...node.metadata, ...imageMetadata(await uploadImage(content)) } };
        }),
    );
}

async function hydrateAssistantImages(sessions: CanvasAssistantSession[]) {
    const hydrateItem = async <T extends { dataUrl?: string; storageKey?: string }>(item: T) => {
        if (item.storageKey) return { ...item, dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl) };
        if (item.dataUrl?.startsWith("data:image/")) {
            const image = await uploadImage(item.dataUrl);
            return { ...item, dataUrl: image.url, storageKey: image.storageKey };
        }
        return item;
    };
    return Promise.all(
        sessions.map(async (session) => ({
            ...session,
            messages: await Promise.all(
                session.messages.map(async (message) => ({
                    ...message,
                    references: await Promise.all((message.references || []).map(hydrateItem)),
                    images: await Promise.all((message.images || []).map(hydrateItem)),
                })),
            ),
        })),
    );
}

function getGenerationCount(count: string) {
    return Math.max(1, Math.min(15, Math.floor(Math.abs(Number(count)) || 1)));
}

function defaultTextModePrompt(mode?: CanvasTextMode) {
    if (mode === "imagePrompt") return "请分析图片并反推出可用于 AI 生图的高质量中文提示词，包含主体、场景、构图、光线、风格、镜头、细节和负面约束。";
    if (mode === "videoPrompt") return "请根据视频关键帧反推出可用于 AI 视频生成的高质量中文提示词，包含主体、动作、场景、镜头运动、光线、风格、节奏和画面变化。";
    return "";
}

function buildTextModePrompt(mode: CanvasTextMode | undefined, prompt: string) {
    const trimmed = prompt.trim();
    if (trimmed) return trimmed;
    return defaultTextModePrompt(mode);
}

function applyNodeConfigPatch(node: CanvasNodeData, patch: Partial<CanvasNodeData["metadata"]>) {
    const safePatch = patch || {};
    const next = { ...node, metadata: { ...node.metadata, ...safePatch } };
    const spec = node.type === CanvasNodeType.Video ? NODE_DEFAULT_SIZE[CanvasNodeType.Video] : NODE_DEFAULT_SIZE[CanvasNodeType.Image];
    const size = typeof safePatch.size === "string" && !node.metadata?.content ? nodeSizeFromRatio(safePatch.size, spec.width, spec.height) : null;
    return size && (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Video) ? { ...next, ...size, position: { x: node.position.x + node.width / 2 - size.width / 2, y: node.position.y + node.height / 2 - size.height / 2 } } : next;
}

function getConnectionTargetAnchor(node: CanvasNodeData, current: ConnectionHandle) {
    return {
        x: current.handleType === "source" ? node.position.x : node.position.x + node.width,
        y: node.position.y + node.height / 2,
    };
}

function normalizeConnection(firstNodeId: string, secondNodeId: string, nodes: CanvasNodeData[], firstHandleType: "source" | "target") {
    const first = nodes.find((node) => node.id === firstNodeId);
    const second = nodes.find((node) => node.id === secondNodeId);
    if (!first || !second || first.id === second.id) return null;
    if (first.type === CanvasNodeType.Config && second.type === CanvasNodeType.Config) return null;
    const connection =
        second.type === CanvasNodeType.Config
            ? { fromNodeId: first.id, toNodeId: second.id }
            : first.type === CanvasNodeType.Config && firstHandleType === "target"
              ? { fromNodeId: second.id, toNodeId: first.id }
              : first.type === CanvasNodeType.Config
                ? { fromNodeId: first.id, toNodeId: second.id }
                : { fromNodeId: first.id, toNodeId: second.id };
    const from = nodes.find((node) => node.id === connection.fromNodeId);
    const to = nodes.find((node) => node.id === connection.toNodeId);
    const fromStepType = getShortDramaStepType(from);
    const toStepType = getShortDramaStepType(to);
    if (fromStepType && toStepType && !isAllowedShortDramaConnection(fromStepType, toStepType)) return null;
    return connection;
}

function getInputSummary(inputs: NodeGenerationInput[]) {
    return {
        textCount: inputs.filter((input) => input.type === "text").length,
        imageCount: inputs.filter((input) => input.type === "image").length,
        videoCount: inputs.filter((input) => input.type === "video").length,
        audioCount: inputs.filter((input) => input.type === "audio").length,
    };
}

function buildGenerationConfig(config: AiConfig, node: CanvasNodeData | undefined, mode: CanvasNodeGenerationMode): AiConfig {
    const defaultModel = mode === "image" ? config.imageModel : mode === "video" ? config.videoModel : mode === "audio" ? config.audioModel : config.textModel;
    return {
        ...config,
        model: node?.metadata?.model || defaultModel || (mode === "audio" ? defaultConfig.audioModel : config.model || defaultConfig.model),
        quality: node?.metadata?.quality || config.quality || defaultConfig.quality,
        size: node?.metadata?.size || config.size || defaultConfig.size,
        videoSeconds: node?.metadata?.seconds || config.videoSeconds || defaultConfig.videoSeconds,
        vquality: node?.metadata?.vquality || config.vquality || defaultConfig.vquality,
        videoGenerateAudio: node?.metadata?.generateAudio || config.videoGenerateAudio || defaultConfig.videoGenerateAudio,
        videoWatermark: node?.metadata?.watermark || config.videoWatermark || defaultConfig.videoWatermark,
        audioVoice: node?.metadata?.audioVoice || config.audioVoice || defaultConfig.audioVoice,
        audioFormat: node?.metadata?.audioFormat || config.audioFormat || defaultConfig.audioFormat,
        audioSpeed: node?.metadata?.audioSpeed || config.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: node?.metadata?.audioInstructions || config.audioInstructions || defaultConfig.audioInstructions,
        count: String(node?.metadata?.count || (mode === "image" ? config.canvasImageCount || config.count : config.count) || defaultConfig.count),
    };
}

function buildAgentPrompt(prompt: string, format?: CanvasAgentOutputFormat) {
    if (!format || format === "plain") return prompt;
    const instruction =
        format === "markdown"
            ? "请使用结构清晰的 Markdown 输出，包含必要的小标题和列表。"
            : format === "json"
              ? "请只返回合法 JSON，不要使用 Markdown 代码块，不要输出额外解释。"
              : "请输出一组可直接执行的提示词，每条提示词单独一行，不要编号，不要添加额外解释。";
    return `${prompt}\n\n输出格式要求：${instruction}`;
}

async function attachVideoFramesToTextModelContext(context: NodeGenerationContext) {
    if (!context.referenceVideos.length) return { context, framesAdded: 0 };
    const frames = await extractVideoPromptFrames(context.referenceVideos);
    if (!frames.length) return { context, framesAdded: 0 };
    return {
        context: {
            ...context,
            referenceImages: [...context.referenceImages, ...frames],
            imageCount: context.referenceImages.length + frames.length,
        },
        framesAdded: frames.length,
    };
}

function resetInterruptedGeneration(nodes: CanvasNodeData[]) {
    return nodes.map((node) => (node.metadata?.status === "loading" ? { ...node, metadata: { ...node.metadata, status: "error" as const, errorDetails: "页面刷新后生成已中断，请重新生成。" } } : node));
}

function findRetrySourceNode(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const queue = connections.filter((connection) => connection.toNodeId === nodeId).map((connection) => connection.fromNodeId);
    const visited = new Set<string>();
    while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const node = nodes.find((item) => item.id === id);
        if (node?.type === CanvasNodeType.Config) return node;
        connections.filter((connection) => connection.toNodeId === id).forEach((connection) => queue.push(connection.fromNodeId));
    }
    return null;
}

function sourceNodeReferenceImages(node: CanvasNodeData | null) {
    if (!node || node.type !== CanvasNodeType.Image || !node.metadata?.content) return [];
    return [
        {
            id: node.id,
            name: `${node.title || node.id}.png`,
            type: node.metadata.mimeType || "image/png",
            dataUrl: node.metadata.content,
            storageKey: node.metadata.storageKey,
        },
    ];
}

function isAudioFile(file: File) {
    return file.type.startsWith("audio/") || /\.(mp3|wav)$/i.test(file.name);
}

function isHiddenBatchChild(node: CanvasNodeData, nodes: CanvasNodeData[], collapsingBatchIds?: Set<string>) {
    const rootId = node.metadata?.batchRootId;
    if (!rootId) return false;
    const root = nodes.find((item) => item.id === rootId);
    if (root && collapsingBatchIds?.has(rootId)) return false;
    return Boolean(root && !root.metadata?.imageBatchExpanded);
}

function isHiddenBatchConnectionEndpoint(node: CanvasNodeData, nodes: CanvasNodeData[]) {
    const rootId = node.metadata?.batchRootId;
    if (!rootId) return false;
    const root = nodes.find((item) => item.id === rootId);
    return Boolean(root && !root.metadata?.imageBatchExpanded);
}

function buildAngleLabel(params: CanvasImageAngleParams) {
    const horizontal = params.horizontalAngle === 0 ? "正面视角" : params.horizontalAngle > 0 ? `向右旋转 ${params.horizontalAngle} 度` : `向左旋转 ${Math.abs(params.horizontalAngle)} 度`;
    const pitch = params.pitchAngle === 0 ? "水平视角" : params.pitchAngle > 0 ? `俯视 ${params.pitchAngle} 度` : `仰视 ${Math.abs(params.pitchAngle)} 度`;
    return `AI 多角度：${horizontal}，${pitch}，镜头距离 ${params.cameraDistance.toFixed(1)}，${params.wideAngle ? "广角" : "标准"}镜头`;
}

function buildAnglePrompt(params: CanvasImageAngleParams) {
    return `基于参考图重新生成同一主体的新视角，保持主体、颜色、材质和画面风格一致，不要只做透视变形。${buildAngleLabel(params)}。`;
}
