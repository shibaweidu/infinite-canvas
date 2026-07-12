import { defaultConfig, type AiConfig } from "@/stores/use-config-store";
import type { AdminPublicModelChannelSettings } from "@/services/api/admin";
import { CHARACTER_AGENT_DEFAULT_INSTRUCTION, SCRIPT_AGENT_DEFAULT_INSTRUCTION, STORYBOARD_AGENT_DEFAULT_INSTRUCTION } from "../constants";
import { CanvasNodeType, type CanvasGenerationMode, type CanvasGlobalSettings, type CanvasNodeData } from "../types";

export type CanvasAgentInstructionKey = "scriptInstruction" | "characterInstruction" | "storyboardInstruction";
export type CanvasAgentInstructionMap = Record<CanvasAgentInstructionKey, string>;
export type CanvasAgentInstructionSource = "node" | "canvas" | "system" | "unset";
export type CanvasAgentInstructionState = { value: string; source: CanvasAgentInstructionSource };

type CanvasAgentDefaultsSource = Pick<AdminPublicModelChannelSettings, "scriptAgentInstruction" | "characterAgentInstruction" | "storyboardAgentInstruction">;

export function resolveCanvasStyleName(settings: CanvasGlobalSettings | undefined, fallback = "") {
    return settings?.styleName?.trim() || fallback;
}

export function resolveNodeStyleName(node: CanvasNodeData | undefined, settings: CanvasGlobalSettings | undefined, fallback = "") {
    return node?.metadata?.styleName?.trim() || resolveCanvasStyleName(settings, fallback);
}

export function buildCanvasScopedConfig(config: AiConfig, settings: CanvasGlobalSettings | undefined, mode: CanvasGenerationMode): AiConfig {
    const scopedImage = settings?.image;
    const scopedVideo = settings?.video;
    const styleName = resolveCanvasStyleName(settings, config.defaultStyleName);
    return {
        ...config,
        defaultStyleName: styleName,
        imageModel: scopedImage?.model?.trim() || config.imageModel,
        quality: mode === "image" ? scopedImage?.quality?.trim() || config.quality || defaultConfig.quality : config.quality,
        videoModel: scopedVideo?.model?.trim() || config.videoModel,
        size:
            mode === "image"
                ? scopedImage?.size?.trim() || config.size || defaultConfig.size
                : mode === "video"
                  ? scopedVideo?.size?.trim() || config.size || defaultConfig.size
                  : config.size,
        vquality: mode === "video" ? scopedVideo?.vquality?.trim() || config.vquality || defaultConfig.vquality : config.vquality,
        videoSeconds: mode === "video" ? scopedVideo?.videoSeconds?.trim() || config.videoSeconds || defaultConfig.videoSeconds : config.videoSeconds,
    };
}

export function resolveCanvasAgentDefaults(modelChannel?: Partial<CanvasAgentDefaultsSource> | null): CanvasAgentInstructionMap {
    return {
        scriptInstruction: modelChannel?.scriptAgentInstruction?.trim() || SCRIPT_AGENT_DEFAULT_INSTRUCTION,
        characterInstruction: modelChannel?.characterAgentInstruction?.trim() || CHARACTER_AGENT_DEFAULT_INSTRUCTION,
        storyboardInstruction: modelChannel?.storyboardAgentInstruction?.trim() || STORYBOARD_AGENT_DEFAULT_INSTRUCTION,
    };
}

export function resolveAgentInstruction(type: CanvasNodeType, instruction: string | undefined, settings: CanvasGlobalSettings | undefined, systemDefaults = resolveCanvasAgentDefaults()) {
    return resolveAgentInstructionState(type, instruction, settings, systemDefaults).value;
}

export function resolveAgentInstructionState(type: CanvasNodeType, instruction: string | undefined, settings: CanvasGlobalSettings | undefined, systemDefaults = resolveCanvasAgentDefaults()): CanvasAgentInstructionState {
    const nodeInstruction = instruction?.trim() || "";
    if (nodeInstruction) return { value: nodeInstruction, source: "node" as const };
    if (!isSpecializedAgent(type)) return { value: "", source: "unset" as const };
    const canvasInstruction = agentInstructionFromSettings(type, settings);
    if (canvasInstruction) return { value: canvasInstruction, source: "canvas" as const };
    return { value: agentInstructionFromDefaults(type, systemDefaults), source: "system" as const };
}

export function normalizeCanvasGlobalSettings(settings: CanvasGlobalSettings): CanvasGlobalSettings | undefined {
    const next: CanvasGlobalSettings = {
        agents: normalizeAgents(settings.agents),
        styleName: settings.styleName?.trim() || undefined,
        image: normalizeModeSettings(settings.image),
        video: normalizeVideoSettings(settings.video),
    };
    return next.agents || next.styleName || next.image || next.video ? next : undefined;
}

function normalizeAgents(settings: CanvasGlobalSettings["agents"]) {
    if (!settings) return undefined;
    const next = {
        scriptInstruction: settings.scriptInstruction?.trim() || undefined,
        characterInstruction: settings.characterInstruction?.trim() || undefined,
        storyboardInstruction: settings.storyboardInstruction?.trim() || undefined,
    };
    return next.scriptInstruction || next.characterInstruction || next.storyboardInstruction ? next : undefined;
}

function normalizeModeSettings(settings: CanvasGlobalSettings["image"]) {
    if (!settings) return undefined;
    const next = {
        model: settings.model?.trim() || undefined,
        quality: settings.quality?.trim() || undefined,
        size: settings.size?.trim() || undefined,
    };
    return next.model || next.quality || next.size ? next : undefined;
}

function normalizeVideoSettings(settings: CanvasGlobalSettings["video"]) {
    if (!settings) return undefined;
    const next = {
        model: settings.model?.trim() || undefined,
        vquality: settings.vquality?.trim() || undefined,
        size: settings.size?.trim() || undefined,
        videoSeconds: settings.videoSeconds?.trim() || undefined,
    };
    return next.model || next.vquality || next.size || next.videoSeconds ? next : undefined;
}

function isSpecializedAgent(type: CanvasNodeType) {
    return type === CanvasNodeType.ScriptAgent || type === CanvasNodeType.CharacterAgent || type === CanvasNodeType.StoryboardAgent;
}

function agentInstructionFromSettings(type: CanvasNodeType, settings: CanvasGlobalSettings | undefined) {
    if (type === CanvasNodeType.ScriptAgent) return settings?.agents?.scriptInstruction?.trim() || "";
    if (type === CanvasNodeType.CharacterAgent) return settings?.agents?.characterInstruction?.trim() || "";
    if (type === CanvasNodeType.StoryboardAgent) return settings?.agents?.storyboardInstruction?.trim() || "";
    return "";
}

function agentInstructionFromDefaults(type: CanvasNodeType, defaults: CanvasAgentInstructionMap) {
    if (type === CanvasNodeType.ScriptAgent) return defaults.scriptInstruction;
    if (type === CanvasNodeType.CharacterAgent) return defaults.characterInstruction;
    if (type === CanvasNodeType.StoryboardAgent) return defaults.storyboardInstruction;
    return "";
}
