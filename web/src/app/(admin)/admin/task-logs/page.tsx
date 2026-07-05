"use client";

import { ClockCircleOutlined, CopyOutlined, EyeOutlined, ReloadOutlined, RollbackOutlined, SearchOutlined, StopOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, DatePicker, Descriptions, Drawer, Flex, Form, Input, Progress, Select, Space, Statistic, Table, Tag, Timeline, Typography, theme, type TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
    cancelAdminTaskLog,
    fetchAdminTaskLogDetail,
    fetchAdminTaskLogs,
    fetchAdminTaskLogStats,
    retryAdminTaskLog,
    type AdminCreditLog,
    type AdminTaskLog,
    type AdminTaskLogQuery,
    type AdminTaskLogRelated,
    type AdminTaskLogStatus,
} from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

const { RangePicker } = DatePicker;

const taskTypes = [
    { label: "图片生成", value: "ai_image_generation" },
    { label: "图片编辑", value: "ai_image_edit" },
    { label: "视频生成", value: "ai_video_generation" },
    { label: "数据库备份", value: "database_backup" },
];

const taskStatuses = [
    { label: "排队中", value: "pending" },
    { label: "运行中", value: "running" },
    { label: "成功", value: "success" },
    { label: "失败", value: "failed" },
    { label: "已取消", value: "canceled" },
];

const timeText = (value?: string) => (value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-");
const msText = (value?: number) => {
    const ms = Math.max(0, value || 0);
    if (!ms) return "-";
    if (ms < 1000) return `${ms} ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours) return `${hours}小时 ${minutes % 60}分钟`;
    if (minutes) return `${minutes}分钟 ${seconds % 60}秒`;
    return `${seconds}秒`;
};

const statusTag = (status: AdminTaskLogStatus, label: string) => {
    if (status === "failed") return <Tag color="error">{label}</Tag>;
    if (status === "canceled") return <Tag>{label}</Tag>;
    if (status === "running") return <Tag>{label}</Tag>;
    if (status === "success") return <Tag>{label}</Tag>;
    return <Tag>{label}</Tag>;
};

const canRetry = (item?: AdminTaskLog) => item?.status === "failed" || item?.status === "canceled";
const canCancel = (item?: AdminTaskLog) => item?.status === "pending";

export default function AdminTaskLogsPage() {
    const token = useUserStore((state) => state.token);
    const queryClient = useQueryClient();
    const { message, modal } = App.useApp();
    const { token: antToken } = theme.useToken();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [keyword, setKeyword] = useState("");
    const [status, setStatus] = useState<string>();
    const [type, setType] = useState<string>();
    const [range, setRange] = useState<[Dayjs, Dayjs] | null>([dayjs().subtract(1, "day").startOf("minute"), dayjs().endOf("minute")]);
    const [detailId, setDetailId] = useState("");

    const filters = useMemo<AdminTaskLogQuery>(
        () => ({
            keyword,
            status,
            type,
            createdFrom: range?.[0]?.format(),
            createdTo: range?.[1]?.format(),
        }),
        [keyword, range, status, type],
    );
    const listQuery = useQuery({
        queryKey: ["admin", "task-logs", token, filters, page, pageSize],
        queryFn: () => fetchAdminTaskLogs(token, { ...filters, page, pageSize }),
        enabled: Boolean(token),
        retry: false,
        refetchInterval: (query) => ((query.state.data?.items || []).some((item) => item.status === "pending" || item.status === "running") ? 3000 : false),
    });
    const statsQuery = useQuery({
        queryKey: ["admin", "task-log-stats", token, filters],
        queryFn: () => fetchAdminTaskLogStats(token, filters),
        enabled: Boolean(token),
        retry: false,
        refetchInterval: 5000,
    });
    const detailQuery = useQuery({
        queryKey: ["admin", "task-log-detail", token, detailId],
        queryFn: () => fetchAdminTaskLogDetail(token, detailId),
        enabled: Boolean(token && detailId),
        retry: false,
    });
    const refreshTaskQueries = async () => {
        await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin", "task-logs"] }), queryClient.invalidateQueries({ queryKey: ["admin", "task-log-stats"] }), queryClient.invalidateQueries({ queryKey: ["admin", "task-log-detail"] })]);
    };
    const retryMutation = useMutation({
        mutationFn: (id: string) => retryAdminTaskLog(token, id),
        onSuccess: async (task) => {
            await refreshTaskQueries();
            message.success(`已提交重试任务：${task.id}`);
        },
        onError: (error) => message.error(error instanceof Error ? error.message : "任务重试失败"),
    });
    const cancelMutation = useMutation({
        mutationFn: (id: string) => cancelAdminTaskLog(token, id),
        onSuccess: async () => {
            await refreshTaskQueries();
            message.success("任务已取消");
        },
        onError: (error) => message.error(error instanceof Error ? error.message : "任务取消失败"),
    });

    const retryTask = (item: AdminTaskLog) => {
        modal.confirm({
            title: "重试任务",
            content: `确认基于任务 ${item.id} 新建一条重试任务吗？`,
            okText: "重试",
            cancelText: "取消",
            onOk: () => retryMutation.mutateAsync(item.id),
        });
    };
    const cancelTask = (item: AdminTaskLog) => {
        modal.confirm({
            title: "取消任务",
            content: `确认取消排队中的任务 ${item.id} 吗？`,
            okText: "取消任务",
            cancelText: "返回",
            onOk: () => cancelMutation.mutateAsync(item.id),
        });
    };

    const columns: TableColumnsType<AdminTaskLog> = [
        { title: "提交时间", dataIndex: "createdAt", width: 180, render: (_, item) => timeText(item.createdAt) },
        { title: "结束时间", dataIndex: "finishedAt", width: 180, render: (_, item) => timeText(item.finishedAt) },
        { title: "花费时间", dataIndex: "durationMs", width: 110, render: (_, item) => msText(item.durationMs) },
        { title: "平台", dataIndex: "platform", width: 110, render: (_, item) => <Tag>{item.platform || "-"}</Tag> },
        { title: "类型", dataIndex: "typeLabel", width: 120, render: (_, item) => item.typeLabel || item.type },
        {
            title: "任务 ID",
            dataIndex: "id",
            width: 230,
            ellipsis: true,
            render: (_, item) => (
                <Typography.Text copyable={{ text: item.id }} style={{ maxWidth: 210 }}>
                    {item.id}
                </Typography.Text>
            ),
        },
        { title: "任务状态", dataIndex: "status", width: 110, render: (_, item) => statusTag(item.status, item.statusLabel) },
        {
            title: "进度",
            dataIndex: "progress",
            width: 150,
            render: (_, item) => <Progress percent={item.progress} size="small" strokeColor={antToken.colorText} status={item.status === "failed" ? "exception" : "normal"} />,
        },
        {
            title: "操作",
            key: "action",
            width: 220,
            fixed: "right",
            render: (_, item) => (
                <Space size={4}>
                    <Button type="text" icon={<EyeOutlined />} className="cursor-pointer" onClick={() => setDetailId(item.id)}>
                        详情
                    </Button>
                    <Button type="text" icon={<RollbackOutlined />} disabled={!canRetry(item)} loading={retryMutation.isPending} className="cursor-pointer" onClick={() => retryTask(item)}>
                        重试
                    </Button>
                    <Button type="text" icon={<StopOutlined />} disabled={!canCancel(item)} loading={cancelMutation.isPending} className="cursor-pointer" onClick={() => cancelTask(item)}>
                        取消
                    </Button>
                </Space>
            ),
        },
    ];

    const resetFilters = () => {
        setKeyword("");
        setStatus(undefined);
        setType(undefined);
        setRange([dayjs().subtract(1, "day").startOf("minute"), dayjs().endOf("minute")]);
        setPage(1);
    };
    const copyText = async (value?: string) => {
        if (!value) return;
        await navigator.clipboard.writeText(value);
        message.success("已复制");
    };
    const detail = detailQuery.data;

    return (
        <main style={{ padding: 24 }}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Card variant="borderless">
                    <Flex align="center" justify="space-between" gap={12} wrap>
                        <Typography.Title level={5} style={{ margin: 0 }}>
                            任务日志
                        </Typography.Title>
                        <Button icon={<ReloadOutlined />} className="cursor-pointer" onClick={() => void refreshTaskQueries()}>
                            刷新
                        </Button>
                    </Flex>
                    <Form layout="inline" style={{ marginTop: 14, rowGap: 12 }}>
                        <Form.Item>
                            <RangePicker
                                showTime
                                value={range}
                                onChange={(value) => {
                                    setRange(value as [Dayjs, Dayjs] | null);
                                    setPage(1);
                                }}
                                style={{ width: 380 }}
                            />
                        </Form.Item>
                        <Form.Item>
                            <Input
                                allowClear
                                prefix={<SearchOutlined />}
                                placeholder="任务 ID / 用户 / 错误"
                                value={keyword}
                                onChange={(event) => {
                                    setKeyword(event.target.value);
                                    setPage(1);
                                }}
                                style={{ width: 280 }}
                            />
                        </Form.Item>
                        <Form.Item>
                            <Select
                                allowClear
                                placeholder="任务类型"
                                value={type}
                                options={taskTypes}
                                onChange={(value) => {
                                    setType(value);
                                    setPage(1);
                                }}
                                style={{ width: 150 }}
                            />
                        </Form.Item>
                        <Form.Item>
                            <Select
                                allowClear
                                placeholder="任务状态"
                                value={status}
                                options={taskStatuses}
                                onChange={(value) => {
                                    setStatus(value);
                                    setPage(1);
                                }}
                                style={{ width: 130 }}
                            />
                        </Form.Item>
                        <Form.Item>
                            <Space>
                                <Button type="primary" icon={<SearchOutlined />} className="cursor-pointer" onClick={() => void listQuery.refetch()}>
                                    查询
                                </Button>
                                <Button className="cursor-pointer" onClick={resetFilters}>
                                    重置
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Card>

                <Flex gap={12} wrap>
                    <Card variant="borderless" style={{ flex: "1 1 150px" }}>
                        <Statistic title="任务总数" value={statsQuery.data?.total || 0} />
                    </Card>
                    <Card variant="borderless" style={{ flex: "1 1 150px" }}>
                        <Statistic title="今日提交" value={statsQuery.data?.today || 0} />
                    </Card>
                    <Card variant="borderless" style={{ flex: "1 1 150px" }}>
                        <Statistic title="排队中" value={statsQuery.data?.pending || 0} />
                    </Card>
                    <Card variant="borderless" style={{ flex: "1 1 150px" }}>
                        <Statistic title="运行中" value={statsQuery.data?.running || 0} />
                    </Card>
                    <Card variant="borderless" style={{ flex: "1 1 150px" }}>
                        <Statistic title="失败任务" value={statsQuery.data?.failed || 0} />
                    </Card>
                    <Card variant="borderless" style={{ flex: "1 1 150px" }}>
                        <Statistic title="已取消" value={statsQuery.data?.canceled || 0} />
                    </Card>
                    <Card variant="borderless" style={{ flex: "1 1 150px" }}>
                        <Statistic title="平均耗时" value={msText(statsQuery.data?.averageDurationMs)} prefix={<ClockCircleOutlined />} />
                    </Card>
                </Flex>

                <Card variant="borderless" styles={{ body: { padding: 0 } }}>
                    <Table<AdminTaskLog>
                        rowKey="id"
                        columns={columns}
                        dataSource={listQuery.data?.items || []}
                        loading={listQuery.isFetching}
                        scroll={{ x: 1350 }}
                        pagination={{
                            current: page,
                            pageSize,
                            total: listQuery.data?.total || 0,
                            showSizeChanger: true,
                            showTotal: (total) => `共 ${total} 条`,
                            onChange: (nextPage, nextPageSize) => {
                                setPage(nextPage);
                                setPageSize(nextPageSize);
                            },
                        }}
                    />
                </Card>
            </Space>

            <Drawer
                width={720}
                title="任务详情"
                open={Boolean(detailId)}
                onClose={() => setDetailId("")}
                loading={detailQuery.isFetching}
                extra={
                    detail ? (
                        <Space>
                            <Button icon={<RollbackOutlined />} disabled={!canRetry(detail)} loading={retryMutation.isPending} className="cursor-pointer" onClick={() => retryTask(detail)}>
                                重试
                            </Button>
                            <Button icon={<StopOutlined />} disabled={!canCancel(detail)} loading={cancelMutation.isPending} className="cursor-pointer" onClick={() => cancelTask(detail)}>
                                取消
                            </Button>
                        </Space>
                    ) : null
                }
            >
                {detail ? (
                    <Space direction="vertical" size={16} style={{ width: "100%" }}>
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="任务 ID">
                                <Space>
                                    <Typography.Text>{detail.id}</Typography.Text>
                                    <Button type="text" size="small" icon={<CopyOutlined />} className="cursor-pointer" onClick={() => void copyText(detail.id)} />
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="任务类型">{detail.typeLabel}</Descriptions.Item>
                            <Descriptions.Item label="任务状态">{statusTag(detail.status, detail.statusLabel)}</Descriptions.Item>
                            <Descriptions.Item label="重试来源">{detail.sourceTaskId || "-"}</Descriptions.Item>
                            <Descriptions.Item label="提交用户">
                                {detail.createdBy ? (
                                    <Space>
                                        <Typography.Text>{detail.createdBy}</Typography.Text>
                                        <Link href={`/admin/users?keyword=${encodeURIComponent(detail.createdBy)}`}>用户管理</Link>
                                        <Link href={`/admin/credit-logs?keyword=${encodeURIComponent(detail.createdBy)}`}>积分日志</Link>
                                    </Space>
                                ) : (
                                    "-"
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="来源平台">{detail.platform || "-"}</Descriptions.Item>
                            <Descriptions.Item label="模型">{detail.model || "-"}</Descriptions.Item>
                            <Descriptions.Item label="上游任务">{detail.upstreamTaskId || "-"}</Descriptions.Item>
                            <Descriptions.Item label="积分">{detail.credits || 0}</Descriptions.Item>
                            <Descriptions.Item label="提交时间">{timeText(detail.createdAt)}</Descriptions.Item>
                            <Descriptions.Item label="开始时间">{timeText(detail.startedAt)}</Descriptions.Item>
                            <Descriptions.Item label="结束时间">{timeText(detail.finishedAt)}</Descriptions.Item>
                            <Descriptions.Item label="排队耗时">{msText(detail.queueDurationMs)}</Descriptions.Item>
                            <Descriptions.Item label="执行耗时">{msText(detail.runDurationMs)}</Descriptions.Item>
                            <Descriptions.Item label="总耗时">{msText(detail.durationMs)}</Descriptions.Item>
                            <Descriptions.Item label="摘要">{detail.summary || "-"}</Descriptions.Item>
                            <Descriptions.Item label="错误">{detail.error || "-"}</Descriptions.Item>
                        </Descriptions>
                        <TraceTimeline items={detail.timeline || []} />
                        <RelatedTasks items={detail.relatedTasks || []} onOpen={setDetailId} />
                        <CreditLogBlock items={detail.creditLogs || []} />
                        <ResultLinks items={detail.resultLinks || []} />
                        <DetailBlock title="请求参数" value={detail.payload} onCopy={copyText} />
                        <DetailBlock title="任务结果" value={detail.result} onCopy={copyText} />
                    </Space>
                ) : null}
            </Drawer>
        </main>
    );
}

function DetailBlock({ title, value, onCopy }: { title: string; value?: string; onCopy: (value?: string) => void }) {
    if (!value) return null;
    return (
        <Card
            size="small"
            title={title}
            extra={
                <Button type="text" size="small" icon={<CopyOutlined />} className="cursor-pointer" onClick={() => onCopy(value)}>
                    复制
                </Button>
            }
        >
            <pre style={{ margin: 0, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value}</pre>
        </Card>
    );
}

function TraceTimeline({ items }: { items: NonNullable<AdminTaskLog["timeline"]> }) {
    if (!items.length) return null;
    return (
        <Card size="small" title="链路时间线">
            <Timeline
                items={items.map((item) => ({
                    color: item.status === "error" ? "red" : "gray",
                    children: (
                        <Space direction="vertical" size={2}>
                            <Typography.Text strong>{item.title}</Typography.Text>
                            <Typography.Text type="secondary">{timeText(item.time)}</Typography.Text>
                            <Typography.Text>{item.description || "-"}</Typography.Text>
                        </Space>
                    ),
                }))}
            />
        </Card>
    );
}

function RelatedTasks({ items, onOpen }: { items: AdminTaskLogRelated[]; onOpen: (id: string) => void }) {
    if (!items.length) return null;
    return (
        <Card size="small" title="关联任务">
            <Table<AdminTaskLogRelated>
                rowKey={(item) => `${item.relation}-${item.id}`}
                size="small"
                pagination={false}
                dataSource={items}
                columns={[
                    { title: "关系", dataIndex: "relation", width: 100 },
                    {
                        title: "任务 ID",
                        dataIndex: "id",
                        ellipsis: true,
                        render: (_, item) => (
                            <Button type="link" size="small" className="cursor-pointer" onClick={() => onOpen(item.id)}>
                                {item.id}
                            </Button>
                        ),
                    },
                    { title: "状态", dataIndex: "statusLabel", width: 90, render: (_, item) => statusTag(item.status, item.statusLabel) },
                    { title: "创建时间", dataIndex: "createdAt", width: 170, render: (_, item) => timeText(item.createdAt) },
                ]}
            />
        </Card>
    );
}

function CreditLogBlock({ items }: { items: AdminCreditLog[] }) {
    if (!items.length) return null;
    return (
        <Card size="small" title="关联积分流水">
            <Table<AdminCreditLog>
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={items}
                columns={[
                    { title: "类型", dataIndex: "type", width: 120, render: (_, item) => <Tag>{item.type}</Tag> },
                    { title: "变动", dataIndex: "amount", width: 90 },
                    { title: "余额", dataIndex: "balance", width: 90 },
                    { title: "说明", dataIndex: "remark", ellipsis: true },
                    { title: "时间", dataIndex: "createdAt", width: 170, render: (_, item) => timeText(item.createdAt) },
                ]}
            />
        </Card>
    );
}

function ResultLinks({ items }: { items: NonNullable<AdminTaskLog["resultLinks"]> }) {
    if (!items.length) return null;
    return (
        <Card size="small" title="结果链接">
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {items.map((item, index) => (
                    <Flex key={`${item.url}-${index}`} justify="space-between" gap={12}>
                        <Typography.Text ellipsis style={{ maxWidth: 520 }}>
                            {item.label}：{item.url}
                        </Typography.Text>
                        <Button size="small" href={item.url} target="_blank" rel="noreferrer" className="cursor-pointer">
                            打开
                        </Button>
                    </Flex>
                ))}
            </Space>
        </Card>
    );
}
