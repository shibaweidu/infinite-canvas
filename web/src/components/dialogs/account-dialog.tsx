"use client";

import { App, Button, Descriptions, Drawer, Empty, Modal, Progress, Space, Table, Tag, Timeline, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CreditCard, History, ListChecks, ReceiptText, UserRound, WalletCards, X } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BillingCard } from "@/components/billing-card";
import { CreditRechargePanel } from "@/components/credit-recharge-panel";
import { CreditSymbol } from "@/constant/credits";
import { cancelAccountTask, createPaymentOrder, fetchAccountSummary, fetchAccountTask, fetchAccountTasks, retryAccountTask, type AccountCreditLog, type AccountSummary, type AccountTask, type AccountTaskStatus, type CreditPackage, type SubscriptionPlan } from "@/services/api/auth";
import { useUserStore } from "@/stores/use-user-store";

type AccountTab = "profile" | "plans" | "packages" | "tasks" | "recharge" | "consume";

const accountNav: Array<{ key: AccountTab; label: string; icon: ReactNode }> = [
    { key: "profile", label: "账号资料", icon: <UserRound className="size-4" /> },
    { key: "plans", label: "订阅套餐", icon: <WalletCards className="size-4" /> },
    { key: "packages", label: "积分充值", icon: <CreditCard className="size-4" /> },
    { key: "tasks", label: "我的任务", icon: <ListChecks className="size-4" /> },
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
    const { message, modal } = App.useApp();
    const token = useUserStore((state) => state.token);
    const storeUser = useUserStore((state) => state.user);
    const [summary, setSummary] = useState<AccountSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [taskLoading, setTaskLoading] = useState(false);
    const [tasks, setTasks] = useState<AccountTask[]>([]);
    const [taskTotal, setTaskTotal] = useState(0);
    const [taskPage, setTaskPage] = useState(1);
    const [taskPageSize, setTaskPageSize] = useState(10);
    const [taskDetail, setTaskDetail] = useState<AccountTask | null>(null);
    const [taskDetailOpen, setTaskDetailOpen] = useState(false);
    const [taskDetailLoading, setTaskDetailLoading] = useState(false);
    const [actingTaskId, setActingTaskId] = useState("");
    const [payingId, setPayingId] = useState("");
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

    const loadTasks = useCallback(async () => {
        if (!token || !open || activeTab !== "tasks") return;
        setTaskLoading(true);
        try {
            const result = await fetchAccountTasks(token, { page: taskPage, pageSize: taskPageSize });
            setTasks(result.items || []);
            setTaskTotal(result.total || 0);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "任务读取失败");
        } finally {
            setTaskLoading(false);
        }
    }, [activeTab, message, open, taskPage, taskPageSize, token]);

    useEffect(() => {
        void loadTasks();
    }, [loadTasks]);

    useEffect(() => {
        if (!open || activeTab !== "tasks" || !tasks.some((item) => item.status === "pending" || item.status === "running")) return;
        const timer = window.setInterval(() => void loadTasks(), 3000);
        return () => window.clearInterval(timer);
    }, [activeTab, loadTasks, open, tasks]);

    const openTaskDetail = useCallback(
        async (id: string) => {
            if (!token) return;
            setTaskDetailOpen(true);
            setTaskDetailLoading(true);
            try {
                setTaskDetail(await fetchAccountTask(token, id));
            } catch (error) {
                message.error(error instanceof Error ? error.message : "任务详情读取失败");
            } finally {
                setTaskDetailLoading(false);
            }
        },
        [message, token],
    );

    const startPayment = async (type: "subscription" | "credit", item: SubscriptionPlan | CreditPackage) => {
        if (!token) {
            message.warning("请先登录");
            return;
        }
        setPayingId(item.id);
        try {
            const result = await createPaymentOrder(token, type, item.id);
            if (!result.payUrl) throw new Error("支付链接生成失败");
            window.location.href = result.payUrl;
        } catch (error) {
            message.error(error instanceof Error ? error.message : "创建支付订单失败");
        } finally {
            setPayingId("");
        }
    };

    const refreshTaskDetail = async (id?: string) => {
        await loadTasks();
        if (id && taskDetailOpen) await openTaskDetail(id);
    };

    const retryTask = (item: AccountTask) => {
        if (!token) return;
        modal.confirm({
            title: "重试任务",
            content: `确认基于任务 ${item.id} 重新提交一次吗？`,
            okText: "重试",
            cancelText: "取消",
            onOk: async () => {
                setActingTaskId(item.id);
                try {
                    const next = await retryAccountTask(token, item.id);
                    message.success("已提交重试任务");
                    await refreshTaskDetail(next.id);
                } catch (error) {
                    message.error(error instanceof Error ? error.message : "任务重试失败");
                } finally {
                    setActingTaskId("");
                }
            },
        });
    };

    const cancelTask = (item: AccountTask) => {
        if (!token) return;
        modal.confirm({
            title: "取消任务",
            content: `确认取消排队中的任务 ${item.id} 吗？`,
            okText: "取消任务",
            cancelText: "返回",
            onOk: async () => {
                setActingTaskId(item.id);
                try {
                    const next = await cancelAccountTask(token, item.id);
                    message.success("任务已取消");
                    await refreshTaskDetail(next.id);
                } catch (error) {
                    message.error(error instanceof Error ? error.message : "任务取消失败");
                } finally {
                    setActingTaskId("");
                }
            },
        });
    };

    const taskColumns: ColumnsType<AccountTask> = [
        { title: "提交时间", dataIndex: "createdAt", width: 170, render: formatDateTime },
        { title: "类型", dataIndex: "typeLabel", width: 110, render: (_, item) => item.typeLabel || item.type },
        { title: "模型", dataIndex: "model", width: 150, ellipsis: true, render: (value) => value || "-" },
        { title: "状态", dataIndex: "status", width: 90, render: (_, item) => taskStatusTag(item.status, item.statusLabel) },
        { title: "进度", dataIndex: "progress", width: 130, render: (_, item) => <Progress percent={item.progress} size="small" status={item.status === "failed" ? "exception" : "normal"} /> },
        { title: "积分", dataIndex: "credits", width: 80, render: (value: number) => value || 0 },
        { title: "说明", dataIndex: "summary", ellipsis: true, render: (_, item) => item.error || item.summary || item.title || "-" },
        {
            title: "操作",
            key: "action",
            width: 190,
            render: (_, item) => {
                return (
                    <Space size={4}>
                        <Button size="small" type="text" className="cursor-pointer" onClick={() => void openTaskDetail(item.id)}>
                            详情
                        </Button>
                        <Button size="small" type="text" disabled={item.status !== "failed" && item.status !== "canceled"} loading={actingTaskId === item.id} className="cursor-pointer" onClick={() => retryTask(item)}>
                            重试
                        </Button>
                        <Button size="small" type="text" disabled={item.status !== "pending"} loading={actingTaskId === item.id} className="cursor-pointer" onClick={() => cancelTask(item)}>
                            取消
                        </Button>
                    </Space>
                );
            },
        },
    ];

    return (
        <>
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
                                            ? "bg-neutral-200 font-medium text-neutral-950 shadow-sm dark:bg-neutral-700 dark:text-neutral-50"
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
                                    onPay={() => void startPayment("subscription", item)}
                                    paying={payingId === item.id}
                                />
                            ))}
                            {!summary?.plans?.length && <Empty className="py-8" description={loading ? "套餐加载中" : "暂无套餐"} />}
                        </div>
                    )}

                    {activeTab === "packages" && (
                        summary?.creditPackages?.length ? <CreditRechargePanel credits={user?.credits || 0} packages={summary.creditPackages} onPay={(item) => void startPayment("credit", item)} payingId={payingId} /> : <Empty className="py-8" description={loading ? "充值包加载中" : "暂无充值包"} />
                    )}

                    {activeTab === "tasks" && (
                        <Table
                            rowKey="id"
                            size="small"
                            columns={taskColumns}
                            dataSource={tasks}
                            loading={taskLoading}
                            scroll={{ x: 980 }}
                            pagination={{
                                current: taskPage,
                                pageSize: taskPageSize,
                                total: taskTotal,
                                showSizeChanger: true,
                                showTotal: (total) => `共 ${total} 条`,
                                onChange: (page, pageSize) => {
                                    setTaskPage(page);
                                    setTaskPageSize(pageSize);
                                },
                            }}
                        />
                    )}
                    {activeTab === "recharge" && <Table rowKey="id" size="small" columns={logColumns} dataSource={summary?.rechargeRecords || []} pagination={{ pageSize: 10 }} />}
                    {activeTab === "consume" && <Table rowKey="id" size="small" columns={logColumns} dataSource={summary?.consumeRecords || []} pagination={{ pageSize: 10 }} />}
                </section>
            </div>
            </Modal>
            <Drawer
                width={620}
                title="任务详情"
                open={taskDetailOpen}
                onClose={() => setTaskDetailOpen(false)}
                loading={taskDetailLoading}
                extra={
                    taskDetail ? (
                        <Space>
                            <Button disabled={taskDetail.status !== "failed" && taskDetail.status !== "canceled"} loading={actingTaskId === taskDetail.id} className="cursor-pointer" onClick={() => retryTask(taskDetail)}>
                                重试
                            </Button>
                            <Button disabled={taskDetail.status !== "pending"} loading={actingTaskId === taskDetail.id} className="cursor-pointer" onClick={() => cancelTask(taskDetail)}>
                                取消
                            </Button>
                        </Space>
                    ) : null
                }
            >
                {taskDetail ? (
                    <Space direction="vertical" size={16} className="w-full">
                        <TaskPreview task={taskDetail} />
                        <Descriptions column={1} size="small" bordered>
                            <Descriptions.Item label="任务 ID">
                                <Typography.Text copyable={{ text: taskDetail.id }}>{taskDetail.id}</Typography.Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="任务类型">{taskDetail.typeLabel || taskDetail.type}</Descriptions.Item>
                            <Descriptions.Item label="任务状态">{taskStatusTag(taskDetail.status, taskDetail.statusLabel)}</Descriptions.Item>
                            <Descriptions.Item label="模型">{taskDetail.model || "-"}</Descriptions.Item>
                            <Descriptions.Item label="积分">{taskDetail.credits || 0}</Descriptions.Item>
                            <Descriptions.Item label="提交时间">{formatDateTime(taskDetail.createdAt)}</Descriptions.Item>
                            <Descriptions.Item label="开始时间">{formatDateTime(taskDetail.startedAt)}</Descriptions.Item>
                            <Descriptions.Item label="结束时间">{formatDateTime(taskDetail.finishedAt)}</Descriptions.Item>
                            <Descriptions.Item label="排队耗时">{formatDuration(taskDetail.queueDurationMs)}</Descriptions.Item>
                            <Descriptions.Item label="执行耗时">{formatDuration(taskDetail.runDurationMs)}</Descriptions.Item>
                            <Descriptions.Item label="总耗时">{formatDuration(taskDetail.durationMs)}</Descriptions.Item>
                            <Descriptions.Item label="说明">{taskDetail.error || taskDetail.summary || taskDetail.title || "-"}</Descriptions.Item>
                        </Descriptions>
                        <TaskTimeline task={taskDetail} />
                    </Space>
                ) : null}
            </Drawer>
        </>
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

function TaskPreview({ task }: { task: AccountTask }) {
    const links = task.resultLinks || [];
    if (!links.length) return null;
    return (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
            <div className="mb-3 text-sm font-medium text-neutral-950 dark:text-neutral-100">结果预览</div>
            <div className="grid gap-3">
                {links.map((link, index) => {
                    const mediaType = mediaKind(link.url, link.type);
                    return (
                        <div key={`${link.url}-${index}`} className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
                            {mediaType === "image" ? <img src={link.url} alt={link.label || "任务结果"} className="max-h-[360px] w-full object-contain" /> : null}
                            {mediaType === "video" ? <video src={link.url} controls className="max-h-[360px] w-full bg-black" /> : null}
                            {mediaType === "other" ? (
                                <div className="flex items-center justify-between gap-3 p-3">
                                    <Typography.Text ellipsis className="min-w-0">
                                        {link.label || "结果链接"}：{link.url}
                                    </Typography.Text>
                                    <Button size="small" href={link.url} target="_blank" rel="noreferrer" className="cursor-pointer">
                                        打开
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-3 border-t border-neutral-200 p-3 dark:border-neutral-700">
                                    <Typography.Text ellipsis className="min-w-0 text-xs text-neutral-500 dark:text-neutral-400">
                                        {link.url}
                                    </Typography.Text>
                                    <Button size="small" href={link.url} target="_blank" rel="noreferrer" className="cursor-pointer">
                                        原图
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function TaskTimeline({ task }: { task: AccountTask }) {
    const items = task.timeline || [];
    if (!items.length) return null;
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
            <div className="mb-3 text-sm font-medium text-neutral-950 dark:text-neutral-100">执行时间线</div>
            <Timeline
                items={items.map((item) => ({
                    color: item.status === "error" ? "red" : "gray",
                    children: (
                        <Space direction="vertical" size={1}>
                            <Typography.Text strong>{item.title}</Typography.Text>
                            <Typography.Text type="secondary">{formatDateTime(item.time)}</Typography.Text>
                            <Typography.Text>{item.description || "-"}</Typography.Text>
                        </Space>
                    ),
                }))}
            />
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

function formatDuration(value?: number) {
    const ms = Math.max(0, value || 0);
    if (!ms) return "-";
    if (ms < 1000) return `${ms} ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours) return `${hours}小时 ${minutes % 60}分钟`;
    if (minutes) return `${minutes}分钟 ${seconds % 60}秒`;
    return `${seconds}秒`;
}

function taskStatusTag(status: AccountTaskStatus, label: string) {
    if (status === "failed") return <Tag color="error">{label || "失败"}</Tag>;
    if (status === "pending") return <Tag>{label || "排队中"}</Tag>;
    if (status === "running") return <Tag>{label || "运行中"}</Tag>;
    if (status === "success") return <Tag>{label || "成功"}</Tag>;
    return <Tag>{label || status}</Tag>;
}

function mediaKind(url: string, type: string) {
    const value = `${type} ${url}`.toLowerCase();
    if (value.includes("image/") || /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/.test(value)) return "image";
    if (value.includes("video/") || /\.(mp4|webm|mov|m4v)(\?|#|$)/.test(value)) return "video";
    return "other";
}
