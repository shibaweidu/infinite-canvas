"use client";

import { Check, Sparkles } from "lucide-react";

import type { BillingBenefit } from "@/services/api/auth";

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
}: BillingCardProps) {
    const displayBenefits = buildBenefits(benefits, description);
    const rateText = creditRateText || calcCreditRateText(price, credits);

    return (
        <section
            className="flex min-h-[466px] w-[326px] max-w-full flex-col border border-[#4a4a4a] bg-[#151515] px-5 py-6 text-left text-neutral-100 shadow-[0_26px_70px_rgba(0,0,0,0.28)]"
            style={{ borderRadius: 18 }}
        >
            <div>
                <h3 className="text-[18px] font-semibold leading-6 tracking-normal text-white">{name}</h3>
                <div className="mt-6 flex flex-wrap items-end gap-x-2 gap-y-1">
                    <span className="pb-1 text-[12px] font-semibold leading-none text-white">¥</span>
                    <span className="text-[34px] font-semibold leading-[32px] text-white">{formatPrice(price)}</span>
                    {priceCycle ? <span className="pb-1 text-[14px] leading-none text-neutral-300">{priceCycle}</span> : null}
                    {originalPrice ? <span className="pb-1 text-[14px] leading-none text-neutral-500 line-through">¥{formatPrice(originalPrice)}</span> : null}
                </div>
                <p className="mt-1 min-h-[44px] text-[14px] leading-[22px] text-[#a8a8a8]">{description || "暂无说明"}</p>
            </div>

            <div className="rounded-xl border border-[#4f4f4f] bg-[#242424] px-4 py-[14px]" style={{ marginTop: 24, borderRadius: 14 }}>
                <div className="flex items-center gap-2 text-[15px] leading-5 text-[#d8d8d8]">
                    <Sparkles className="size-[17px] text-white" strokeWidth={2.2} />
                    <span className="text-[20px] font-semibold leading-6 text-white">{credits.toLocaleString()}</span>
                    <span className="font-semibold">{creditLabel || fallbackCreditLabel}</span>
                </div>
                {rateText ? <div className="mt-2 text-[12px] leading-4 text-[#8f8f8f]">{rateText}</div> : null}
            </div>

            <button
                type="button"
                className="flex h-10 cursor-pointer items-center justify-center rounded-full border border-[#f5f5f5] bg-[#f5f5f5] px-4 text-center text-[14px] font-semibold leading-none text-[#111111] transition hover:bg-white"
                style={{ color: "#111111", marginTop: 18 }}
            >
                {buttonText || fallbackButtonText}
            </button>

            <div className="my-6 h-px rounded-full bg-[#3a3a3a]" />

            <div className="flex flex-1 flex-col gap-[17px]">
                {displayBenefits.map((item, index) => (
                    <div key={`${item.text}-${index}`} className="flex items-start justify-between gap-3 text-[14px]">
                        <span className="flex min-w-0 items-start gap-2 text-[#eeeeee]">
                            <Check className="mt-[3px] size-[14px] shrink-0 text-white" strokeWidth={2} />
                            <span className="break-words leading-5">{item.text}</span>
                        </span>
                        {item.tag ? <span className="shrink-0 rounded-full border border-[#4a4a4a] bg-[#252525] px-2 py-0.5 text-[12px] leading-4 text-[#cfcfcf]">{item.tag}</span> : null}
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
