export type Position = {
    x: number;
    y: number;
};

export type ViewportTransform = {
    x: number;
    y: number;
    k: number;
};

export enum CanvasNodeType {
    Image = "image",
    Text = "text",
    Config = "config",
    Video = "video",
    Audio = "audio",
    Agent = "agent",
    ScriptAgent = "scriptAgent",
    CharacterAgent = "characterAgent",
    StoryboardAgent = "storyboardAgent",
    ProjectBrief = "projectBrief",
    SubjectBoard = "subjectBoard",
    Storyboard = "storyboard",
}

export type CanvasNodeStatus = "idle" | "success" | "loading" | "error";
export type CanvasGenerationMode = "text" | "image" | "video" | "audio";
export type CanvasImageGenerationType = "generation" | "edit";
export type CanvasVideoRefMode = "text" | "first" | "firstLast" | "omni";
export type CanvasTextMode = "write" | "imagePrompt" | "videoPrompt";
export type CanvasAgentOutputFormat = "plain" | "markdown" | "json" | "promptList";
export type CanvasAgentTaskStatus = "idle" | "running" | "success" | "error";
export type CanvasSubjectKind = "character" | "scene" | "prop";
export type CanvasMediaSlotStatus = "empty" | "generating" | "done" | "error";
export type CanvasStoryboardGenerationMode = "image" | "video";

export type CanvasProjectBrief = {
    theme: string;
    genre: string;
    visualStyle: string;
    visualStyleImage?: string;
    visualStylePrompt?: string;
    keyElements: string[];
    duration: string;
    story: string;
};

export type CanvasMediaSlot = {
    status: CanvasMediaSlotStatus;
    url?: string;
    nodeId?: string;
    error?: string;
};

export type CanvasSubjectBoardItem = {
    id: string;
    kind: CanvasSubjectKind;
    name: string;
    description?: string;
    prompt?: string;
    thumbnail?: string;
    image?: CanvasMediaSlot;
    imageHistory?: CanvasMediaSlot[];
    video?: CanvasMediaSlot;
    videoHistory?: CanvasMediaSlot[];
    voice?: CanvasMediaSlot;
};

export type CanvasSubjectBoardGroup = {
    id: string;
    title: string;
    kind: CanvasSubjectKind;
    items: CanvasSubjectBoardItem[];
};

export type CanvasSubjectBoard = {
    groups: CanvasSubjectBoardGroup[];
};

export type CanvasAgentTask = {
    id: string;
    title: string;
    status: CanvasAgentTaskStatus;
};

export type CanvasStoryboardReference = {
    id: string;
    name: string;
    kind: CanvasSubjectKind;
    thumbnail?: string;
    nodeId?: string;
};

export type CanvasStoryboardShot = {
    id: string;
    description: string;
    references: CanvasStoryboardReference[];
    image?: CanvasMediaSlot;
    imageHistory?: CanvasMediaSlot[];
    video?: CanvasMediaSlot;
    videoHistory?: CanvasMediaSlot[];
    imagePrompt?: string;
    videoPrompt?: string;
};

export type CanvasStoryboard = {
    shots: CanvasStoryboardShot[];
};

export type CanvasBoardMediaEditorTarget =
    | {
          boardType: "subject";
          nodeId: string;
          groupId: string;
          itemId: string;
          kind: "image" | "video";
      }
    | {
          boardType: "storyboard";
          nodeId: string;
          shotId: string;
          kind: "image" | "video";
      };

export type CanvasNodeMetadata = {
    content?: string;
    composerContent?: string;
    prompt?: string;
    status?: CanvasNodeStatus;
    errorDetails?: string;
    fontSize?: number;
    generationMode?: CanvasGenerationMode;
    generationType?: CanvasImageGenerationType;
    model?: string;
    styleName?: string;
    size?: string;
    quality?: string;
    count?: number;
    seconds?: string;
    vquality?: string;
    generateAudio?: string;
    watermark?: string;
    audioVoice?: string;
    audioFormat?: string;
    audioSpeed?: string;
    audioInstructions?: string;
    references?: string[];
    videoRefMode?: CanvasVideoRefMode;
    videoReferences?: string[];
    naturalWidth?: number;
    naturalHeight?: number;
    freeResize?: boolean;
    isBatchRoot?: boolean;
    batchRootId?: string;
    batchChildIds?: string[];
    batchUsesReferenceImages?: boolean;
    primaryImageId?: string;
    imageBatchExpanded?: boolean;
    storageKey?: string;
    mimeType?: string;
    bytes?: number;
    durationMs?: number;
    textMode?: CanvasTextMode;
    textRole?: "script";
    textExpanded?: boolean;
    textStyle?: "body" | "h1" | "h2" | "h3";
    textBold?: boolean;
    textItalic?: boolean;
    textBackground?: string;
    agentName?: string;
    agentInstruction?: string;
    agentOutputFormat?: CanvasAgentOutputFormat;
    agentResultNodeId?: string;
    agentResultSourceNodeId?: string;
    agentTasks?: CanvasAgentTask[];
    agentProgress?: number;
    agentCurrentStep?: string;
    projectBrief?: CanvasProjectBrief;
    subjectBoard?: CanvasSubjectBoard;
    subjectPanelGroupId?: string;
    subjectPanelItemId?: string;
    storyboard?: CanvasStoryboard;
    storyboardPanelMode?: CanvasStoryboardGenerationMode;
    storyboardPanelShotId?: string;
    storyboardSourceNodeId?: string;
    storyboardShotId?: string;
    storyboardResultKind?: CanvasStoryboardGenerationMode;
    storyboardImageModel?: string;
    storyboardVideoModel?: string;
};

export type CanvasNodeData = {
    id: string;
    type: CanvasNodeType;
    title: string;
    position: Position;
    width: number;
    height: number;
    metadata?: CanvasNodeMetadata;
};

export type CanvasGroup = {
    id: string;
    title: string;
    nodeIds: string[];
    position: Position;
    width: number;
    height: number;
    color?: string;
    collapsed?: boolean;
    locked?: boolean;
};

export type CanvasArrangeMode = "grid" | "horizontal" | "vertical";

export type CanvasConnection = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
};

export type CanvasAssistantReference = {
    id: string;
    type: CanvasNodeType;
    title: string;
    dataUrl?: string;
    storageKey?: string;
    text?: string;
};

export type CanvasAssistantImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    prompt: string;
};

export type CanvasAssistantMessage = {
    id: string;
    role: "user" | "assistant" | "system" | "tool" | "error";
    mode?: "ask" | "image";
    title?: string;
    text: string;
    meta?: string;
    detail?: unknown;
    isLoading?: boolean;
    references?: CanvasAssistantReference[];
    images?: CanvasAssistantImage[];
};

export type CanvasAssistantSession = {
    id: string;
    title: string;
    messages: CanvasAssistantMessage[];
    createdAt: string;
    updatedAt: string;
};

export type ConnectionHandle = {
    nodeId: string;
    handleType: "source" | "target";
};

export type SelectionBox = {
    startWorldX: number;
    startWorldY: number;
    currentWorldX: number;
    currentWorldY: number;
    additive: boolean;
    initialSelectedNodeIds: string[];
};

export type ContextMenuState =
    | {
          type: "node";
          x: number;
          y: number;
          nodeId: string;
      }
    | {
          type: "connection";
          x: number;
          y: number;
          connectionId: string;
      };
