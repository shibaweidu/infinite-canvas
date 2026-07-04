"use client";

import { CopyOutlined, DeleteOutlined, EditOutlined, ExportOutlined, EyeOutlined, FolderAddOutlined, LinkOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, SyncOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { App, Button, Card, Col, Flex, Form, Image, Input, Modal, Row, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";

import { ModelPicker } from "@/components/model-picker";
import { useCopyText } from "@/hooks/use-copy-text";
import { fetchAdminHomeWorks, importAdminHomeWorkFromUrl, type AdminHomeWorkImportResult, type AdminPromptCategory } from "@/services/api/admin";
import type { HomeWork, HomeWorkStatus } from "@/services/api/home";
import type { Prompt } from "@/services/api/prompts";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { useAdminPrompts } from "./use-admin-prompts";

const workStatusOptions: Array<{ label: string; value: HomeWorkStatus | "all" }> = [
    { label: "全部状态", value: "all" },
    { label: "待发布", value: "pending" },
    { label: "已发布", value: "published" },
    { label: "已下架", value: "hidden" },
    { label: "草稿", value: "draft" },
];

const workStatusLabels: Record<HomeWorkStatus, string> = {
    draft: "草稿",
    pending: "待发布",
    published: "已发布",
    hidden: "已下架",
};

const categoryLocked = (item: AdminPromptCategory) => item.remote || item.category === "system";
const categoryTypeLabel = (item: AdminPromptCategory) => (item.remote ? "远程" : item.category === "system" ? "内置" : "自定义");

export default function AdminPromptsPage() {
    const {
        categories,
        prompts,
        tags,
        keyword,
        category,
        tag,
        page,
        pageSize,
        total,
        isLoading,
        isSyncing,
        searchPrompts,
        changeCategory,
        changeTag,
        changePage,
        changePageSize,
        resetFilters,
        refreshPrompts,
        syncCategory,
        saveCategory,
        deleteCategory,
        savePrompt: saveAdminPrompt,
        deletePrompt,
        deletePrompts,
    } = useAdminPrompts();
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token) || "";
    const config = useConfigStore((state) => state.config);
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const copyText = useCopyText();
    const [form] = Form.useForm<Partial<Prompt>>();
    const [categoryForm] = Form.useForm<Partial<AdminPromptCategory>>();
    const [keywordText, setKeywordText] = useState(keyword);
    const [editingPrompt, setEditingPrompt] = useState<Partial<Prompt> | null>(null);
    const [detailPrompt, setDetailPrompt] = useState<Prompt | null>(null);
    const [deletingPrompt, setDeletingPrompt] = useState<Prompt | null>(null);
    const [editingCategory, setEditingCategory] = useState<Partial<AdminPromptCategory> | null>(null);
    const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
    const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
    const [isSyncOpen, setIsSyncOpen] = useState(false);
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [isLinkImportOpen, setIsLinkImportOpen] = useState(false);
    const [linkImportUrl, setLinkImportUrl] = useState("");
    const [linkImportModel, setLinkImportModel] = useState("");
    const [linkImporting, setLinkImporting] = useState(false);
    const [isWorkImportOpen, setIsWorkImportOpen] = useState(false);
    const [workImportKeyword, setWorkImportKeyword] = useState("");
    const [workImportStatus, setWorkImportStatus] = useState<HomeWorkStatus | "all">("all");
    const [workImportLoading, setWorkImportLoading] = useState(false);
    const [workImportItems, setWorkImportItems] = useState<HomeWork[]>([]);
    const defaultCategory = categories[0]?.category || "";
    const categoryName = (category: string) => categories.find((item) => item.category === category)?.name || category;
    const categoryOptions = [{ label: "全部分类", value: "" }, ...categories.map((item) => ({ label: item.name, value: item.category }))];
    const tagOptions = useMemo(() => tags.map((item) => ({ label: item, value: item })), [tags]);
    const formatDateTime = (value?: string) => (value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-");

    useEffect(() => {
        if (editingPrompt) form.setFieldsValue({ ...editingPrompt, tags: editingPrompt.tags || [] });
    }, [editingPrompt, form]);

    useEffect(() => {
        if (editingCategory) categoryForm.setFieldsValue(editingCategory);
    }, [categoryForm, editingCategory]);

    useEffect(() => setKeywordText(keyword), [keyword]);

    useEffect(() => {
        if (!linkImportModel) setLinkImportModel(publicSettings?.modelChannel.defaultTextModel || "");
    }, [linkImportModel, publicSettings]);

    useEffect(() => {
        if (isWorkImportOpen) void loadImportWorks();
    }, [isWorkImportOpen, workImportStatus]);

    const savePrompt = async () => {
        const value = await form.validateFields();
        await saveAdminPrompt({
            ...editingPrompt,
            ...value,
            category: value.category || defaultCategory,
            tags: value.tags || [],
        });
        setEditingPrompt(null);
    };

    const savePromptCategory = async () => {
        await saveCategory({ ...editingCategory, ...(await categoryForm.validateFields()) });
        setEditingCategory(null);
    };

    const loadImportWorks = async () => {
        setWorkImportLoading(true);
        try {
            const data = await fetchAdminHomeWorks(token, { keyword: workImportKeyword, status: workImportStatus, pageSize: 100 });
            setWorkImportItems(data.items);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "作品读取失败");
        } finally {
            setWorkImportLoading(false);
        }
    };

    const applyImportedPrompt = (work: Partial<HomeWork> | AdminHomeWorkImportResult) => {
        const matchedCategory = categories.find((item) => item.category === work.category || item.name === work.category);
        if (work.category && !matchedCategory) message.info("导入分类未匹配到提示词分组，已使用默认分组");
        form.setFieldsValue({
            title: work.title,
            coverUrl: work.coverUrl || work.mediaUrl,
            category: matchedCategory?.category || defaultCategory,
            tags: work.tags || [],
            prompt: work.prompt,
            preview: work.description,
        });
    };

    const importPromptFromUrl = async () => {
        const url = linkImportUrl.trim();
        if (!url) {
            message.warning("请先粘贴链接");
            return;
        }
        setLinkImporting(true);
        try {
            const result = await importAdminHomeWorkFromUrl(token, url, linkImportModel);
            applyImportedPrompt(result);
            setIsLinkImportOpen(false);
            message.success("链接解析完成，已回填提示词信息");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "链接解析失败");
        } finally {
            setLinkImporting(false);
        }
    };

    const importWorkToPrompt = (work: HomeWork) => {
        applyImportedPrompt(work);
        setIsWorkImportOpen(false);
    };

    const batchDeletePrompts = async () => {
        await deletePrompts(selectedPromptIds);
        setSelectedPromptIds([]);
        setIsBatchDeleteOpen(false);
    };

    const columns: ProColumns<Prompt>[] = [
        {
            title: "封面",
            dataIndex: "coverUrl",
            width: 88,
            render: (_, item) => <Image src={item.coverUrl || "/logo.svg"} alt={item.title} width={56} height={42} style={{ objectFit: "cover", borderRadius: 6 }} preview={{ mask: "放大" }} fallback="/logo.svg" />,
        },
        {
            title: "标题",
            dataIndex: "title",
            width: 260,
            render: (_, item) => (
                <Typography.Link strong ellipsis style={{ maxWidth: 260, display: "block" }} onClick={() => setDetailPrompt(item)}>
                    {item.title}
                </Typography.Link>
            ),
        },
        {
            title: "分类",
            dataIndex: "category",
            width: 150,
            render: (_, item) => <Typography.Text type="secondary">{categoryName(item.category)}</Typography.Text>,
        },
        {
            title: "标签",
            dataIndex: "tags",
            width: 180,
            render: (_, item) => (
                <Space size={[4, 4]} wrap>
                    {(item.tags || []).slice(0, 3).map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                    ))}
                </Space>
            ),
        },
        {
            title: "更新时间",
            dataIndex: "updatedAt",
            width: 170,
            render: (_, item) => <Typography.Text type="secondary">{formatDateTime(item.updatedAt)}</Typography.Text>,
        },
        {
            title: "操作",
            key: "actions",
            width: 112,
            align: "right",
            render: (_, item) => (
                <Space size={4}>
                    <Tooltip title="详情">
                        <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetailPrompt(item)} />
                    </Tooltip>
                    <Tooltip title="编辑">
                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditingPrompt(item)} />
                    </Tooltip>
                    <Tooltip title="删除">
                        <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => setDeletingPrompt(item)} />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <main style={{ padding: 24 }}>
            <Flex vertical gap={16}>
                <Card variant="borderless">
                    <Form layout="vertical">
                        <Row gutter={16} align="bottom">
                            <Col flex="360px">
                                <Form.Item label="关键词">
                                    <Input.Search value={keywordText} placeholder="搜索标题或提示词" allowClear enterButton={<SearchOutlined />} onSearch={() => searchPrompts(keywordText)} onChange={(event) => setKeywordText(event.target.value)} />
                                </Form.Item>
                            </Col>
                            <Col flex="220px">
                                <Form.Item label="分组">
                                    <Select value={category} onChange={changeCategory} options={categoryOptions} />
                                </Form.Item>
                            </Col>
                            <Col flex="220px">
                                <Form.Item label="标签">
                                    <Select mode="multiple" allowClear maxTagCount="responsive" value={tag} onChange={changeTag} options={tagOptions} placeholder="全部标签" />
                                </Form.Item>
                            </Col>
                            <Col flex="none">
                                <Form.Item>
                                    <Space>
                                        <Button
                                            onClick={() => {
                                                setKeywordText("");
                                                resetFilters();
                                            }}
                                        >
                                            重置
                                        </Button>
                                        <Button type="primary" icon={<ReloadOutlined />} onClick={() => searchPrompts(keywordText)}>
                                            查询
                                        </Button>
                                    </Space>
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Card>
                <ProTable<Prompt>
                    rowKey="id"
                    columns={columns}
                    dataSource={prompts}
                    loading={isLoading}
                    search={false}
                    defaultSize="middle"
                    tableLayout="fixed"
                    cardProps={{ variant: "borderless" }}
                    headerTitle={
                        <Space>
                            <Typography.Text strong>提示词列表</Typography.Text>
                            <Tag>{total} 条</Tag>
                        </Space>
                    }
                    options={{ density: true, setting: true, reload: () => void refreshPrompts() }}
                    rowSelection={{ selectedRowKeys: selectedPromptIds, onChange: (keys) => setSelectedPromptIds(keys.map(String)) }}
                    toolBarRender={() => [
                        <Button key="batch-delete" danger icon={<DeleteOutlined />} disabled={!selectedPromptIds.length} onClick={() => setIsBatchDeleteOpen(true)}>
                            批量删除{selectedPromptIds.length ? ` ${selectedPromptIds.length}` : ""}
                        </Button>,
                        <Button key="categories" icon={<FolderAddOutlined />} onClick={() => setIsCategoryOpen(true)}>
                            分组管理
                        </Button>,
                        <Button key="sync" icon={<SyncOutlined />} onClick={() => setIsSyncOpen(true)}>
                            同步
                        </Button>,
                        <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => setEditingPrompt({ category: defaultCategory, tags: [] })}>
                            新增
                        </Button>,
                    ]}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        showSizeChanger: true,
                        pageSizeOptions: [10, 20, 50, 100],
                        showTotal: (value) => `共 ${value} 条`,
                        onChange: (nextPage, nextPageSize) => (nextPageSize !== pageSize ? changePageSize(nextPageSize) : changePage(nextPage)),
                    }}
                />
            </Flex>

            <Modal title={editingPrompt?.id ? "编辑提示词" : "新增提示词"} open={Boolean(editingPrompt)} width={720} onCancel={() => setEditingPrompt(null)} onOk={() => void savePrompt()} okText="保存" cancelText="取消" destroyOnHidden>
                <Form form={form} layout="vertical" requiredMark={false}>
                    <Form.Item name="preview" hidden>
                        <Input />
                    </Form.Item>
                    <Flex justify="flex-end" style={{ marginBottom: 12 }}>
                        <Space wrap>
                            <Button icon={<LinkOutlined />} onClick={() => setIsLinkImportOpen(true)}>
                                从链接导入
                            </Button>
                            <Button icon={<ExportOutlined />} onClick={() => setIsWorkImportOpen(true)}>
                                从首页作品导入
                            </Button>
                        </Space>
                    </Flex>
                    <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="category" label="分类">
                        <Select options={categories.map((item) => ({ label: item.name, value: item.category }))} />
                    </Form.Item>
                    <Form.Item name="coverUrl" label="封面 URL">
                        <Input />
                    </Form.Item>
                    <Form.Item name="tags" label="标签">
                        <Select mode="tags" allowClear maxTagCount="responsive" tokenSeparators={[",", "，"]} options={tagOptions} placeholder="选择已有标签或输入新标签" />
                    </Form.Item>
                    <Form.Item name="prompt" label="提示词" rules={[{ required: true, message: "请输入提示词" }]}>
                        <Input.TextArea rows={6} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal title="从链接导入提示词" open={isLinkImportOpen} width={720} onCancel={() => !linkImporting && setIsLinkImportOpen(false)} onOk={() => void importPromptFromUrl()} okText="解析并回填" confirmLoading={linkImporting} cancelText="取消" destroyOnHidden>
                <Flex vertical gap={12}>
                    <Input value={linkImportUrl} onChange={(event) => setLinkImportUrl(event.target.value)} placeholder="粘贴图片、视频或作品页面链接" onPressEnter={() => void importPromptFromUrl()} />
                    <div style={{ maxWidth: 320 }}>
                        <ModelPicker config={config} value={linkImportModel} onChange={setLinkImportModel} modelType="text" fullWidth placeholder="解析模型" />
                    </div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        解析结果只会回填当前提示词表单，不会自动保存。
                    </Typography.Text>
                </Flex>
            </Modal>

            <Modal
                title="提示词分组管理"
                open={isCategoryOpen}
                width={720}
                onCancel={() => setIsCategoryOpen(false)}
                footer={
                    <Space>
                        <Button onClick={() => setIsCategoryOpen(false)}>关闭</Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                categoryForm.resetFields();
                                setEditingCategory({});
                            }}
                        >
                            新增分组
                        </Button>
                    </Space>
                }
            >
                <Table
                    rowKey="category"
                    dataSource={categories}
                    pagination={false}
                    columns={[
                        { title: "分组名称", dataIndex: "name" },
                        { title: "分组编码", dataIndex: "category", ellipsis: true },
                        { title: "类型", width: 92, render: (_, item) => <Tag>{categoryTypeLabel(item)}</Tag> },
                        {
                            title: "操作",
                            width: 128,
                            align: "right",
                            render: (_, item) => (
                                <Space size={4}>
                                    <Button
                                        size="small"
                                        icon={<EditOutlined />}
                                        disabled={categoryLocked(item)}
                                        onClick={() => {
                                            categoryForm.resetFields();
                                            setEditingCategory(item);
                                        }}
                                    />
                                    <Button danger size="small" icon={<DeleteOutlined />} disabled={categoryLocked(item)} onClick={() => void deleteCategory(item.category)} />
                                </Space>
                            ),
                        },
                    ]}
                />
            </Modal>

            <Modal title={editingCategory?.category ? "编辑提示词分组" : "新增提示词分组"} open={Boolean(editingCategory)} onCancel={() => setEditingCategory(null)} onOk={() => void savePromptCategory()} okText="保存" cancelText="取消" destroyOnHidden>
                <Form form={categoryForm} layout="vertical" requiredMark={false}>
                    <Form.Item name="name" label="分组名称" rules={[{ required: true, message: "请输入分组名称" }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="category" label="分组编码">
                        <Input disabled={Boolean(editingCategory?.category)} placeholder="留空时自动生成" />
                    </Form.Item>
                    <Form.Item name="description" label="说明">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal title="从首页作品导入" open={isWorkImportOpen} width={860} onCancel={() => setIsWorkImportOpen(false)} footer={<Button onClick={() => setIsWorkImportOpen(false)}>关闭</Button>}>
                <Flex vertical gap={12}>
                    <Flex gap={10} wrap>
                        <Input.Search
                            value={workImportKeyword}
                            placeholder="搜索作品标题、说明或提示词"
                            allowClear
                            enterButton={<SearchOutlined />}
                            onChange={(event) => setWorkImportKeyword(event.target.value)}
                            onSearch={() => void loadImportWorks()}
                            style={{ maxWidth: 360 }}
                        />
                        <Select value={workImportStatus} onChange={setWorkImportStatus} options={workStatusOptions} style={{ width: 140 }} />
                        <Button icon={<ReloadOutlined />} onClick={() => void loadImportWorks()}>
                            刷新
                        </Button>
                    </Flex>
                    <Table
                        rowKey="id"
                        loading={workImportLoading}
                        dataSource={workImportItems}
                        pagination={{ pageSize: 6 }}
                        columns={[
                            {
                                title: "作品",
                                render: (_, item: HomeWork) => (
                                    <Flex gap={10} align="center">
                                        <Image src={item.coverUrl || item.mediaUrl || "/logo.svg"} alt={item.title} width={64} height={48} style={{ objectFit: "cover", borderRadius: 6 }} preview={false} fallback="/logo.svg" />
                                        <Flex vertical style={{ minWidth: 0 }}>
                                            <Typography.Text strong ellipsis>{item.title}</Typography.Text>
                                            <Typography.Text type="secondary" ellipsis>{item.description || item.prompt || "暂无描述"}</Typography.Text>
                                        </Flex>
                                    </Flex>
                                ),
                            },
                            { title: "分类", dataIndex: "category", width: 120, render: (value) => value || "未分类" },
                            { title: "状态", dataIndex: "status", width: 100, render: (value: HomeWorkStatus) => <Tag>{workStatusLabels[value] || value}</Tag> },
                            {
                                title: "操作",
                                width: 96,
                                align: "right",
                                render: (_, item: HomeWork) => (
                                    <Button type="primary" size="small" onClick={() => importWorkToPrompt(item)}>
                                        导入
                                    </Button>
                                ),
                            },
                        ]}
                    />
                </Flex>
            </Modal>

            <Modal title="提示词详情" open={Boolean(detailPrompt)} width={760} onCancel={() => setDetailPrompt(null)} footer={<Button onClick={() => setDetailPrompt(null)}>关闭</Button>}>
                {detailPrompt ? (
                    <Flex vertical gap={14}>
                        <Flex gap={14} align="start">
                            <Image src={detailPrompt.coverUrl || "/logo.svg"} alt={detailPrompt.title} width={116} height={84} style={{ objectFit: "cover", borderRadius: 8 }} preview={{ mask: "放大" }} fallback="/logo.svg" />
                            <Flex vertical gap={8} style={{ minWidth: 0 }}>
                                <Typography.Title level={5} style={{ margin: 0 }}>
                                    {detailPrompt.title}
                                </Typography.Title>
                                <Space wrap>
                                    <Tag>{categoryName(detailPrompt.category)}</Tag>
                                    {(detailPrompt.tags || []).map((tag) => (
                                        <Tag key={tag}>{tag}</Tag>
                                    ))}
                                </Space>
                            </Flex>
                        </Flex>
                        {detailPrompt.preview ? (
                            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                                {detailPrompt.preview}
                            </Typography.Paragraph>
                        ) : null}
                        <Input.TextArea value={detailPrompt.prompt} rows={8} readOnly />
                        <Space>
                            <Button icon={<CopyOutlined />} onClick={() => copyText(detailPrompt.prompt)}>
                                复制提示词
                            </Button>
                            {detailPrompt.githubUrl ? (
                                <Button icon={<ExportOutlined />} href={detailPrompt.githubUrl} target="_blank">
                                    远程源
                                </Button>
                            ) : null}
                        </Space>
                    </Flex>
                ) : null}
            </Modal>

            <Modal
                title="同步远程提示词源"
                open={isSyncOpen}
                width={640}
                onCancel={() => !isSyncing && setIsSyncOpen(false)}
                mask={{ closable: !isSyncing }}
                footer={
                    <Button disabled={isSyncing} onClick={() => setIsSyncOpen(false)}>
                        取消
                    </Button>
                }
            >
                <Table
                    rowKey="category"
                    dataSource={categories.filter((item) => item.remote)}
                    pagination={false}
                    columns={[
                        {
                            title: "远程源",
                            dataIndex: "name",
                            render: (_, item) => (
                                <Flex align="center" gap={8}>
                                    {item.name}
                                    {item.githubUrl ? (
                                        <Typography.Link href={item.githubUrl} target="_blank">
                                            <ExportOutlined />
                                        </Typography.Link>
                                    ) : null}
                                </Flex>
                            ),
                        },
                        {
                            title: "更新时间",
                            dataIndex: "updatedAt",
                            width: 170,
                            render: (_, item) => <Typography.Text type="secondary">{formatDateTime(item.updatedAt)}</Typography.Text>,
                        },
                        {
                            title: "",
                            key: "sync",
                            width: 96,
                            align: "right",
                            render: (_, item) => (
                                <Button
                                    type="primary"
                                    loading={isSyncing}
                                    onClick={async () => {
                                        try {
                                            await syncCategory(item.category);
                                            setIsSyncOpen(false);
                                        } catch {}
                                    }}
                                >
                                    同步
                                </Button>
                            ),
                        },
                    ]}
                />
            </Modal>

            <Modal
                title="删除提示词"
                open={Boolean(deletingPrompt)}
                onCancel={() => setDeletingPrompt(null)}
                onOk={async () => {
                    if (!deletingPrompt) return;
                    await deletePrompt(deletingPrompt.id);
                    setDeletingPrompt(null);
                }}
                okText="删除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
            >
                确定删除「{deletingPrompt?.title}」吗？删除后会从当前分类中删除。
            </Modal>

            <Modal title="批量删除提示词" open={isBatchDeleteOpen} onCancel={() => setIsBatchDeleteOpen(false)} onOk={() => void batchDeletePrompts()} okText="删除" okButtonProps={{ danger: true }} cancelText="取消">
                确定删除已选中的 {selectedPromptIds.length} 条提示词吗？删除后会从当前分类中删除。
            </Modal>
        </main>
    );
}
