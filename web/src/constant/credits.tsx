import type { ComponentProps } from "react";
import { Zap } from "lucide-react";

export function CreditSymbol({ className, ...props }: ComponentProps<"span">) {
    return (
        <span {...props} className={`inline-flex items-center justify-center ${className || ""}`}>
            <Zap className="size-[1em] fill-current" strokeWidth={2.4} />
        </span>
    );
}

export type ModelCreditCost = {
    model: string;
    type?: "text" | "image" | "video";
    credits: number;
    resolutionCosts?: { resolution: string; credits: number; enabled?: boolean }[];
    secondCredits?: number;
};

export function modelCreditCost(modelCosts: ModelCreditCost[] | undefined, model: string) {
    return modelCosts?.find((item) => item.model === model)?.credits || 0;
}

export function requestCreditCost(options: { channelMode: string; modelCosts?: ModelCreditCost[]; model: string; count?: string | number; mode?: "text" | "image" | "video"; size?: string; resolution?: string; seconds?: string | number }) {
    if (options.channelMode !== "remote") return 0;
    const cost = options.modelCosts?.find((item) => item.model === options.model);
    if (!cost) return 0;
    const mode = options.mode || cost.type || inferModelType(options.model);
    if (mode === "video") {
        const seconds = Math.max(1, Math.floor(Math.abs(Number(options.seconds)) || 1));
        return (cost.secondCredits || cost.credits || 0) * seconds;
    }
    const count = Math.max(1, Math.floor(Math.abs(Number(options.count)) || 1));
    if (mode === "image") {
        const size = options.resolution || options.size || "auto";
        const bucket = imageResolutionBucket(size);
        const resolutionCost = cost.resolutionCosts?.find((item) => item.enabled !== false && (item.resolution === size || item.resolution.toLowerCase() === bucket))?.credits;
        return (resolutionCost ?? cost.credits ?? 0) * count;
    }
    return (cost.credits || 0) * count;
}

function imageResolutionBucket(size: string) {
    const value = size.trim().toLowerCase();
    if (["1k", "2k", "4k"].includes(value)) return value;
    if (["low", "standard", "auto"].includes(value)) return "1k";
    if (["medium", "hd"].includes(value)) return "2k";
    if (value === "high") return "4k";
    const match = value.match(/^(\d+)x(\d+)$/);
    if (!match) return "1k";
    const shortSide = Math.min(Number(match[1]), Number(match[2]));
    if (shortSide > 1600) return "4k";
    if (shortSide > 1100) return "2k";
    return "1k";
}

function inferModelType(model: string): "text" | "image" | "video" {
    const value = model.toLowerCase();
    if (["video", "sora", "veo", "kling", "runway", "grok-imagine-video"].some((key) => value.includes(key))) return "video";
    if (["image", "dall", "flux", "stable", "midjourney", "gpt-image"].some((key) => value.includes(key))) return "image";
    return "text";
}
