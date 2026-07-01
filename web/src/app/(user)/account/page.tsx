"use client";

import { App, Button, Empty, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CreditCard, History, ReceiptText, UserRound, WalletCards } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { BillingCard } from "@/components/billing-card";
import { CreditRechargePanel } from "@/components/credit-recharge-panel";
import { CreditSymbol } from "@/constant/credits";
import { fetchAccountSummary, type AccountCreditLog, type AccountSummary } from "@/services/api/auth";
import { useUserStore } from "@/stores/use-user-store";

type AccountTab = "profile" | "plans" | "packages" | "recharge" | "consume";

const accountNav: Array<{ key: AccountTab; label: string; icon: ReactNode }> = [
    { key: "profile", label: "账号资料", icon: <UserRound className="size-4" /> },
    { key: "plans", label: "订阅套餐", icon: <WalletCards className="size-4" /> },
    { key: "packages", label: "积分充值", icon: <CreditCard className="size-4" /> },
    { key: "recharge", label: "充值记录", icon: <ReceiptText className="size-4" /> },
    { key: "consume", label: "消费记录", icon: <History className="size-4" /> },
];

const logColumns: ColumnsType<AccountCreditLog> = [
    { title: "时间", dataIndex: "createdAt", width: 180, render: formatDateTime },
    { title: "类型", dataIndex: "type", width: 130, render: (value) => <Tag>{value}</Tag> },
    { title: "变动", dataIndex: "amount", width: 100, render: (value: number) => <span className={value >= 0 ? "text-neutral-950 dark:text-neutral-100" : "text-neutral-500"}>{value > 0 ? `+${value}` : value}</span> },
    { title: "余额", dataIndex: "balance", width: 100 },
    { title: "备注", dataIndex: "remark" },
];

export default function AccountPage() {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const storeUser = useUserStore((state) => state.user);
    const [summary, setSummary] = useState<AccountSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<AccountTab>("profile");
    const user = summary?.user || storeUser;
    const visibleNav = useMemo(() => accountNav.filter((item) => item.key !== "plans" || summary?.plans?.length).filter((item) => item.key !== "packages" || summary?.creditPackages?.length), [summary]);
    const title = useMemo(() => visibleNav.find((item) => item.key === activeTab)?.label || "个人中心", [activeTab, visibleNav]);

    useEffect(() => {
        if (!token) return;
        setLoading(true);
        fetchAccountSummary(token)
            .then(setSummary)
            .catch((error) => message.error(error instanceof Error ? error.message : "个人中心读取失败"))
            .finally(() => setLoading(false));
    }, [message, token]);

    useEffect(() => {
        if (summary && !visibleNav.some((item) => item.key === activeTab)) {
            setActiveTab("profile");
        }
    }, [activeTab, summary, visibleNav]);

    if (!token) {
        return (
            <main className="grid min-h-[calc(100vh-64px)] place-items-center bg-neutral-950 px-4 text-neutral-100">
                <div className="max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center">
                    <UserRound className="mx-auto mb-3 size-8 text-neutral-400" />
                    <h1 className="text-lg font-semibold">请先登录</h1>
                    <p className="mt-2 text-sm text-neutral-400">登录后可查看积分和账号记录。</p>
                    <Button className="mt-5" href="/login?redirect=/account">
                        去登录
                    </Button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-[calc(100vh-64px)] bg-neutral-950 px-4 py-6 text-neutral-100 md:px-6">
            <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="h-fit rounded-lg border border-neutral-800 bg-neutral-900 p-2">
                    <div className="px-3 py-3">
                        <div className="text-xs text-neutral-500">个人中心</div>
                        <div className="mt-1 truncate text-lg font-semibold">{user?.displayName || user?.username || "我的账号"}</div>
                    </div>
                    <nav className="mt-2 flex flex-col gap-1">
                        {visibleNav.map((item) => {
                            const active = item.key === activeTab;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setActiveTab(item.key)}
                                    className={`flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm transition ${active ? "bg-neutral-100 text-neutral-950" : "text-neutral-300 hover:bg-neutral-800 hover:text-white"}`}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                <section className="min-w-0">
                    <div className="mb-5 flex flex-col gap-3 border-b border-neutral-800 pb-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <div className="text-sm text-neutral-500">{title}</div>
                            <h1 className="mt-1 text-2xl font-semibold tracking-normal">{user?.displayName || user?.username || "我的账号"}</h1>
                        </div>
                        <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
                            <CreditSymbol className="text-base" />
                            <span className="font-semibold">{(user?.credits || 0).toLocaleString()}</span>
                            <span className="text-neutral-500">积分</span>
                        </div>
                    </div>

                    {activeTab === "profile" ? (
                        <section className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 md:grid-cols-3">
                            <Info label="用户名" value={user?.username || "-"} />
                            <Info label="显示名称" value={user?.displayName || "-"} />
                            <Info label="角色" value={user?.role || "-"} />
                            <Info label="当前积分" value={`${user?.credits || 0}`} />
                            <Info label="创建时间" value={formatDateTime(user?.createdAt)} />
                            <Info label="更新时间" value={formatDateTime(user?.updatedAt)} />
                        </section>
                    ) : null}

                    {activeTab === "plans" ? (
                        <div className="grid justify-center gap-5 sm:grid-cols-[repeat(auto-fit,326px)] md:justify-start">
                            {(summary?.plans || []).map((item) => (
                                <BillingCard
                                    key={item.id}
                                    name={item.name}
                                    description={item.description}
                                    price={item.price}
                                    originalPrice={item.originalPrice}
                                    credits={item.credits}
                                    priceCycle={item.priceCycle}
                                    buttonText={item.buttonText}
                                    creditLabel={item.creditLabel}
                                    creditRateText={item.creditRateText}
                                    benefits={item.benefits}
                                    fallbackButtonText="订阅套餐"
                                    fallbackCreditLabel="积分每月"
                                />
                            ))}
                            {!summary?.plans?.length ? <Empty description={loading ? "套餐加载中" : "暂无套餐"} /> : null}
                        </div>
                    ) : null}

                    {activeTab === "packages" ? (
                        summary?.creditPackages?.length ? <CreditRechargePanel credits={user?.credits || 0} packages={summary.creditPackages} /> : <Empty description={loading ? "充值包加载中" : "暂无充值包"} />
                    ) : null}

                    {activeTab === "recharge" ? <Table rowKey="id" size="small" columns={logColumns} dataSource={summary?.rechargeRecords || []} pagination={{ pageSize: 10 }} /> : null}
                    {activeTab === "consume" ? <Table rowKey="id" size="small" columns={logColumns} dataSource={summary?.consumeRecords || []} pagination={{ pageSize: 10 }} /> : null}

                    {(summary?.plans?.length || summary?.creditPackages?.length) ? <div className="mt-4 text-xs text-neutral-500">
                        套餐和充值规则由后台配置；支付接入完成前，可由管理员在用户管理中调整积分。
                        <Link href="/announcements" className="ml-2 text-neutral-200 underline">
                            查看公告
                        </Link>
                    </div> : null}
                </section>
            </div>
        </main>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg bg-neutral-800 p-3">
            <div className="text-xs text-neutral-500">{label}</div>
            <div className="mt-1 truncate text-sm font-medium">{value}</div>
        </div>
    );
}

function formatDateTime(value?: string) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const pad = (next: number) => String(next).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
