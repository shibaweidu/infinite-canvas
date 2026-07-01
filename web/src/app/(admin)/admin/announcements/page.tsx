"use client";

import { App, Button, Drawer, Flex, Form, Input, InputNumber, Select, Space, Switch, Table, Tag, Tooltip, Upload, theme } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { CSSProperties, ReactNode } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Eraser, Edit, ImageIcon, Italic, LinkIcon, List, ListOrdered, Plus, RefreshCw, Trash2, Underline, Upload as UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { deleteAdminAnnouncement, fetchAdminAnnouncements, saveAdminAnnouncement, uploadAdminAnnouncementImage, type AdminAnnouncement } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

const defaultAnnouncement: Partial<AdminAnnouncement> = { enabled: true, pinned: false, sort: 100, title: "", summary: "", content: "" };

export default function AdminAnnouncementsPage() {
    const { token: antToken } = theme.useToken();
    const { message, modal } = App.useApp();
    const token = useUserStore((state) => state.token);
    const [items, setItems] = useState<AdminAnnouncement[]>([]);
    const [editing, setEditing] = useState<Partial<AdminAnnouncement> | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const loadItems = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data = await fetchAdminAnnouncements(token, { pageSize: 200 });
            setItems(data.items || []);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "公告读取失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadItems();
    }, [token]);

    const openEditor = (item?: AdminAnnouncement) => {
        const next = item || defaultAnnouncement;
        form.resetFields();
        setEditing(next);
        form.setFieldsValue(next);
    };

    const closeEditor = () => {
        setEditing(null);
        form.resetFields();
    };

    const saveItem = async () => {
        if (!token || !editing) return;
        const values = await form.validateFields();
        if (!plainText(values.content)) {
            message.error("请输入正文内容");
            return;
        }
        setSaving(true);
        try {
            await saveAdminAnnouncement(token, { ...editing, ...values });
            message.success("公告已保存");
            closeEditor();
            await loadItems();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const removeItem = (id: string) => {
        if (!token) return;
        modal.confirm({
            title: "删除公告",
            content: "删除后前台将不再显示该公告。",
            okText: "删除",
            cancelText: "取消",
            onOk: async () => {
                await deleteAdminAnnouncement(token, id);
                message.success("公告已删除");
                await loadItems();
            },
        });
    };

    const handleUpload = async (file: File) => {
        if (!token) {
            message.error("请先登录");
            return Upload.LIST_IGNORE;
        }
        try {
            const uploaded = await uploadAdminAnnouncementImage(token, file);
            const current = form.getFieldValue("content") || "";
            form.setFieldValue("content", `${current}<p><img src="${uploaded.url}" alt="${file.name}" /></p>`);
            message.success("图片已上传并插入正文");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "图片上传失败");
        }
        return Upload.LIST_IGNORE;
    };

    const columns: ColumnsType<AdminAnnouncement> = [
        {
            title: "标题",
            dataIndex: "title",
            render: (value, item) => (
                <Space>
                    {item.pinned ? (
                        <Tag color="default" style={{ background: "#f5f5f5", color: "#171717", borderColor: "#e5e5e5" }}>
                            置顶
                        </Tag>
                    ) : null}
                    <span>{value}</span>
                </Space>
            ),
        },
        { title: "摘要", dataIndex: "summary", ellipsis: true },
        { title: "状态", dataIndex: "enabled", width: 90, render: (value) => <Tag color={value ? "green" : "default"}>{value ? "显示" : "隐藏"}</Tag> },
        { title: "排序", dataIndex: "sort", width: 90 },
        { title: "发布时间", dataIndex: "publishedAt", width: 180 },
        {
            title: "操作",
            width: 130,
            render: (_, item) => (
                <Space size={4}>
                    <Button size="small" icon={<Edit className="size-3.5" />} onClick={() => openEditor(item)} />
                    <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => removeItem(item.id)} />
                </Space>
            ),
        },
    ];

    return (
        <main style={{ padding: 24 }}>
            <Flex align="flex-start" justify="space-between" gap={12} wrap style={{ marginBottom: 16 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, color: "var(--app-text-primary)" }}>公告管理</h1>
                    <p style={{ margin: "8px 0 0", color: "var(--app-text-muted)" }}>发布平台公告，支持正文编辑、置顶、排序和前台显示控制。</p>
                </div>
                <Space>
                    <Button icon={<RefreshCw className="size-4" />} onClick={() => void loadItems()} loading={loading} style={{ cursor: "pointer" }}>
                        刷新
                    </Button>
                    <Button
                        type="primary"
                        icon={<Plus className="size-4" />}
                        onClick={() => openEditor()}
                        style={{ ...primaryButtonStyle(antToken), cursor: "pointer" }}
                    >
                        新增公告
                    </Button>
                </Space>
            </Flex>
            <Table rowKey="id" loading={loading} columns={columns} dataSource={items} pagination={{ pageSize: 12 }} />

            <Drawer
                title={editing?.id ? "编辑公告" : "新增公告"}
                open={!!editing}
                width={720}
                onClose={closeEditor}
                extra={
                    <Button
                        type="primary"
                        loading={saving}
                        onClick={() => void saveItem()}
                        style={{ ...primaryButtonStyle(antToken), cursor: "pointer" }}
                    >
                        保存
                    </Button>
                }
            >
                <Form form={form} layout="vertical" preserve={false}>
                    <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
                        <Input size="large" />
                    </Form.Item>
                    <Form.Item name="summary" label="摘要">
                        <Input.TextArea rows={3} placeholder="简短的摘要，显示在公告列表中" />
                    </Form.Item>
                    <Form.Item name="content" label="正文内容" rules={[{ required: true, message: "请输入正文内容" }]}>
                        <DocumentEditor token={token} />
                    </Form.Item>
                    <Form.Item label="上传图片">
                        <Upload accept="image/*" beforeUpload={handleUpload} showUploadList={false}>
                            <Button icon={<UploadIcon className="size-4" />} style={{ cursor: "pointer" }}>上传到对象存储</Button>
                        </Upload>
                        <div style={{ marginTop: 8, fontSize: 12, color: "var(--app-text-muted)" }}>图片会上传到后台配置的对象存储，成功后自动插入正文。</div>
                    </Form.Item>
                    <Space size={16} align="start">
                        <Form.Item name="enabled" label="前台显示" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                        <Form.Item name="pinned" label="置顶" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                        <Form.Item name="sort" label="排序">
                            <InputNumber min={0} />
                        </Form.Item>
                    </Space>
                    <Form.Item name="publishedAt" label="发布时间">
                        <Input placeholder="留空则保存时自动写入" />
                    </Form.Item>
                </Form>
            </Drawer>
        </main>
    );
}

function plainText(value?: string) {
    return (value || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function DocumentEditor({ value, token: authToken, onChange }: { value?: string; token: string; onChange?: (value: string) => void }) {
    const { token } = theme.useToken();
    const { message } = App.useApp();
    const editorRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const editor = editorRef.current;
        if (editor && editor.innerHTML !== (value || "")) {
            editor.innerHTML = value || "";
        }
    }, [value]);

    const emitChange = () => {
        onChange?.(editorRef.current?.innerHTML || "");
    };

    const runCommand = (command: string, nextValue?: string) => {
        editorRef.current?.focus();
        restoreSelection();
        document.execCommand(command, false, nextValue);
        emitChange();
    };

    const addLink = () => {
        const url = window.prompt("请输入链接地址");
        if (url) runCommand("createLink", url);
    };

    const uploadImage = async (file?: File) => {
        if (!file) return;
        if (!authToken) {
            message.error("请先登录");
            return;
        }
        setUploading(true);
        try {
            const uploaded = await uploadAdminAnnouncementImage(authToken, file);
            insertImage(uploaded.url);
            message.success("图片已上传");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "图片上传失败");
        } finally {
            setUploading(false);
            if (imageInputRef.current) imageInputRef.current.value = "";
        }
    };

    const saveSelection = () => {
        const selection = window.getSelection();
        if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
        savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    };

    const restoreSelection = () => {
        const range = savedRangeRef.current;
        if (!range) return;
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    };

    const insertImage = (url: string) => {
        editorRef.current?.focus();
        restoreSelection();
        if (!document.execCommand("insertImage", false, url)) {
            editorRef.current?.insertAdjacentHTML("beforeend", `<p><img src="${url}" alt="" /></p>`);
        }
        emitChange();
    };

    const toolbarStyle: CSSProperties = {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
        padding: 8,
        border: `1px solid ${token.colorBorder}`,
        borderBottom: 0,
        borderRadius: "8px 8px 0 0",
        background: token.colorBgElevated,
    };
    const editorStyle: CSSProperties = {
        minHeight: 320,
        padding: "18px 20px",
        border: `1px solid ${token.colorBorder}`,
        borderRadius: "0 0 8px 8px",
        background: token.colorBgContainer,
        color: token.colorText,
        lineHeight: 1.8,
        outline: "none",
    };

    return (
        <div>
            <div style={toolbarStyle}>
                <Select
                    size="small"
                    defaultValue="P"
                    style={{ width: 96 }}
                    options={[
                        { label: "正文", value: "P" },
                        { label: "标题 1", value: "H1" },
                        { label: "标题 2", value: "H2" },
                        { label: "标题 3", value: "H3" },
                    ]}
                    onChange={(format) => runCommand("formatBlock", format)}
                />
                <EditorButton title="加粗" icon={<Bold className="size-4" />} onClick={() => runCommand("bold")} />
                <EditorButton title="斜体" icon={<Italic className="size-4" />} onClick={() => runCommand("italic")} />
                <EditorButton title="下划线" icon={<Underline className="size-4" />} onClick={() => runCommand("underline")} />
                <EditorButton title="项目列表" icon={<List className="size-4" />} onClick={() => runCommand("insertUnorderedList")} />
                <EditorButton title="编号列表" icon={<ListOrdered className="size-4" />} onClick={() => runCommand("insertOrderedList")} />
                <EditorButton title="左对齐" icon={<AlignLeft className="size-4" />} onClick={() => runCommand("justifyLeft")} />
                <EditorButton title="居中" icon={<AlignCenter className="size-4" />} onClick={() => runCommand("justifyCenter")} />
                <EditorButton title="右对齐" icon={<AlignRight className="size-4" />} onClick={() => runCommand("justifyRight")} />
                <EditorButton title="插入链接" icon={<LinkIcon className="size-4" />} onClick={addLink} />
                <EditorButton
                    title="上传图片"
                    loading={uploading}
                    icon={<ImageIcon className="size-4" />}
                    onClick={() => {
                        saveSelection();
                        imageInputRef.current?.click();
                    }}
                />
                <EditorButton title="清除格式" icon={<Eraser className="size-4" />} onClick={() => runCommand("removeFormat")} />
                <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => void uploadImage(event.currentTarget.files?.[0])} />
            </div>
            <div
                ref={editorRef}
                className="announcement-document-editor"
                contentEditable
                suppressContentEditableWarning
                style={editorStyle}
                data-placeholder="像编辑文档一样输入公告正文，可设置标题、列表、链接和图片"
                onInput={emitChange}
                onBlur={() => {
                    saveSelection();
                    emitChange();
                }}
                onKeyUp={saveSelection}
                onMouseUp={saveSelection}
            />
        </div>
    );
}

function EditorButton({ title, icon, loading, onClick }: { title: string; icon: ReactNode; loading?: boolean; onClick: () => void }) {
    return (
        <Tooltip title={title}>
            <Button size="small" icon={icon} loading={loading} onMouseDown={(event) => event.preventDefault()} onClick={onClick} style={{ cursor: "pointer" }} />
        </Tooltip>
    );
}

function primaryButtonStyle(token: ReturnType<typeof theme.useToken>["token"]): CSSProperties {
    const dark = token.colorBgLayout === "#0f0f0f";
    return {
        background: dark ? "#404040" : "#171717",
        borderColor: dark ? "#525252" : "#171717",
        color: "#ffffff",
    };
}
