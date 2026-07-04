import { Bell, FileText, Images, Scan, Sparkles } from "lucide-react";

export const navigationTools = [
    {
        slug: "canvas",
        label: "我的画布",
        icon: Scan,
    },
    {
        slug: "workbench",
        label: "创作工作台",
        icon: Sparkles,
    },
    {
        slug: "prompts",
        label: "提示词库",
        icon: FileText,
    },
    {
        slug: "assets",
        label: "我的素材",
        icon: Images,
    },
    {
        slug: "announcements",
        label: "公告",
        icon: Bell,
    },
] as const;

export type NavigationToolSlug = (typeof navigationTools)[number]["slug"];
