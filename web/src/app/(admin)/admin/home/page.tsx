"use client";

import { DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined, ReloadOutlined, SendOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button, Card, Flex, Form, Image, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ImageSettingsPanel } from "@/components/image-settings-panel";
import { ModelPicker } from "@/components/model-picker";
import { requestGeneration } from "@/services/api/image";
import { requestVideoGeneration, storeGeneratedVideo } from "@/services/api/video";
import { deleteAdminHomeCategory, deleteAdminHomeSlide, deleteAdminHomeTag, deleteAdminHomeWork, fetchAdminHomeCategories, fetchAdminHomeSlides, fetchAdminHomeTags, fetchAdminHomeWorks, fetchAdminSettings, importAdminHomeWorkFromUrl, saveAdminHomeCategory, saveAdminHomeSlide, saveAdminHomeTag, saveAdminHomeWork, saveAdminSettings, uploadAdminHomeMedia, type AdminSettings } from "@/services/api/admin";
import type { HomeCategory, HomeSlide, HomeTag, HomeWork, HomeWorkStatus, HomeWorkType } from "@/services/api/home";
import { uploadImage } from "@/services/image-storage";
import { useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { canvasThemes } from "@/lib/canvas-theme";

type NameItem = HomeCategory | HomeTag;
type WorkForm = Partial<HomeWork> & { tagNames?: string[] };

const statusOptions: Array<{ label: string; value: HomeWorkStatus }> = [
    { label: "待发布", value: "pending" },
    { label: "已发布", value: "published" },
    { label: "已下架", value: "hidden" },
    { label: "草稿", value: "draft" },
];

const typeOptions: Array<{ label: string; value: HomeWorkType }> = [
    { label: "图片", value: "image" },
    { label: "视频", value: "video" },
];

export default function AdminHomePage() {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token) || "";
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const [works, setWorks] = useState<HomeWork[]>([]);
    const [slides, setSlides] = useState<HomeSlide[]>([]);
    const [categories, setCategories] = useState<HomeCategory[]>([]);
    const [tags, setTags] = useState<HomeTag[]>([]);
    const [settings, setSettings] = useState<AdminSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [workOpen, setWorkOpen] = useState(false);
    const [slideOpen, setSlideOpen] = useState(false);
    const [editingWork, setEditingWork] = useState<Partial<HomeWork> | null>(null);
    const [editingSlide, setEditingSlide] = useState<Partial<HomeSlide> | null>(null);
    const [workForm] = Form.useForm<WorkForm>();
    const [slideForm] = Form.useForm<Partial<HomeSlide>>();
    const workMediaInputRef = useRef<HTMLInputElement>(null);
    const slideMediaInputRef = useRef<HTMLInputElement>(null);
    const [generatePrompt, setGeneratePrompt] = useState("");
    const [importUrl, setImportUrl] = useState("");
    const [importModel, setImportModel] = useState("");
    const [generateType, setGenerateType] = useState<HomeWorkType>("image");
    const [generating, setGenerating] = useState(false);
    const [importingWork, setImportingWork] = useState(false);
    const [uploadingField, setUploadingField] = useState<"" | "workMedia" | "slideMedia">("");
    const model = generateType === "image" ? effectiveConfig.imageModel : effectiveConfig.videoModel;
    const worksEnabled = settings?.public.site.worksEnabled !== false;
    const heroMediaItems = slides.filter((item) => item.kind === "media");
    const heroTextItems = slides.filter((item) => item.kind !== "media");

    useEffect(() => {
        void refresh();
    }, []);

    useEffect(() => {
        if (editingWork) workForm.setFieldsValue({ ...editingWork, tagNames: editingWork.tags || [] });
    }, [editingWork, workForm]);

    useEffect(() => {
        if (editingSlide) {
            slideForm.resetFields();
            slideForm.setFieldsValue(editingSlide);
        }
    }, [editingSlide, slideForm]);

    useEffect(() => {
        if (!settings || importModel) return;
        setImportModel(settings.public.modelChannel.defaultTextModel || "");
    }, [importModel, settings]);

    const refresh = async () => {
        setLoading(true);
        try {
            const [workData, slideData, categoryData, tagData, settingsData] = await Promise.all([fetchAdminHomeWorks(token, { pageSize: 100, status: "all" }), fetchAdminHomeSlides(token), fetchAdminHomeCategories(token), fetchAdminHomeTags(token), fetchAdminSettings(token)]);
            setWorks(workData.items);
            setSlides(slideData);
            setCategories(categoryData);
            setTags(tagData);
            setSettings(settingsData);
        } finally {
            setLoading(false);
        }
    };

    const openWorkEditor = (item: Partial<HomeWork>) => {
        setEditingWork({ type: "image", status: "pending", allowSameStyle: true, showPrompt: true, tags: [], ...item });
        setImportUrl("");
        setImportModel(settings?.public.modelChannel.defaultTextModel || "");
        setWorkOpen(true);
    };

    const saveWorksEnabled = async (worksEnabled: boolean) => {
        if (!settings) return;
        const saved = await saveAdminSettings(token, { ...settings, public: { ...settings.public, site: { ...settings.public.site, worksEnabled } } });
        setSettings(saved);
        message.success(worksEnabled ? "首页作品展示已开启" : "首页作品展示已关闭");
    };

    const saveWork = async () => {
        const value = await workForm.validateFields();
        await saveAdminHomeWork(token, { ...editingWork, ...value, tags: value.tagNames || [] });
        message.success("作品已保存");
        setWorkOpen(false);
        await refresh();
    };

    const importWorkFromUrl = async () => {
        const url = importUrl.trim();
        if (!url) {
            message.warning("请先粘贴作品链接");
            return;
        }
        setImportingWork(true);
        try {
            const result = await importAdminHomeWorkFromUrl(token, url, importModel);
            workForm.setFieldsValue({
                ...result,
                tagNames: result.tags || [],
                status: result.status || "pending",
                showPrompt: result.showPrompt !== false,
                allowSameStyle: result.allowSameStyle !== false,
            });
            setEditingWork((current) => ({ type: "image", status: "pending", allowSameStyle: true, showPrompt: true, tags: [], ...current, ...result }));
            message.success("链接解析完成，已自动回填作品信息");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "链接解析失败");
        } finally {
            setImportingWork(false);
        }
    };

    const uploadHomeMedia = async (file: File | undefined, field: "workMedia" | "slideMedia") => {
        if (!file) return;
        setUploadingField(field);
        try {
            const uploaded = await uploadAdminHomeMedia(token, file);
            if (field === "workMedia") {
                workForm.setFieldValue("mediaUrl", uploaded.url);
                if (!workForm.getFieldValue("coverUrl") && uploaded.mimeType.startsWith("image/")) workForm.setFieldValue("coverUrl", uploaded.url);
            } else {
                slideForm.setFieldValue("coverUrl", uploaded.url);
            }
            message.success("媒体已上传");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "媒体上传失败");
        } finally {
            setUploadingField("");
            if (field === "workMedia" && workMediaInputRef.current) workMediaInputRef.current.value = "";
            if (field === "slideMedia" && slideMediaInputRef.current) slideMediaInputRef.current.value = "";
        }
    };

    const generateWork = async () => {
        const prompt = generatePrompt.trim();
        if (!prompt) {
            message.warning("请输入生成提示词");
            return;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            openConfigDialog(true);
            return;
        }
        setGenerating(true);
        try {
            if (generateType === "image") {
                const snapshot = { ...effectiveConfig, model, imageModel: model, count: "1" };
                const image = (await requestGeneration(snapshot, prompt))[0];
                const uploaded = await uploadImage(image.dataUrl);
                openWorkEditor({ title: prompt.slice(0, 24), type: "image", coverUrl: uploaded.url, mediaUrl: uploaded.url, prompt, model, status: "pending" });
            } else {
                const video = await storeGeneratedVideo(await requestVideoGeneration({ ...effectiveConfig, model, videoModel: model }, prompt));
                openWorkEditor({ title: prompt.slice(0, 24), type: "video", coverUrl: "", mediaUrl: video.url, prompt, model, status: "pending" });
            }
            setGeneratePrompt("");
            message.success("已生成作品，请完善信息后发布");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "生成失败");
        } finally {
            setGenerating(false);
        }
    };

    const workColumns: ColumnsType<HomeWork> = [
        { title: "封面", width: 92, render: (_, item) => <WorkMedia item={item} /> },
        { title: "作品", dataIndex: "title", render: (_, item) => <WorkTitle item={item} /> },
        { title: "分类", dataIndex: "category", width: 120, render: (value) => value || "未分类" },
        { title: "状态", dataIndex: "status", width: 96, render: (value: HomeWorkStatus) => <Tag>{statusOptions.find((item) => item.value === value)?.label || value}</Tag> },
        { title: "排序", dataIndex: "sort", width: 80 },
        {
            title: "操作",
            width: 180,
            align: "right",
            render: (_, item) => (
                <Space size={4}>
                    {item.status !== "published" ? <Button size="small" onClick={() => void quickSaveWork({ ...item, status: "published" })}>发布</Button> : <Button size="small" onClick={() => void quickSaveWork({ ...item, status: "hidden" })}>下架</Button>}
                    <Button size="small" icon={<EditOutlined />} onClick={() => openWorkEditor(item)} />
                    <Button danger size="small" icon={<DeleteOutlined />} onClick={() => void removeWork(item)} />
                </Space>
            ),
        },
    ];

    const quickSaveWork = async (item: HomeWork) => {
        await saveAdminHomeWork(token, item);
        await refresh();
    };

    const removeWork = async (item: HomeWork) => {
        if (!window.confirm(`确定删除“${item.title}”吗？`)) return;
        await deleteAdminHomeWork(token, item.id);
        await refresh();
    };

    const textColumns: ColumnsType<HomeSlide> = [
        { title: "标题", dataIndex: "title", render: (_, item) => <Typography.Text strong>{item.title}</Typography.Text> },
        { title: "副标题", dataIndex: "subtitle", ellipsis: true },
        { title: "启用", dataIndex: "enabled", width: 80, render: (value) => <Tag>{value ? "启用" : "关闭"}</Tag> },
        { title: "排序", dataIndex: "sort", width: 80 },
        {
            title: "操作",
            width: 120,
            align: "right",
            render: (_, item) => (
                <Space size={4}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingSlide(item); setSlideOpen(true); }} />
                    <Button danger size="small" icon={<DeleteOutlined />} onClick={() => void removeSlide(item)} />
                </Space>
            ),
        },
    ];

    const mediaColumns: ColumnsType<HomeSlide> = [
        { title: "背景媒体", width: 120, render: (_, item) => <HeroTextMedia url={item.coverUrl} title={item.title || "顶部背景"} /> },
        { title: "媒体地址", dataIndex: "coverUrl", ellipsis: true },
        { title: "启用", dataIndex: "enabled", width: 80, render: (value) => <Tag>{value ? "启用" : "关闭"}</Tag> },
        { title: "排序", dataIndex: "sort", width: 80 },
        {
            title: "操作",
            width: 120,
            align: "right",
            render: (_, item) => (
                <Space size={4}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingSlide(item); setSlideOpen(true); }} />
                    <Button danger size="small" icon={<DeleteOutlined />} onClick={() => void removeSlide(item)} />
                </Space>
            ),
        },
    ];

    const saveSlide = async () => {
        const value = await slideForm.validateFields();
        await saveAdminHomeSlide(token, { ...editingSlide, ...value });
        message.success(editingSlide?.kind === "media" ? "顶部背景已保存" : "首页文案已保存");
        setSlideOpen(false);
        await refresh();
    };

    const removeSlide = async (item: HomeSlide) => {
        if (!window.confirm(`确定删除“${item.title || "顶部背景"}”吗？`)) return;
        await deleteAdminHomeSlide(token, item.id);
        await refresh();
    };

    return (
        <main style={{ padding: 24 }}>
            <Flex vertical gap={16}>
                <Card variant="borderless">
                    <Flex justify="space-between" align="center" gap={16} wrap>
                        <div>
                            <Typography.Title level={4} style={{ margin: 0 }}>首页内容</Typography.Title>
                            <Typography.Text type="secondary">管理首页顶部文案、精选作品、作品分类和标签。</Typography.Text>
                        </div>
                        <Space>
                            <span>首页作品展示</span>
                            <Switch checked={worksEnabled} disabled={!settings} onChange={(checked) => void saveWorksEnabled(checked)} />
                            <Button icon={<ReloadOutlined />} onClick={() => void refresh()}>刷新</Button>
                        </Space>
                    </Flex>
                </Card>
                <Tabs
                    items={[
                        { key: "works", label: "作品发布", children: <WorksTab config={config} theme={theme} updateConfig={updateConfig} model={model} generateType={generateType} setGenerateType={setGenerateType} prompt={generatePrompt} setPrompt={setGeneratePrompt} generating={generating} onGenerate={generateWork} /> },
                        {
                            key: "slides",
                            label: "顶部展示",
                            children: (
                                <Flex vertical gap={16}>
                                    <TableCard title="顶部背景" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingSlide({ kind: "media", enabled: true, sort: 0 }); setSlideOpen(true); }}>新增背景</Button>} loading={loading} columns={mediaColumns} data={heroMediaItems} />
                                    <TableCard title="覆盖文案" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingSlide({ kind: "text", enabled: true, sort: 0 }); setSlideOpen(true); }}>新增文案</Button>} loading={loading} columns={textColumns} data={heroTextItems} />
                                </Flex>
                            ),
                        },
                        { key: "categories", label: "分类", children: <NameManager title="作品分类" items={categories} onSave={(item) => saveAdminHomeCategory(token, item).then(refresh)} onDelete={(id) => deleteAdminHomeCategory(token, id).then(refresh)} /> },
                        { key: "tags", label: "标签", children: <NameManager title="作品标签" items={tags} onSave={(item) => saveAdminHomeTag(token, item).then(refresh)} onDelete={(id) => deleteAdminHomeTag(token, id).then(refresh)} /> },
                        { key: "work-list", label: "作品列表", children: <TableCard title="作品列表" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openWorkEditor({})}>手动新增</Button>} loading={loading} columns={workColumns} data={works} /> },
                    ]}
                />
            </Flex>
            <Modal title={editingWork?.id ? "编辑作品" : "发布作品"} open={workOpen} width={820} onCancel={() => setWorkOpen(false)} onOk={() => void saveWork()} okText="保存" cancelText="取消" destroyOnHidden>
                <Form form={workForm} layout="vertical" requiredMark={false}>
                    <Card size="small" title="作品链接导入" style={{ marginBottom: 16 }}>
                        <Flex gap={10} align="center">
                            <Input value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="粘贴作品链接，自动抓取媒体并用大模型回填信息" onPressEnter={() => void importWorkFromUrl()} />
                            <div style={{ width: 240 }}>
                                <ModelPicker config={config} value={importModel} onChange={setImportModel} modelType="text" fullWidth placeholder="解析模型" />
                            </div>
                            <Button icon={<LinkOutlined />} loading={importingWork} onClick={() => void importWorkFromUrl()}>
                                智能解析
                            </Button>
                        </Flex>
                        <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
                            支持直接图片/视频链接和普通网页链接；解析模型默认复用系统默认文本模型，解析结果只会回填下方表单，仍需手动保存发布。
                        </Typography.Text>
                    </Card>
                    <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}><Input /></Form.Item>
                    <Form.Item name="description" label="作品信息"><Input.TextArea rows={3} /></Form.Item>
                    <Flex gap={12}>
                        <Form.Item name="type" label="类型" style={{ flex: 1 }}><Select options={typeOptions} /></Form.Item>
                        <Form.Item name="status" label="状态" style={{ flex: 1 }}><Select options={statusOptions} /></Form.Item>
                    </Flex>
                    <Flex gap={12}>
                        <Form.Item name="category" label="分类" style={{ flex: 1 }}><Select allowClear options={categories.map((item) => ({ label: item.name, value: item.name }))} /></Form.Item>
                        <Form.Item name="tagNames" label="标签" style={{ flex: 1 }}><Select mode="multiple" allowClear options={tags.map((item) => ({ label: item.name, value: item.name }))} /></Form.Item>
                    </Flex>
                    <Form.Item name="coverUrl" label="封面 URL"><Input /></Form.Item>
                    <Form.Item label="作品媒体">
                        <Space.Compact style={{ width: "100%" }}>
                            <Form.Item name="mediaUrl" noStyle rules={[{ required: true, message: "请上传或输入作品媒体地址" }]}>
                                <Input placeholder="上传后自动回填，也可粘贴 URL" />
                            </Form.Item>
                            <Button loading={uploadingField === "workMedia"} icon={<UploadOutlined />} onClick={() => workMediaInputRef.current?.click()}>
                                上传
                            </Button>
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item name="prompt" label="提示词"><Input.TextArea rows={4} /></Form.Item>
                    <Flex gap={12}>
                        <Form.Item name="model" label="模型" style={{ flex: 1 }}><Input /></Form.Item>
                        <Form.Item name="sort" label="排序" style={{ width: 140 }}><InputNumber style={{ width: "100%" }} /></Form.Item>
                    </Flex>
                    <Flex gap={28}>
                        <Form.Item name="showPrompt" label="显示提示词" valuePropName="checked"><Switch /></Form.Item>
                        <Form.Item name="allowSameStyle" label="允许做同款" valuePropName="checked"><Switch /></Form.Item>
                    </Flex>
                </Form>
            </Modal>
            <Modal title={editingSlide?.kind === "media" ? (editingSlide?.id ? "编辑顶部背景" : "新增顶部背景") : (editingSlide?.id ? "编辑覆盖文案" : "新增覆盖文案")} open={slideOpen} width={720} onCancel={() => setSlideOpen(false)} onOk={() => void saveSlide()} okText="保存" cancelText="取消" destroyOnHidden>
                <Form form={slideForm} layout="vertical" requiredMark={false}>
                    <Form.Item name="kind" hidden><Input /></Form.Item>
                    {editingSlide?.kind === "media" ? (
                        <Form.Item label="背景视频 / 图片" rules={[{ required: true, message: "请上传或输入背景媒体地址" }]}>
                            <Space.Compact style={{ width: "100%" }}>
                                <Form.Item name="coverUrl" noStyle rules={[{ required: true, message: "请上传或输入背景媒体地址" }]}>
                                    <Input placeholder="上传后自动回填，也可粘贴视频、动图或图片 URL" />
                                </Form.Item>
                                <Button loading={uploadingField === "slideMedia"} icon={<UploadOutlined />} onClick={() => slideMediaInputRef.current?.click()}>
                                    上传
                                </Button>
                            </Space.Compact>
                        </Form.Item>
                    ) : (
                        <>
                            <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}><Input /></Form.Item>
                            <Form.Item name="subtitle" label="副标题"><Input.TextArea rows={2} /></Form.Item>
                            <Form.Item name="workId" label="关联作品"><Select allowClear options={works.map((item) => ({ label: item.title, value: item.id }))} /></Form.Item>
                            <Form.Item name="linkUrl" label="跳转链接"><Input placeholder="可填写外链或站内路径" /></Form.Item>
                        </>
                    )}
                    <Flex gap={24}>
                        <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
                        <Form.Item name="sort" label="排序"><InputNumber /></Form.Item>
                    </Flex>
                </Form>
            </Modal>
            <input ref={workMediaInputRef} hidden type="file" accept="image/*,video/*" onChange={(event) => void uploadHomeMedia(event.currentTarget.files?.[0], "workMedia")} />
            <input ref={slideMediaInputRef} hidden type="file" accept="image/*,video/*" onChange={(event) => void uploadHomeMedia(event.currentTarget.files?.[0], "slideMedia")} />
        </main>
    );
}

function WorksTab({ config, theme, updateConfig, model, generateType, setGenerateType, prompt, setPrompt, generating, onGenerate }: { config: AiConfig; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void; model: string; generateType: HomeWorkType; setGenerateType: (value: HomeWorkType) => void; prompt: string; setPrompt: (value: string) => void; generating: boolean; onGenerate: () => void }) {
    return (
        <Flex vertical gap={16}>
            <Card title="生成后发布" variant="borderless">
                <Flex vertical gap={14}>
                    <Flex gap={12} wrap>
                        <Select value={generateType} onChange={setGenerateType} options={typeOptions} style={{ width: 140 }} />
                        <div style={{ width: 280 }}><ModelPicker config={config} value={model} onChange={(value) => updateConfig(generateType === "image" ? "imageModel" : "videoModel", value)} capability={generateType} fullWidth placeholder="选择模型" /></div>
                        <Button type="primary" icon={<SendOutlined />} loading={generating} onClick={onGenerate}>生成作品</Button>
                    </Flex>
                    <Input.TextArea value={prompt} rows={4} onChange={(event) => setPrompt(event.target.value)} placeholder="输入提示词，生成完成后会进入待发布状态" />
                    {generateType === "image" ? <ImageSettingsPanel config={config} onConfigChange={(key, value) => updateConfig(key, value)} theme={theme} showTitle={false} showCount={false} className="max-w-[520px] space-y-4" /> : null}
                </Flex>
            </Card>
        </Flex>
    );
}

function TableCard<T extends { id: string }>({ title, extra, loading, columns, data }: { title: string; extra?: ReactNode; loading: boolean; columns: ColumnsType<T>; data: T[] }) {
    return (
        <Card title={title} extra={extra} variant="borderless">
            <Table rowKey="id" loading={loading} columns={columns} dataSource={data} pagination={{ pageSize: 10 }} />
        </Card>
    );
}

function WorkMedia({ item }: { item: HomeWork }) {
    const url = item.coverUrl || item.mediaUrl || "/logo.svg";
    return item.type === "video" && !item.coverUrl ? <video src={item.mediaUrl} className="h-12 w-16 rounded-lg bg-black object-cover" muted /> : <Image src={url} alt={item.title} width={64} height={48} style={{ objectFit: "cover", borderRadius: 8 }} fallback="/logo.svg" />;
}

function HeroTextMedia({ url, title }: { url?: string; title: string }) {
    if (!url) return <Tag>仅文案</Tag>;
    return isVideoUrl(url) ? <video src={url} className="h-12 w-[72px] rounded-lg bg-black object-cover" muted /> : <Image src={url} alt={title} width={72} height={48} style={{ objectFit: "cover", borderRadius: 8 }} fallback="/logo.svg" />;
}

function WorkTitle({ item }: { item: HomeWork }) {
    return (
        <Flex vertical gap={4}>
            <Typography.Text strong>{item.title}</Typography.Text>
            <Space size={[4, 4]} wrap>{item.tags?.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space>
        </Flex>
    );
}

function NameManager({ title, items, onSave, onDelete }: { title: string; items: NameItem[]; onSave: (item: Partial<NameItem>) => Promise<unknown>; onDelete: (id: string) => Promise<unknown> }) {
    const [form] = Form.useForm<Partial<NameItem>>();
    const [editing, setEditing] = useState<Partial<NameItem> | null>(null);
    useEffect(() => {
        if (editing) form.setFieldsValue(editing);
    }, [editing, form]);
    const save = async () => {
        await onSave({ ...editing, ...(await form.validateFields()) });
        setEditing(null);
    };
    return (
        <Card title={title} extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ enabled: true, sort: 0 })}>新增</Button>} variant="borderless">
            <Table
                rowKey="id"
                dataSource={items}
                columns={[
                    { title: "名称", dataIndex: "name" },
                    { title: "启用", dataIndex: "enabled", width: 90, render: (value) => <Tag>{value ? "启用" : "关闭"}</Tag> },
                    { title: "排序", dataIndex: "sort", width: 90 },
                    { title: "操作", width: 120, align: "right", render: (_, item) => <Space size={4}><Button size="small" icon={<EditOutlined />} onClick={() => setEditing(item)} /><Button danger size="small" icon={<DeleteOutlined />} onClick={() => onDelete(item.id)} /></Space> },
                ]}
                pagination={false}
            />
            <Modal title={editing?.id ? "编辑" : "新增"} open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={() => void save()} okText="保存" cancelText="取消" destroyOnHidden>
                <Form form={form} layout="vertical" requiredMark={false}>
                    <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}><Input /></Form.Item>
                    <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item name="sort" label="排序"><InputNumber /></Form.Item>
                </Form>
            </Modal>
        </Card>
    );
}

function isVideoUrl(url?: string) {
    if (!url) return false;
    return /\.(mp4|webm|mov|m4v)$/i.test(url);
}

