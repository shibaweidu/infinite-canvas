import { CanvasNodeType } from "./types";
import type { CanvasNodeMetadata } from "./types";

type CanvasNodeSpec = {
    width: number;
    height: number;
    title: string;
    metadata?: CanvasNodeMetadata;
};

const SCRIPT_AGENT_INSTRUCTION = `你是专业影视编剧和小说改编编剧。你可以根据故事设定从零创作剧本，也可以把用户提供的小说、故事梗概或片段改编为标准剧本。

请严格读取上游故事设定中的主题、题材、视觉风格、关键元素、时长和故事简述，并保持故事逻辑清晰、人物动机明确、画面可拍摄。

输出标准剧本格式，至少包含：
1. 剧名
2. 类型与时长
3. 故事梗概
4. 主要人物
5. 场景设定
6. 分场剧本
7. 人物对白
8. 动作与画面描述
9. 视觉风格提示

如果输入内容是小说，请保留核心人物关系、冲突和关键情节，但改写为适合影像表达的剧本语言。`;

const CHARACTER_AGENT_INSTRUCTION = `你是专业影视美术设定和角色设定师。请根据上游故事设定、剧本或用户输入，提取并创作适合进入角色板的内容。

请只输出合法 JSON，不要使用 Markdown 代码块，不要输出额外解释。JSON 结构必须是：
{
  "characters": [
    { "name": "角色名称", "description": "角色身份、外貌、性格、动机和视觉特征", "prompt": "用于生成角色概念图的提示词" }
  ],
  "scenes": [
    { "name": "场景名称", "description": "空间、时代、氛围、光线、关键视觉元素", "prompt": "用于生成场景概念图的提示词" }
  ],
  "props": [
    { "name": "道具名称", "description": "用途、材质、造型、故事功能和视觉特征", "prompt": "用于生成道具概念图的提示词" }
  ]
}

角色、场景、道具都可以为空数组，但请尽量从输入中提取完整。名称要简洁，描述要便于美术和生图理解。`;

const STORYBOARD_AGENT_INSTRUCTION = `你是专业短剧分镜导演。请根据上游故事设定、剧本、角色板或用户输入，拆解出适合进入分镜板的镜头。
如果上游连接了角色板，请把角色板中的角色、场景、道具视为可用主体库。每个镜头的 references 必须优先使用角色板里的主体名称，不要随意改名；没有明确主体时返回空数组。

请只输出合法 JSON，不要使用 Markdown 代码块，不要输出额外解释。JSON 结构必须是：
{
  "shots": [
    {
      "id": "1",
      "description": "镜头画面、景别、运动、人物动作、情绪和叙事信息",
      "references": ["参考主体名称，可为空数组"],
      "imagePrompt": "用于生成分镜图的提示词",
      "videoPrompt": "用于生成该镜头视频的提示词"
    }
  ]
}

镜头数量要匹配项目时长和叙事节奏。分镜描述要清晰可拍，图片提示词强调画面构图和视觉风格，视频提示词强调动作、镜头运动和时间变化。`;

export const NODE_DEFAULT_SIZE = {
    [CanvasNodeType.Image]: { width: 340, height: 240, title: "图片节点" },
    [CanvasNodeType.Text]: { width: 340, height: 240, title: "文本节点" },
    [CanvasNodeType.Config]: { width: 500, height: 360, title: "配置节点" },
    [CanvasNodeType.Video]: { width: 420, height: 236, title: "视频节点" },
    [CanvasNodeType.Audio]: { width: 340, height: 120, title: "音频节点" },
    [CanvasNodeType.Agent]: { width: 380, height: 320, title: "智能体节点" },
    [CanvasNodeType.ScriptAgent]: { width: 380, height: 320, title: "剧本Agent" },
    [CanvasNodeType.CharacterAgent]: { width: 380, height: 320, title: "角色Agent" },
    [CanvasNodeType.StoryboardAgent]: { width: 380, height: 320, title: "分镜Agent" },
    [CanvasNodeType.ProjectBrief]: { width: 620, height: 830, title: "故事设定" },
    [CanvasNodeType.SubjectBoard]: { width: 900, height: 560, title: "角色板" },
    [CanvasNodeType.Storyboard]: { width: 1040, height: 560, title: "分镜板" },
} satisfies Record<CanvasNodeType, { width: number; height: number; title: string }>;

export const NODE_SPECS = {
    [CanvasNodeType.Image]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Image],
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Text]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Text],
        metadata: { content: "", status: "idle", fontSize: 14 },
    },
    [CanvasNodeType.Config]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Config],
        metadata: { content: "", status: "idle", generationMode: "image" },
    },
    [CanvasNodeType.Video]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Video],
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Audio]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Audio],
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Agent]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Agent],
        metadata: { status: "idle", agentName: "智能体", agentInstruction: "", agentOutputFormat: "plain" },
    },
    [CanvasNodeType.ScriptAgent]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.ScriptAgent],
        metadata: { status: "idle", agentName: "剧本Agent", agentInstruction: SCRIPT_AGENT_INSTRUCTION, agentOutputFormat: "markdown" },
    },
    [CanvasNodeType.CharacterAgent]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.CharacterAgent],
        metadata: { status: "idle", agentName: "角色Agent", agentInstruction: CHARACTER_AGENT_INSTRUCTION, agentOutputFormat: "json" },
    },
    [CanvasNodeType.StoryboardAgent]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.StoryboardAgent],
        metadata: { status: "idle", agentName: "分镜Agent", agentInstruction: STORYBOARD_AGENT_INSTRUCTION, agentOutputFormat: "json" },
    },
    [CanvasNodeType.ProjectBrief]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.ProjectBrief],
        metadata: {
            status: "idle",
            projectBrief: {
                theme: "",
                genre: "科幻",
                visualStyle: "电影感",
                visualStyleImage: "",
                visualStylePrompt: "",
                keyElements: [],
                duration: "60秒",
                story: "",
            },
        },
    },
    [CanvasNodeType.SubjectBoard]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.SubjectBoard],
        metadata: {
            status: "idle",
            subjectBoard: {
                groups: [
                    { id: "characters", title: "角色", kind: "character", items: [] },
                    { id: "scenes", title: "场景", kind: "scene", items: [] },
                    { id: "props", title: "道具", kind: "prop", items: [] },
                ],
            },
        },
    },
    [CanvasNodeType.Storyboard]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Storyboard],
        metadata: { status: "idle", storyboard: { shots: [] } },
    },
} satisfies Record<CanvasNodeType, CanvasNodeSpec>;

export function getNodeSpec(type: CanvasNodeType) {
    return NODE_SPECS[type];
}
