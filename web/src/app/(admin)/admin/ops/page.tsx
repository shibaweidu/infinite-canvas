"use client";

import { ApiOutlined, CloudServerOutlined, DatabaseOutlined, FileDoneOutlined, HddOutlined, ReloadOutlined, SafetyCertificateOutlined, SettingOutlined, ThunderboltOutlined, WarningOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Descriptions, Flex, Progress, Space, Statistic, Tabs, Tag, Typography } from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import type { ReactNode } from "react";

import {
    createAdminDatabaseBackup,
    fetchAdminDatabaseBackups,
    fetchAdminDatabaseStatus,
    fetchAdminOpsDashboard,
    fetchAdminServerStatus,
    fetchAdminSettings,
    fetchAdminSystemTasks,
    type AdminBackupFile,
    type AdminErrorLog,
    type AdminOperationLog,
    type AdminOpsDashboard,
    type AdminOpsMetricPoint,
    type AdminOpsRecentRequest,
    type AdminOpsSlowEndpoint,
    type AdminSystemTask,
} from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

const neutral = {
    ink: "#111827",
    text: "#1f2937",
    sub: "#6b7280",
    border: "#e5e7eb",
    soft: "#f5f5f5",
    track: "#e5e7eb",
};

const timeText = (value?: string) => (value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-");
const moneyText = (value: number) => `¥${(Math.max(0, value || 0) / 100).toFixed(2)}`;
const sizeText = (value = 0) => {
    if (value > 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
    if (value > 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${value} B`;
};
const durationText = (seconds = 0) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return [days ? `${days}天` : "", hours ? `${hours}小时` : "", minutes ? `${minutes}分钟` : ""].filter(Boolean).join(" ") || `${Math.max(0, seconds)}秒`;
};
const msText = (value = 0) => {
    if (!value) return "-";
    if (value < 1000) return `${value} ms`;
    return `${(value / 1000).toFixed(2)} 秒`;
};

export default function AdminOpsPage() {
    const token = useUserStore((state) => state.token);
    const queryClient = useQueryClient();
    const { message } = App.useApp();

    const dashboardQuery = useQuery({ queryKey: ["admin", "ops-dashboard", token], queryFn: () => fetchAdminOpsDashboard(token), enabled: Boolean(token), retry: false, refetchInterval: 5000 });
    const databaseQuery = useQuery({ queryKey: ["admin", "database-status", token], queryFn: () => fetchAdminDatabaseStatus(token), enabled: Boolean(token), retry: false });
    const serverQuery = useQuery({ queryKey: ["admin", "server-status", token], queryFn: () => fetchAdminServerStatus(token), enabled: Boolean(token), retry: false, refetchInterval: 5000 });
    const settingsQuery = useQuery({ queryKey: ["admin", "settings", "ops", token], queryFn: () => fetchAdminSettings(token), enabled: Boolean(token), retry: false });
    const taskQuery = useQuery({ queryKey: ["admin", "system-tasks", token], queryFn: () => fetchAdminSystemTasks(token, { page: 1, pageSize: 50 }), enabled: Boolean(token), retry: false, refetchInterval: (query) => ((query.state.data?.items || []).some((item) => item.status === "pending" || item.status === "running") ? 3000 : false) });
    const hasActiveTask = (taskQuery.data?.items || []).some((item) => item.status === "pending" || item.status === "running");
    const backupsQuery = useQuery({ queryKey: ["admin", "database-backups", token], queryFn: () => fetchAdminDatabaseBackups(token), enabled: Boolean(token), retry: false, refetchInterval: hasActiveTask ? 3000 : false });

    const backupMutation = useMutation({
        mutationFn: () => createAdminDatabaseBackup(token),
        onSuccess: async () => {
            await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin", "database-backups"] }), queryClient.invalidateQueries({ queryKey: ["admin", "system-tasks"] }), queryClient.invalidateQueries({ queryKey: ["admin", "ops-dashboard"] })]);
            message.success("备份任务已加入队列");
        },
        onError: (error) => message.error(error instanceof Error ? error.message : "数据库备份失败"),
    });

    const refreshAll = async () => {
        await Promise.all([dashboardQuery.refetch(), serverQuery.refetch(), databaseQuery.refetch(), backupsQuery.refetch(), taskQuery.refetch()]);
    };

    const dashboard = dashboardQuery.data;
    const server = dashboard?.server || serverQuery.data;
    const operationColumns: ProColumns<AdminOperationLog>[] = [
        { title: "管理员", dataIndex: "username", width: 130, render: (_, item) => item.username || item.userId || "-" },
        { title: "方法", dataIndex: "method", width: 80, render: (_, item) => <Tag>{item.method}</Tag> },
        { title: "路径", dataIndex: "path", ellipsis: true },
        { title: "状态", dataIndex: "status", width: 80 },
        { title: "耗时", dataIndex: "duration", width: 100, render: (_, item) => `${item.duration} ms` },
        { title: "IP", dataIndex: "ip", width: 140 },
        { title: "时间", dataIndex: "createdAt", width: 180, render: (_, item) => timeText(item.createdAt) },
    ];
    const taskColumns: ProColumns<AdminSystemTask>[] = [
        { title: "任务", dataIndex: "title", width: 160 },
        { title: "类型", dataIndex: "type", width: 150 },
        { title: "状态", dataIndex: "status", width: 100, render: (_, item) => <Tag>{item.status}</Tag> },
        { title: "结果", dataIndex: "result", ellipsis: true, render: (_, item) => item.result || item.error || "-" },
        { title: "创建时间", dataIndex: "createdAt", width: 180, render: (_, item) => timeText(item.createdAt) },
        { title: "完成时间", dataIndex: "finishedAt", width: 180, render: (_, item) => timeText(item.finishedAt) },
    ];
    const errorColumns: ProColumns<AdminErrorLog>[] = [
        { title: "来源", dataIndex: "source", width: 110, render: (_, item) => <Tag>{item.source}</Tag> },
        { title: "错误", dataIndex: "message", ellipsis: true },
        { title: "路径", dataIndex: "path", ellipsis: true },
        { title: "IP", dataIndex: "ip", width: 140 },
        { title: "时间", dataIndex: "createdAt", width: 180, render: (_, item) => timeText(item.createdAt) },
    ];
    const backupColumns: ProColumns<AdminBackupFile>[] = [
        { title: "文件名", dataIndex: "name", ellipsis: true },
        { title: "大小", dataIndex: "size", width: 120, render: (_, item) => sizeText(item.size) },
        { title: "路径", dataIndex: "path", ellipsis: true },
        { title: "创建时间", dataIndex: "createdAt", width: 180, render: (_, item) => timeText(item.createdAt) },
    ];

    return (
        <main style={{ padding: 24 }}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Card variant="borderless" styles={{ body: { padding: 20 } }}>
                    <Flex align="center" justify="space-between" gap={16} wrap>
                        <Space direction="vertical" size={2}>
                            <Typography.Title level={4} style={{ margin: 0 }}>运维监控驾驶舱</Typography.Title>
                            <Typography.Text type="secondary">网站运行状态、服务器状态、任务队列和业务健康实时汇总</Typography.Text>
                        </Space>
                        <Space wrap>
                            <Tag>自动刷新 5 秒</Tag>
                            <Button icon={<ReloadOutlined />} className="cursor-pointer" onClick={() => void refreshAll()}>
                                刷新
                            </Button>
                        </Space>
                    </Flex>
                </Card>

                <Tabs
                    items={[
                        {
                            key: "dashboard",
                            label: "运行总览",
                            children: <DashboardOverview dashboard={dashboard} loading={dashboardQuery.isFetching && !dashboard} />,
                        },
                        {
                            key: "requests",
                            label: "请求与慢接口",
                            children: <RequestPanel dashboard={dashboard} loading={dashboardQuery.isFetching && !dashboard} />,
                        },
                        {
                            key: "database",
                            label: "数据库与备份",
                            children: (
                                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                                    <Card title="数据库状态" variant="borderless">
                                        <Descriptions column={1} bordered size="small">
                                            <Descriptions.Item label="驱动">{databaseQuery.data?.driver || "-"}</Descriptions.Item>
                                            <Descriptions.Item label="DSN">{databaseQuery.data?.dsn || "-"}</Descriptions.Item>
                                            <Descriptions.Item label="生产建议">
                                                <Space direction="vertical">{(databaseQuery.data?.notes || []).map((item) => <Typography.Text key={item}>{item}</Typography.Text>)}</Space>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="连接池">打开 {server?.database.openConnections || 0}，使用中 {server?.database.inUse || 0}，空闲 {server?.database.idle || 0}</Descriptions.Item>
                                        </Descriptions>
                                    </Card>
                                    <ProTable<AdminBackupFile>
                                        rowKey="path"
                                        columns={backupColumns}
                                        dataSource={backupsQuery.data || []}
                                        loading={backupsQuery.isFetching || backupMutation.isPending}
                                        search={false}
                                        pagination={false}
                                        cardProps={{ variant: "borderless" }}
                                        headerTitle="备份文件"
                                        toolBarRender={() => [
                                            <Button key="backup" type="primary" icon={<DatabaseOutlined />} loading={backupMutation.isPending} className="cursor-pointer" onClick={() => backupMutation.mutate()}>
                                                创建备份
                                            </Button>,
                                        ]}
                                    />
                                </Space>
                            ),
                        },
                        {
                            key: "tasks",
                            label: "任务队列",
                            children: (
                                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                                    <Card variant="borderless">
                                        <Flex align="center" justify="space-between" gap={12} wrap>
                                            <Space direction="vertical" size={4}>
                                                <Typography.Text strong>默认用户并发数：{settingsQuery.data?.private.taskQueue.defaultUserConcurrency || server?.taskQueue.defaultUserConcurrency || 2}</Typography.Text>
                                                <Typography.Text type="secondary">用户未单独设置时生效；单个用户可在“用户管理”覆盖，填 0 表示使用系统默认值。</Typography.Text>
                                            </Space>
                                            <Link href="/admin/settings?tab=private&section=taskQueue">
                                                <Button size="small" icon={<SettingOutlined />} className="cursor-pointer">去设置</Button>
                                            </Link>
                                        </Flex>
                                    </Card>
                                    <QueueVisual server={server} />
                                    <ProTable<AdminSystemTask> rowKey="id" columns={taskColumns} dataSource={taskQuery.data?.items || []} loading={taskQuery.isFetching} search={false} pagination={false} cardProps={{ variant: "borderless" }} />
                                </Space>
                            ),
                        },
                        {
                            key: "operations",
                            label: "操作日志",
                            children: <ProTable<AdminOperationLog> rowKey="id" columns={operationColumns} dataSource={dashboard?.operations.items || []} loading={dashboardQuery.isFetching} search={false} pagination={false} cardProps={{ variant: "borderless" }} />,
                        },
                        {
                            key: "errors",
                            label: "错误监控",
                            children: <ProTable<AdminErrorLog> rowKey="id" columns={errorColumns} dataSource={dashboard?.errors.items || []} loading={dashboardQuery.isFetching} search={false} pagination={false} cardProps={{ variant: "borderless" }} />,
                        },
                    ]}
                />
            </Space>
        </main>
    );
}

function DashboardOverview({ dashboard, loading }: { dashboard?: AdminOpsDashboard; loading: boolean }) {
    const server = dashboard?.server;
    return (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card variant="borderless" loading={loading}>
                <Flex gap={10} wrap>
                    {(dashboard?.health || []).map((item) => <HealthPill key={item.key} label={item.label} status={item.status} message={item.message} />)}
                </Flex>
            </Card>
            <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
                <MetricCard title="运行时长" value={server ? durationText(server.uptimeSeconds) : "-"} icon={<CloudServerOutlined />} />
                <MetricCard title="今日请求" value={dashboard?.requests.today || 0} suffix="次" icon={<ApiOutlined />} />
                <MetricCard title="排队 / 运行" value={`${server?.taskQueue.pending || 0} / ${server?.taskQueue.running || 0}`} icon={<FileDoneOutlined />} />
                <MetricCard title="今日错误" value={dashboard?.business.errorsToday || 0} suffix="条" icon={<WarningOutlined />} />
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
                <Card title="服务器资源" variant="borderless">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Gauge title="内存 Alloc" value={server?.memory.alloc || 0} max={Math.max(server?.memory.sys || 1, server?.memory.alloc || 1)} label={sizeText(server?.memory.alloc || 0)} />
                        <Gauge title="堆内存" value={server?.memory.heapAlloc || 0} max={Math.max(server?.memory.heapInuse || 1, server?.memory.heapAlloc || 1)} label={sizeText(server?.memory.heapAlloc || 0)} />
                        <Gauge title="数据目录" value={server?.dataDir.size || 0} max={Math.max(server?.dataDir.size || 1, 1024 * 1024 * 1024)} label={sizeText(server?.dataDir.size || 0)} />
                    </div>
                    <Descriptions column={2} size="small" style={{ marginTop: 16 }}>
                        <Descriptions.Item label="运行环境">{server ? `${server.os}/${server.arch}` : "-"}</Descriptions.Item>
                        <Descriptions.Item label="CPU 核心">{server?.cpuCores || 0}</Descriptions.Item>
                        <Descriptions.Item label="Go 版本">{server?.goVersion || "-"}</Descriptions.Item>
                        <Descriptions.Item label="Goroutine">{server?.goroutines || 0}</Descriptions.Item>
                    </Descriptions>
                </Card>
                <Card title="网站请求趋势" variant="borderless">
                    <Sparkline points={dashboard?.requests.timeline || []} height={170} />
                    <Space style={{ marginTop: 12 }} wrap>
                        <Statistic title="平均耗时" value={msText(dashboard?.requests.averageDurationMs || 0)} />
                        <Statistic title="最慢请求" value={msText(dashboard?.requests.maxDurationMs || 0)} />
                        <Statistic title="5xx" value={dashboard?.requests.failed || 0} />
                    </Space>
                </Card>
                <Card title="业务健康" variant="borderless">
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        <BarMetric label="用户总数" value={dashboard?.business.users || 0} max={Math.max(dashboard?.business.users || 1, 1)} />
                        <BarMetric label="今日活跃" value={dashboard?.business.activeUsersToday || 0} max={Math.max(dashboard?.business.users || 1, 1)} />
                        <BarMetric label="发布作品" value={dashboard?.business.publishedWorks || 0} max={Math.max(dashboard?.business.works || 1, 1)} />
                        <BarMetric label="支付成功率" value={dashboard?.payments.successRate || 0} max={100} suffix="%" />
                    </Space>
                </Card>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
                <QueueVisual server={server} />
                <Card title="支付状态" variant="borderless">
                    <Space size={18} wrap>
                        <Statistic title="今日订单" value={dashboard?.payments.todayOrders || 0} />
                        <Statistic title="已支付" value={dashboard?.payments.paidOrders || 0} />
                        <Statistic title="支付金额" value={moneyText(dashboard?.payments.paidAmount || 0)} />
                    </Space>
                </Card>
                <Card title="模型渠道健康" variant="borderless">
                    <Space direction="vertical" style={{ width: "100%" }}>
                        {(dashboard?.modelChannels || []).map((item) => (
                            <Flex key={item.name} align="center" justify="space-between" gap={10}>
                                <Space>
                                    <span className="inline-block size-2 rounded-full" style={{ background: item.status === "ok" ? neutral.ink : item.status === "off" ? "#d1d5db" : "#737373" }} />
                                    <Typography.Text>{item.name}</Typography.Text>
                                </Space>
                                <Tag>{item.message} / {item.modelCount} 模型</Tag>
                            </Flex>
                        ))}
                        {!dashboard?.modelChannels?.length ? <Typography.Text type="secondary">暂无模型渠道</Typography.Text> : null}
                    </Space>
                </Card>
            </div>
        </Space>
    );
}

function RequestPanel({ dashboard, loading }: { dashboard?: AdminOpsDashboard; loading: boolean }) {
    return (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
                <MetricCard title="请求窗口总量" value={dashboard?.requests.total || 0} suffix="次" icon={<ApiOutlined />} />
                <MetricCard title="今日请求" value={dashboard?.requests.today || 0} suffix="次" icon={<SafetyCertificateOutlined />} />
                <MetricCard title="平均耗时" value={msText(dashboard?.requests.averageDurationMs || 0)} icon={<ThunderboltOutlined />} />
                <MetricCard title="5xx 错误" value={dashboard?.requests.failed || 0} suffix="次" icon={<WarningOutlined />} />
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                <Card title="请求趋势" variant="borderless" loading={loading}>
                    <Sparkline points={dashboard?.requests.timeline || []} height={260} />
                </Card>
                <Card title="状态码分布" variant="borderless">
                    <Space direction="vertical" style={{ width: "100%" }}>
                        {(dashboard?.requests.status || []).map((item) => <BarMetric key={item.label} label={item.label} value={item.value} max={Math.max(...(dashboard?.requests.status || []).map((next) => next.value), 1)} />)}
                    </Space>
                </Card>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
                <Card title="慢接口 Top" variant="borderless">
                    <Space direction="vertical" style={{ width: "100%" }}>
                        {(dashboard?.requests.slowEndpoints || []).map((item) => <SlowEndpointRow key={`${item.method}-${item.path}`} item={item} />)}
                        {!dashboard?.requests.slowEndpoints?.length ? <Typography.Text type="secondary">暂无请求样本</Typography.Text> : null}
                    </Space>
                </Card>
                <Card title="最近请求" variant="borderless">
                    <Space direction="vertical" style={{ width: "100%" }}>
                        {(dashboard?.requests.recent || []).map((item, index) => <RecentRequestRow key={`${item.createdAt}-${index}`} item={item} />)}
                        {!dashboard?.requests.recent?.length ? <Typography.Text type="secondary">暂无请求样本</Typography.Text> : null}
                    </Space>
                </Card>
            </div>
        </Space>
    );
}

function QueueVisual({ server }: { server?: AdminOpsDashboard["server"] }) {
    const queue = server?.taskQueue;
    const total = Math.max((queue?.pending || 0) + (queue?.running || 0) + (queue?.success || 0) + (queue?.failed || 0), 1);
    return (
        <Card title="任务队列状态" variant="borderless">
            <Space direction="vertical" size={14} style={{ width: "100%" }}>
                <Flex gap={8}>
                    {[
                        ["排队", queue?.pending || 0],
                        ["运行", queue?.running || 0],
                        ["成功", queue?.success || 0],
                        ["失败", queue?.failed || 0],
                    ].map(([label, value]) => (
                        <div key={label} style={{ flex: Number(value) || 0.2, minWidth: 42, height: 34, borderRadius: 8, background: label === "失败" ? "#525252" : neutral.ink, opacity: label === "成功" ? 0.35 : label === "运行" ? 0.75 : 1 }} title={`${label}: ${value}`} />
                    ))}
                </Flex>
                <div className="grid grid-cols-4 gap-2">
                    <MiniStat label="排队" value={queue?.pending || 0} />
                    <MiniStat label="运行" value={queue?.running || 0} />
                    <MiniStat label="成功" value={queue?.success || 0} />
                    <MiniStat label="失败" value={queue?.failed || 0} />
                </div>
                <Space wrap>
                    {Object.entries(queue?.byType || {}).map(([type, count]) => <Tag key={type}>{type}: {count}</Tag>)}
                    {!Object.keys(queue?.byType || {}).length ? <Typography.Text type="secondary">暂无任务类型统计</Typography.Text> : null}
                </Space>
                <Typography.Text type="secondary">总样本：{total}，默认并发：{queue?.defaultUserConcurrency || 2}/用户</Typography.Text>
            </Space>
        </Card>
    );
}

function MetricCard({ title, value, suffix, icon }: { title: string; value: string | number; suffix?: string; icon?: ReactNode }) {
    return (
        <Card variant="borderless">
            <Statistic title={title} value={value} suffix={suffix} prefix={icon} />
        </Card>
    );
}

function HealthPill({ label, status, message }: { label: string; status: string; message: string }) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm" style={{ borderColor: neutral.border, background: status === "ok" ? "#fff" : neutral.soft }}>
            <span className="inline-block size-2 rounded-full" style={{ background: status === "ok" ? neutral.ink : "#737373" }} />
            <span className="font-medium text-neutral-950">{label}</span>
            <span className="text-neutral-500">{message}</span>
        </div>
    );
}

function Gauge({ title, value, max, label }: { title: string; value: number; max: number; label: string }) {
    const percent = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
    return (
        <Space direction="vertical" align="center" style={{ width: "100%" }}>
            <Progress type="circle" percent={percent} size={86} strokeColor={neutral.ink} trailColor={neutral.track} format={() => label} />
            <Typography.Text type="secondary">{title}</Typography.Text>
        </Space>
    );
}

function Sparkline({ points, height }: { points: AdminOpsMetricPoint[]; height: number }) {
    const width = 760;
    const max = Math.max(...points.map((item) => item.value), 1);
    const path = points
        .map((point, index) => {
            const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * width;
            const y = height - (point.value / max) * (height - 24) - 12;
            return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    if (!points.length) return <EmptyState text="暂无趋势数据" height={height} />;
    return (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
            <path d={path} fill="none" stroke={neutral.ink} strokeWidth="3" strokeLinecap="round" />
            {points.map((point, index) => {
                const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * width;
                const y = height - (point.value / max) * (height - 24) - 12;
                return <circle key={`${point.time}-${index}`} cx={x} cy={y} r="3" fill={neutral.ink} />;
            })}
        </svg>
    );
}

function BarMetric({ label, value, max, suffix = "" }: { label: string; value: number; max: number; suffix?: string }) {
    const percent = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
    return (
        <div>
            <Flex justify="space-between" align="center">
                <Typography.Text>{label}</Typography.Text>
                <Typography.Text strong>{value}{suffix}</Typography.Text>
            </Flex>
            <div style={{ height: 8, borderRadius: 999, background: neutral.track, overflow: "hidden", marginTop: 6 }}>
                <div style={{ width: `${percent}%`, height: "100%", background: neutral.ink }} />
            </div>
        </div>
    );
}

function SlowEndpointRow({ item }: { item: AdminOpsSlowEndpoint }) {
    return (
        <div className="rounded-lg border p-3" style={{ borderColor: neutral.border }}>
            <Flex justify="space-between" gap={12}>
                <Typography.Text ellipsis style={{ maxWidth: 420 }}>{item.method} {item.path}</Typography.Text>
                <Tag>{msText(item.maxDurationMs)}</Tag>
            </Flex>
            <Typography.Text type="secondary">次数 {item.count}，平均 {msText(item.averageDurationMs)}</Typography.Text>
        </div>
    );
}

function RecentRequestRow({ item }: { item: AdminOpsRecentRequest }) {
    return (
        <Flex justify="space-between" align="center" gap={12} className="rounded-lg border px-3 py-2" style={{ borderColor: neutral.border }}>
            <Typography.Text ellipsis style={{ maxWidth: 380 }}>{item.method} {item.path}</Typography.Text>
            <Space>
                <Tag>{item.status}</Tag>
                <Typography.Text type="secondary">{msText(item.durationMs)}</Typography.Text>
            </Space>
        </Flex>
    );
}

function MiniStat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border p-3" style={{ borderColor: neutral.border }}>
            <div className="text-xs text-neutral-500">{label}</div>
            <div className="mt-1 text-lg font-semibold text-neutral-950">{value}</div>
        </div>
    );
}

function EmptyState({ text, height }: { text: string; height: number }) {
    return <div className="flex items-center justify-center text-neutral-500" style={{ height }}>{text}</div>;
}
