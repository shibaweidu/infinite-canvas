"use client";

import { Gift, Ticket, WalletCards, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import type { CreditPackage } from "@/services/api/auth";
import { useThemeStore } from "@/stores/use-theme-store";

type CreditRechargePanelProps = {
    credits: number;
    packages: CreditPackage[];
    onPay?: (item: CreditPackage) => void;
    payingId?: string;
};

export function CreditRechargePanel({ credits, packages, onPay, payingId }: CreditRechargePanelProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const items = useMemo(() => [...packages].sort((a, b) => (a.price || 0) - (b.price || 0)), [packages]);
    const [selectedId, setSelectedId] = useState(items[0]?.id || "");
    const selected = items.find((item) => item.id === selectedId) || items[0];
    const bonusCredits = selected?.bonusCredits || 0;
    const baseCredits = selected?.credits || 0;

    if (!items.length) {
        return <div className="rounded-xl border p-6 text-center text-sm" style={{ background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.muted }}>暂无充值套餐</div>;
    }

    return (
        <div className="space-y-5 text-left">
            <section className="rounded-xl border p-5" style={{ background: theme.node.panel, borderColor: theme.node.stroke }}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-sm" style={{ color: theme.node.muted }}>
                            <Zap className="size-4" style={{ color: theme.node.text }} />
                            <span>可用积分</span>
                        </div>
                        <div className="mt-2 text-3xl font-semibold" style={{ color: theme.node.text }}>{credits.toLocaleString()}</div>
                    </div>
                    <div className="flex gap-8 text-right text-sm">
                        <div>
                            <div className="flex items-center justify-end gap-1" style={{ color: theme.node.muted }}>
                                <WalletCards className="size-3.5" />
                                充值积分
                            </div>
                            <div className="mt-2 font-semibold" style={{ color: theme.node.text }}>{baseCredits.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="flex items-center justify-end gap-1" style={{ color: theme.node.muted }}>
                                <Gift className="size-3.5" />
                                赠送积分
                            </div>
                            <div className="mt-2 font-semibold" style={{ color: theme.node.text }}>{bonusCredits.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-xl border p-5" style={{ background: theme.node.panel, borderColor: theme.node.stroke }}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: theme.node.text }}>
                    <Ticket className="size-4" style={{ color: theme.node.text }} />
                    兑换码兑换
                </div>
                <div className="flex gap-2">
                    <input className="h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none placeholder:text-neutral-500" style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }} placeholder="请输入兑换码" />
                    <button type="button" className="h-10 cursor-pointer rounded-lg border border-neutral-100 bg-neutral-100 px-5 text-sm font-semibold text-neutral-950" style={{ color: "#111111" }}>
                        兑换
                    </button>
                </div>
            </section>

            <section className="rounded-xl border p-5" style={{ background: theme.node.panel, borderColor: theme.node.stroke }}>
                <div className="text-base font-semibold" style={{ color: theme.node.text }}>在线充值</div>
                <div className="mt-2 text-sm" style={{ color: theme.node.muted }}>{calcRateText(selected)}</div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {items.map((item) => {
                        const active = item.id === selected?.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedId(item.id)}
                                className="h-10 cursor-pointer rounded-lg border px-3 text-sm font-semibold transition hover:opacity-85"
                                style={active ? { background: theme.toolbar.activeBg, borderColor: theme.node.activeStroke, color: theme.toolbar.activeText } : { background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}
                            >
                                ¥{formatPrice(item.price)}
                            </button>
                        );
                    })}
                </div>

                {selected ? (
                    <div className="mt-5 rounded-lg p-4 text-sm" style={{ background: theme.node.fill }}>
                        <DetailRow theme={theme} label="充值金额" value={`¥${formatPrice(selected.price)}`} />
                        <DetailRow theme={theme} label="获得积分" value={`+${baseCredits.toLocaleString()}`} />
                        <DetailRow theme={theme} label="折扣额外赠送" value={bonusCredits > 0 ? `+${bonusCredits.toLocaleString()}` : "0"} muted={bonusCredits <= 0} />
                        <div className="mt-3 border-t pt-3" style={{ borderColor: theme.node.stroke }}>
                            <DetailRow theme={theme} label="到账积分" value={`+${(baseCredits + bonusCredits).toLocaleString()}`} />
                        </div>
                    </div>
                ) : null}

                <button type="button" onClick={() => selected && onPay?.(selected)} disabled={!selected || payingId === selected.id} className="mt-5 h-11 w-full cursor-pointer rounded-lg border border-neutral-100 bg-neutral-100 text-sm font-semibold text-neutral-950 disabled:opacity-60" style={{ color: "#111111" }}>
                    {payingId === selected?.id ? "处理中..." : selected?.buttonText || "确认支付"}
                </button>
            </section>
        </div>
    );
}

function DetailRow({ theme, label, value, muted }: { theme: CanvasTheme; label: string; value: string; muted?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-4 py-1.5">
            <span style={{ color: theme.node.muted }}>{label}</span>
            <span className="font-semibold" style={{ color: muted ? theme.node.faint : theme.node.text }}>{value}</span>
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
