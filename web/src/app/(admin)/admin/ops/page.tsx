"use client";

import { CloudServerOutlined, DatabaseOutlined, FileDoneOutlined, HddOutlined, ReloadOutlined, SafetyCertificateOutlined, SettingOutlined, ThunderboltOutlined, WarningOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Descriptions, Space, Statistic, Tabs, Tag, Typography } from "antd";
import dayjs from "dayjs";
import Link from "next/link";

import {
    createAdminDatabaseBackup,
    fetchAdminSettings,
    fetchAdminDatabaseBackups,
    fetchAdminDatabaseStatus,
    fetchAdminErrorLogs,
    fetchAdminOperationLogs,
    fetchAdminServerStatus,
    fetchAdminSystemTasks,
    type AdminBackupFile,
    type AdminErrorLog,
    type AdminOperationLog,
    type AdminSystemTask,
} from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

const timeText = (value?: string) => (value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-");
const sizeText = (value: number) => (value > 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(2)} MB` : `${(value / 1024).toFixed(1)} KB`);
const durationText = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return [days ? `${days}天` : "", hours ? `${hours}小时` : "", minutes ? `${minutes}分钟` : ""].filter(Boolean).join(" ") || `${Math.max(0, seconds)}秒`;
};

export default function AdminOpsPage() {
    const token = useUserStore((state) => state.token);
    const queryClient = useQueryClient();
    const { message } = App.useApp();

    const databaseQuery = useQuery({ queryKey: ["admin", "database-status", token], queryFn: () => fetchAdminDatabaseStatus(token), enabled: Boolean(token), retry: false });
    const serverQuery = useQuery({ queryKey: ["admin", "server-status", token], queryFn: () => fetchAdminServerStatus(token), enabled: Boolean(token), retry: false, refetchInterval: 5000 });
    const settingsQuery = useQuery({ queryKey: ["admin", "settings", "ops", token], queryFn: () => fetchAdminSettings(token), enabled: Boolean(token), retry: false });
    const operationQuery = useQuery({ queryKey: ["admin", "operation-logs", token], queryFn: () => fetchAdminOperationLogs(token, { page: 1, pageSize: 50 }), enabled: Boolean(token), retry: false });
    const taskQuery = useQuery({ queryKey: ["admin", "system-tasks", token], queryFn: () => fetchAdminSystemTasks(token, { page: 1, pageSize: 50 }), enabled: Boolean(token), retry: false, refetchInterval: (query) => ((query.state.data?.items || []).some((item) => item.status === "pending" || item.status === "running") ? 3000 : false) });
    const hasActiveTask = (taskQuery.data?.items || []).some((item) => item.status === "pending" || item.status === "running");
    const backupsQuery = useQuery({ queryKey: ["admin", "database-backups", token], queryFn: () => fetchAdminDatabaseBackups(token), enabled: Boolean(token), retry: false, refetchInterval: hasActiveTask ? 3000 : false });
    const errorQuery = useQuery({ queryKey: ["admin", "error-logs", token], queryFn: () => fetchAdminErrorLogs(token, { page: 1, pageSize: 50 }), enabled: Boolean(token), retry: false });

    const backupMutation = useMutation({
        mutationFn: () => createAdminDatabaseBackup(token),
        onSuccess: async () => {
            await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin", "database-backups"] }), queryClient.invalidateQueries({ queryKey: ["admin", "system-tasks"] })]);
            message.success("备份任务已加入队列");
        },
        onError: (error) => message.error(error instanceof Error ? error.message : "数据库备份失败"),
    });

    const refreshAll = async () => {
        await Promise.all([serverQuery.refetch(), databaseQuery.refetch(), backupsQuery.refetch(), operationQuery.refetch(), taskQuery.refetch(), errorQuery.refetch()]);
    };

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
                <Card variant="borderless">
                    <Space size={18} wrap>
                        <Statistic title="运行时长" value={serverQuery.data ? durationText(serverQuery.data.uptimeSeconds) : "-"} prefix={<CloudServerOutlined />} />
                        <Statistic title="CPU 核心" value={serverQuery.data?.cpuCores || 0} prefix={<ThunderboltOutlined />} />
                        <Statistic title="内存占用" value={serverQuery.data ? sizeText(serverQuery.data.memory.alloc) : "-"} prefix={<HddOutlined />} />
                        <Statistic title="操作日志" value={operationQuery.data?.total || 0} prefix={<SafetyCertificateOutlined />} />
                        <Statistic title="任务记录" value={taskQuery.data?.total || 0} prefix={<FileDoneOutlined />} />
                        <Statistic title="默认并发" value={settingsQuery.data?.private.taskQueue.defaultUserConcurrency || 2} suffix="个/用户" prefix={<ThunderboltOutlined />} />
                        <Statistic title="错误日志" value={errorQuery.data?.total || 0} prefix={<WarningOutlined />} />
                        <Button icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
                            刷新
                        </Button>
                    </Space>
                </Card>
                <Tabs
                    items={[
                        {
                            key: "dashboard",
                            label: "动态仪表盘",
                            children: (
                                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                                    <Space size={16} wrap style={{ width: "100%" }}>
                                        <Card variant="borderless" style={{ minWidth: 240, flex: 1 }}>
                                            <Statistic title="服务器时间" value={timeText(serverQuery.data?.serverTime)} prefix={<CloudServerOutlined />} />
                                            <Typography.Text type="secondary">启动时间：{timeText(serverQuery.data?.startedAt)}</Typography.Text>
                                        </Card>
                                        <Card variant="borderless" style={{ minWidth: 240, flex: 1 }}>
                                            <Statistic title="运行环境" value={serverQuery.data ? `${serverQuery.data.os}/${serverQuery.data.arch}` : "-"} />
                                            <Typography.Text type="secondary">Go：{serverQuery.data?.goVersion || "-"}</Typography.Text>
                                        </Card>
                                        <Card variant="borderless" style={{ minWidth: 240, flex: 1 }}>
                                            <Statistic title="Goroutine" value={serverQuery.data?.goroutines || 0} />
                                            <Typography.Text type="secondary">CPU 核心：{serverQuery.data?.cpuCores || 0}，GC 次数：{serverQuery.data?.memory.numGc || 0}</Typography.Text>
                                        </Card>
                                        <Card variant="borderless" style={{ minWidth: 240, flex: 1 }}>
                                            <Statistic title="数据库连接" value={serverQuery.data?.database.openConnections || 0} suffix="个" prefix={<DatabaseOutlined />} />
                                            <Typography.Text type="secondary">使用中 {serverQuery.data?.database.inUse || 0}，空闲 {serverQuery.data?.database.idle || 0}</Typography.Text>
                                        </Card>
                                        <Card variant="borderless" style={{ minWidth: 240, flex: 1 }}>
                                            <Statistic title="数据目录" value={serverQuery.data ? sizeText(serverQuery.data.dataDir.size) : "-"} prefix={<HddOutlined />} />
                                            <Typography.Text type="secondary">{serverQuery.data?.dataDir.path || "-"}</Typography.Text>
                                        </Card>
                                    </Space>
                                    <Card title="任务队列实时状态" variant="borderless" loading={serverQuery.isFetching && !serverQuery.data}>
                                        <Space size={24} wrap>
                                            <Statistic title="排队中" value={serverQuery.data?.taskQueue.pending || 0} />
                                            <Statistic title="运行中" value={serverQuery.data?.taskQueue.running || 0} />
                                            <Statistic title="已成功" value={serverQuery.data?.taskQueue.success || 0} />
                                            <Statistic title="已失败" value={serverQuery.data?.taskQueue.failed || 0} />
                                            <Statistic title="默认用户并发" value={serverQuery.data?.taskQueue.defaultUserConcurrency || 2} suffix="个" />
                                        </Space>
                                        <div style={{ marginTop: 16 }}>
                                            <Space wrap>
                                                {Object.entries(serverQuery.data?.taskQueue.byType || {}).map(([type, count]) => (
                                                    <Tag key={type}>{type}: {count}</Tag>
                                                ))}
                                                {!Object.keys(serverQuery.data?.taskQueue.byType || {}).length ? <Typography.Text type="secondary">暂无任务类型统计</Typography.Text> : null}
                                            </Space>
                                        </div>
                                    </Card>
                                    <Card title="数据库连接池" variant="borderless">
                                        <Descriptions column={2} bordered size="small">
                                            <Descriptions.Item label="打开连接">{serverQuery.data?.database.openConnections || 0}</Descriptions.Item>
                                            <Descriptions.Item label="使用中">{serverQuery.data?.database.inUse || 0}</Descriptions.Item>
                                            <Descriptions.Item label="空闲">{serverQuery.data?.database.idle || 0}</Descriptions.Item>
                                            <Descriptions.Item label="等待次数">{serverQuery.data?.database.waitCount || 0}</Descriptions.Item>
                                            <Descriptions.Item label="等待耗时">{serverQuery.data?.database.waitDurationMs || 0} ms</Descriptions.Item>
                                        </Descriptions>
                                    </Card>
                                </Space>
                            ),
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
                                            <Button key="backup" type="primary" icon={<DatabaseOutlined />} loading={backupMutation.isPending} onClick={() => backupMutation.mutate()}>
                                                创建备份
                                            </Button>,
                                        ]}
                                    />
                                </Space>
                            ),
                        },
                        {
                            key: "operations",
                            label: "操作日志",
                            children: <ProTable<AdminOperationLog> rowKey="id" columns={operationColumns} dataSource={operationQuery.data?.items || []} loading={operationQuery.isFetching} search={false} pagination={false} cardProps={{ variant: "borderless" }} />,
                        },
                        {
                            key: "tasks",
                            label: "任务队列",
                            children: (
                                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                                    <Card variant="borderless">
                                        <Space direction="vertical" size={8}>
                                            <Space wrap>
                                                <Typography.Text strong>默认用户并发数：{settingsQuery.data?.private.taskQueue.defaultUserConcurrency || 2}</Typography.Text>
                                                <Tag>用户未单独设置时生效</Tag>
                                                <Link href="/admin/settings?tab=private&section=taskQueue">
                                                    <Button size="small" icon={<SettingOutlined />}>去设置</Button>
                                                </Link>
                                            </Space>
                                            <Typography.Text type="secondary">单个用户的并发数可在“用户管理”里覆盖；填 0 表示使用这里的系统默认值。</Typography.Text>
                                        </Space>
                                    </Card>
                                    <ProTable<AdminSystemTask> rowKey="id" columns={taskColumns} dataSource={taskQuery.data?.items || []} loading={taskQuery.isFetching} search={false} pagination={false} cardProps={{ variant: "borderless" }} />
                                </Space>
                            ),
                        },
                        {
                            key: "errors",
                            label: "错误监控",
                            children: <ProTable<AdminErrorLog> rowKey="id" columns={errorColumns} dataSource={errorQuery.data?.items || []} loading={errorQuery.isFetching} search={false} pagination={false} cardProps={{ variant: "borderless" }} />,
                        },
                    ]}
                />
            </Space>
        </main>
    );
}
