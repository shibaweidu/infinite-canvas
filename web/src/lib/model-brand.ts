export type ModelBrand = {
    name: string;
    icon: string;
    initials: string;
    invertInDark?: boolean;
};

const brands: Array<{ keywords: string[]; brand: ModelBrand }> = [
    { keywords: ["claude", "anthropic"], brand: { name: "Claude", icon: "/icons/claude.svg", initials: "C" } },
    { keywords: ["gemini", "imagen", "google"], brand: { name: "Google", icon: "/icons/gemini.svg", initials: "G" } },
    { keywords: ["gpt", "openai", "dall-e", "dalle"], brand: { name: "OpenAI", icon: "/icons/openai.svg", initials: "O", invertInDark: true } },
    { keywords: ["grok", "xai"], brand: { name: "xAI", icon: "/icons/grok.svg", initials: "X", invertInDark: true } },
    { keywords: ["deepseek"], brand: { name: "DeepSeek", icon: "/icons/deepseek.svg", initials: "D" } },
    { keywords: ["glm", "zhipu"], brand: { name: "智谱", icon: "/icons/glm.svg", initials: "GL" } },
    { keywords: ["qwen", "tongyi"], brand: { name: "通义千问", icon: "", initials: "QW" } },
    { keywords: ["kimi", "moonshot"], brand: { name: "Kimi", icon: "", initials: "K" } },
    { keywords: ["minimax"], brand: { name: "MiniMax", icon: "", initials: "M" } },
    { keywords: ["doubao", "seedance", "seedream"], brand: { name: "火山引擎", icon: "", initials: "V" } },
    { keywords: ["flux"], brand: { name: "Flux", icon: "", initials: "FL" } },
];

export function resolveModelBrand(model: string, providerName = ""): ModelBrand {
    const value = `${model} ${providerName}`.toLowerCase();
    return brands.find((item) => item.keywords.some((keyword) => value.includes(keyword)))?.brand || { name: "模型", icon: "", initials: model.trim().slice(0, 2).toUpperCase() || "AI" };
}
