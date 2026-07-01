"use client";

import { Gift, Ticket, WalletCards, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import type { CreditPackage } from "@/services/api/auth";

type CreditRechargePanelProps = {
    credits: number;
    packages: CreditPackage[];
};

export function CreditRechargePanel({ credits, packages }: CreditRechargePanelProps) {
    const items = useMemo(() => [...packages].sort((a, b) => (a.price || 0) - (b.price || 0)), [packages]);
    const [selectedId, setSelectedId] = useState(items[0]?.id || "");
    const selected = items.find((item) => item.id === selectedId) || items[0];
    const bonusCredits = selected?.bonusCredits || 0;
    const baseCredits = selected?.credits || 0;

    if (!items.length) {
        return <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-center text-sm text-neutral-400">暂无充值套餐</div>;
    }

    return (
        <div className="space-y-5 text-left">
            <section className="rounded-xl border border-neutral-700 bg-neutral-900 p-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                            <Zap className="size-4 text-neutral-200" />
                            <span>可用积分</span>
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-white">{credits.toLocaleString()}</div>
                    </div>
                    <div className="flex gap-8 text-right text-sm">
                        <div>
                            <div className="flex items-center justify-end gap-1 text-neutral-500">
                                <WalletCards className="size-3.5" />
                                充值积分
                            </div>
                            <div className="mt-2 font-semibold text-white">{baseCredits.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="flex items-center justify-end gap-1 text-neutral-500">
                                <Gift className="size-3.5" />
                                赠送积分
                            </div>
                            <div className="mt-2 font-semibold text-white">{bonusCredits.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-xl border border-neutral-700 bg-neutral-900 p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <Ticket className="size-4 text-neutral-300" />
                    兑换码兑换
                </div>
                <div className="flex gap-2">
                    <input className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-500" placeholder="请输入兑换码" />
                    <button type="button" className="h-10 cursor-pointer rounded-lg border border-neutral-100 bg-neutral-100 px-5 text-sm font-semibold text-neutral-950" style={{ color: "#111111" }}>
                        兑换
                    </button>
                </div>
            </section>

            <section className="rounded-xl border border-neutral-700 bg-neutral-900 p-5">
                <div className="text-base font-semibold text-white">在线充值</div>
                <div className="mt-2 text-sm text-neutral-500">{calcRateText(selected)}</div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {items.map((item) => {
                        const active = item.id === selected?.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedId(item.id)}
                                className={`h-10 cursor-pointer rounded-lg border px-3 text-sm font-semibold transition ${
                                    active ? "border-neutral-100 bg-neutral-100 text-neutral-950" : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500"
                                }`}
                                style={active ? { color: "#111111" } : undefined}
                            >
                                ¥{formatPrice(item.price)}
                            </button>
                        );
                    })}
                </div>

                {selected ? (
                    <div className="mt-5 rounded-lg bg-neutral-800 p-4 text-sm">
                        <DetailRow label="充值金额" value={`¥${formatPrice(selected.price)}`} />
                        <DetailRow label="获得积分" value={`+${baseCredits.toLocaleString()}`} />
                        <DetailRow label="折扣额外赠送" value={bonusCredits > 0 ? `+${bonusCredits.toLocaleString()}` : "0"} muted={bonusCredits <= 0} />
                        <div className="mt-3 border-t border-neutral-700 pt-3">
                            <DetailRow label="到账积分" value={`+${(baseCredits + bonusCredits).toLocaleString()}`} />
                        </div>
                    </div>
                ) : null}

                <button type="button" className="mt-5 h-11 w-full cursor-pointer rounded-lg border border-neutral-100 bg-neutral-100 text-sm font-semibold text-neutral-950" style={{ color: "#111111" }}>
                    确认支付
                </button>
            </section>
        </div>
    );
}

function DetailRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-4 py-1.5">
            <span className="text-neutral-400">{label}</span>
            <span className={muted ? "font-semibold text-neutral-500" : "font-semibold text-white"}>{value}</span>
        </div>
    );
}

function calcRateText(item?: CreditPackage) {
    if (!item?.price || !item.credits) return "后台可配置不同金额对应的获得积分和赠送积分";
    return `¥${formatPrice(item.price)} 可获得 ${(item.credits + item.bonusCredits).toLocaleString()} 积分`;
}

function formatPrice(value: number) {
    const yuan = (value || 0) / 100;
    return Number.isInteger(yuan) ? `${yuan}` : yuan.toFixed(2);
}
