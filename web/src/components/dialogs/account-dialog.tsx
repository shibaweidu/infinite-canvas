"use client";

import { App, Empty, Modal, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CreditCard, History, ReceiptText, UserRound, WalletCards, X } from "lucide-react";
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
    { title: "变动", dataIndex: "amount", width: 100, render: (value: number) => <span className={value >= 0 ? "font-semibold text-neutral-950 dark:text-neutral-100" : "text-neutral-500"}>{value > 0 ? `+${value}` : value}</span> },
    { title: "余额", dataIndex: "balance", width: 100 },
    { title: "备注", dataIndex: "remark" },
];

type AccountDialogProps = {
    open: boolean;
    onClose: () => void;
    initialTab?: AccountTab;
};

export function AccountDialog({ open, onClose, initialTab = "profile" }: AccountDialogProps) {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const storeUser = useUserStore((state) => state.user);
    const [summary, setSummary] = useState<AccountSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
    const user = summary?.user || storeUser;
    const visibleNav = useMemo(() => accountNav.filter((item) => item.key !== "plans" || summary?.plans?.length).filter((item) => item.key !== "packages" || summary?.creditPackages?.length), [summary]);
    const title = useMemo(() => visibleNav.find((item) => item.key === activeTab)?.label || "个人中心", [activeTab, visibleNav]);

    useEffect(() => {
        if (open && initialTab) {
            setActiveTab(initialTab);
        }
    }, [open, initialTab]);

    useEffect(() => {
        if (!token || !open) return;
        setLoading(true);
        fetchAccountSummary(token)
            .then(setSummary)
            .catch((error) => message.error(error instanceof Error ? error.message : "个人中心读取失败"))
            .finally(() => setLoading(false));
    }, [message, token, open]);

    useEffect(() => {
        if (summary && !visibleNav.some((item) => item.key === activeTab)) {
            setActiveTab("profile");
        }
    }, [activeTab, summary, visibleNav]);

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={960}
            closeIcon={<X className="size-4" />}
            styles={{
                body: { padding: 0 },
                content: { borderRadius: 16, overflow: "hidden" },
            }}
            title={null}
        >
            <div className="grid md:grid-cols-[200px_minmax(0,1fr)]">
                <aside className="border-r border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">个人中心</div>
                        <div className="mt-1 truncate text-base font-semibold text-neutral-950 dark:text-neutral-100">{user?.displayName || user?.username || "我的账号"}</div>
                    </div>
                    <nav className="flex flex-col gap-1">
                        {visibleNav.map((item) => {
                            const active = item.key === activeTab;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setActiveTab(item.key)}
                                    className={`flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm transition ${
                                        active
                                            ? "bg-neutral-950 font-medium text-white shadow-sm dark:bg-neutral-700 dark:text-neutral-50"
                                            : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
                                    }`}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                <section className="min-w-0 p-6">
                    <div className="mb-5 flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
                        <div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">{title}</div>
                            <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-neutral-100">{user?.displayName || user?.username || "我的账号"}</h2>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800">
                            <CreditSymbol className="text-base text-neutral-950 dark:text-neutral-100" />
                            <span className="font-semibold text-neutral-950 dark:text-neutral-100">{(user?.credits || 0).toLocaleString()}</span>
                            <span className="text-neutral-500 dark:text-neutral-400">积分</span>
                        </div>
                    </div>

                    {activeTab === "profile" && (
                        <section className="grid gap-3 md:grid-cols-2">
                            <InfoCard label="用户名" value={user?.username || "-"} />
                            <InfoCard label="显示名称" value={user?.displayName || "-"} />
                            <InfoCard label="角色" value={user?.role || "-"} />
                            <InfoCard label="当前积分" value={`${user?.credits || 0}`} />
                            <InfoCard label="创建时间" value={formatDateTime(user?.createdAt)} />
                            <InfoCard label="更新时间" value={formatDateTime(user?.updatedAt)} />
                        </section>
                    )}

                    {activeTab === "plans" && (
                        <div className="grid justify-center gap-4 sm:grid-cols-[repeat(auto-fit,326px)]">
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
                            {!summary?.plans?.length && <Empty className="py-8" description={loading ? "套餐加载中" : "暂无套餐"} />}
                        </div>
                    )}

                    {activeTab === "packages" && (
                        summary?.creditPackages?.length ? <CreditRechargePanel credits={user?.credits || 0} packages={summary.creditPackages} /> : <Empty className="py-8" description={loading ? "充值包加载中" : "暂无充值包"} />
                    )}

                    {activeTab === "recharge" && <Table rowKey="id" size="small" columns={logColumns} dataSource={summary?.rechargeRecords || []} pagination={{ pageSize: 10 }} />}
                    {activeTab === "consume" && <Table rowKey="id" size="small" columns={logColumns} dataSource={summary?.consumeRecords || []} pagination={{ pageSize: 10 }} />}
                </section>
            </div>
        </Modal>
    );
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
            <div className="mt-1.5 truncate text-sm font-medium text-neutral-950 dark:text-neutral-100">{value}</div>
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
