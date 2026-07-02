"use client";

import { Check, Sparkles } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import type { BillingBenefit } from "@/services/api/auth";
import { useThemeStore } from "@/stores/use-theme-store";

type BillingCardProps = {
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    credits: number;
    priceCycle?: string;
    buttonText?: string;
    creditLabel?: string;
    creditRateText?: string;
    benefits?: BillingBenefit[];
    fallbackButtonText: string;
    fallbackCreditLabel: string;
    onPay?: () => void;
    paying?: boolean;
};

export function BillingCard({
    name,
    description,
    price,
    originalPrice,
    credits,
    priceCycle,
    buttonText,
    creditLabel,
    creditRateText,
    benefits,
    fallbackButtonText,
    fallbackCreditLabel,
    onPay,
    paying,
}: BillingCardProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const displayBenefits = buildBenefits(benefits, description);
    const rateText = creditRateText || calcCreditRateText(price, credits);

    return (
        <section
            className="flex min-h-[466px] w-[326px] max-w-full flex-col border px-5 py-6 text-left shadow-[0_26px_70px_rgba(0,0,0,0.16)]"
            style={{ borderRadius: 18, background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.text }}
        >
            <div>
                <h3 className="text-[18px] font-semibold leading-6 tracking-normal" style={{ color: theme.node.text }}>{name}</h3>
                <div className="mt-6 flex flex-wrap items-end gap-x-2 gap-y-1">
                    <span className="pb-1 text-[12px] font-semibold leading-none" style={{ color: theme.node.text }}>¥</span>
                    <span className="text-[34px] font-semibold leading-[32px]" style={{ color: theme.node.text }}>{formatPrice(price)}</span>
                    {priceCycle ? <span className="pb-1 text-[14px] leading-none" style={{ color: theme.node.muted }}>{priceCycle}</span> : null}
                    {originalPrice ? <span className="pb-1 text-[14px] leading-none line-through" style={{ color: theme.node.faint }}>¥{formatPrice(originalPrice)}</span> : null}
                </div>
                <p className="mt-1 min-h-[44px] text-[14px] leading-[22px]" style={{ color: theme.node.muted }}>{description || "暂无说明"}</p>
            </div>

            <div className="rounded-xl border px-4 py-[14px]" style={{ marginTop: 24, borderRadius: 14, background: theme.node.fill, borderColor: theme.node.stroke }}>
                <div className="flex items-center gap-2 text-[15px] leading-5" style={{ color: theme.node.text }}>
                    <Sparkles className="size-[17px]" style={{ color: theme.node.text }} strokeWidth={2.2} />
                    <span className="text-[20px] font-semibold leading-6" style={{ color: theme.node.text }}>{credits.toLocaleString()}</span>
                    <span className="font-semibold">{creditLabel || fallbackCreditLabel}</span>
                </div>
                {rateText ? <div className="mt-2 text-[12px] leading-4" style={{ color: theme.node.muted }}>{rateText}</div> : null}
            </div>

            <button
                type="button"
                onClick={onPay}
                disabled={paying}
                className="flex h-10 cursor-pointer items-center justify-center rounded-full border border-[#f5f5f5] bg-[#f5f5f5] px-4 text-center text-[14px] font-semibold leading-none text-[#111111] transition hover:bg-white"
                style={{ color: "#111111", marginTop: 18 }}
            >
                {paying ? "处理中..." : buttonText || fallbackButtonText}
            </button>

            <div className="my-6 h-px rounded-full" style={{ background: theme.node.stroke }} />

            <div className="flex flex-1 flex-col gap-[17px]">
                {displayBenefits.map((item, index) => (
                    <div key={`${item.text}-${index}`} className="flex items-start justify-between gap-3 text-[14px]">
                        <span className="flex min-w-0 items-start gap-2" style={{ color: theme.node.text }}>
                            <Check className="mt-[3px] size-[14px] shrink-0" style={{ color: theme.node.text }} strokeWidth={2} />
                            <span className="break-words leading-5">{item.text}</span>
                        </span>
                        {item.tag ? <span className="shrink-0 rounded-full border px-2 py-0.5 text-[12px] leading-4" style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.muted }}>{item.tag}</span> : null}
                    </div>
                ))}
            </div>
        </section>
    );
}

function buildBenefits(items?: BillingBenefit[], description?: string): BillingBenefit[] {
    const valid = (items || []).filter((item) => item.text?.trim());
    if (valid.length) return valid;
    return (description || "")
        .split(/\n|；|;/)
        .map((text) => ({ text: text.trim(), tag: "" }))
        .filter((item) => item.text);
}

function calcCreditRateText(price: number, credits: number) {
    const yuan = price / 100;
    if (yuan <= 0 || credits <= 0) return "";
    return `换算¥10=${Math.round((credits / yuan) * 10).toLocaleString()}积分`;
}

function formatPrice(value: number) {
    const yuan = (value || 0) / 100;
    return Number.isInteger(yuan) ? `${yuan}` : yuan.toFixed(2);
}
