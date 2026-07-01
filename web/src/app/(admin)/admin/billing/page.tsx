"use client";

import { App, Button, Drawer, Flex, Form, Input, InputNumber, Space, Switch, Table, theme } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { CSSProperties } from "react";
import { CreditCard, Edit, Gift, Plus, RefreshCw, Trash2, WalletCards } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
    deleteAdminCreditPackage,
    deleteAdminSubscriptionPlan,
    fetchAdminCreditPackages,
    fetchAdminSubscriptionPlans,
    saveAdminCreditPackage,
    saveAdminSubscriptionPlan,
    type AdminBillingBenefit,
    type AdminCreditPackage,
    type AdminSubscriptionPlan,
} from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

type BillingTab = "plans" | "packages";
type Editing =
    | { kind: "plan"; item: Partial<AdminSubscriptionPlan> }
    | { kind: "package"; item: Partial<AdminCreditPackage> }
    | null;
type BillingFormValues = (Partial<AdminSubscriptionPlan> & Partial<AdminCreditPackage>) & { benefitsText?: string };

const navItems: Array<{ key: BillingTab; label: string; icon: ReactNode }> = [
    { key: "plans", label: "订阅套餐", icon: <WalletCards className="size-4" /> },
    { key: "packages", label: "积分充值", icon: <CreditCard className="size-4" /> },
];

const defaultPlan: Partial<AdminSubscriptionPlan> = { enabled: true, sort: 100, price: 0, originalPrice: 0, credits: 0, durationDays: 30, priceCycle: "每月", buttonText: "订阅套餐", creditLabel: "积分每月" };
const defaultPackage: Partial<AdminCreditPackage> = { enabled: true, sort: 100, price: 0, originalPrice: 0, credits: 0, bonusCredits: 0, priceCycle: "一次性", buttonText: "确认支付", creditLabel: "积分到账" };

export default function AdminBillingPage() {
    const { token: antToken } = theme.useToken();
    const { message, modal } = App.useApp();
    const token = useUserStore((state) => state.token);
    const [activeTab, setActiveTab] = useState<BillingTab>("plans");
    const [plans, setPlans] = useState<AdminSubscriptionPlan[]>([]);
    const [packages, setPackages] = useState<AdminCreditPackage[]>([]);
    const [editing, setEditing] = useState<Editing>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const loadItems = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const [nextPlans, nextPackages] = await Promise.all([fetchAdminSubscriptionPlans(token), fetchAdminCreditPackages(token)]);
            setPlans(nextPlans || []);
            setPackages(nextPackages || []);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "配置读取失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadItems();
    }, [token]);

    const openEditor = (kind: "plan" | "package", item?: AdminSubscriptionPlan | AdminCreditPackage) => {
        const next = item || (kind === "plan" ? defaultPlan : defaultPackage);
        form.resetFields();
        setEditing({ kind, item: next });
        form.setFieldsValue({ ...next, benefitsText: stringifyBenefits(next.benefits) });
    };

    const closeEditor = () => {
        setEditing(null);
        form.resetFields();
    };

    const saveItem = async () => {
        if (!token || !editing) return;
        const values = await form.validateFields() as BillingFormValues;
        setSaving(true);
        try {
            if (editing.kind === "plan") await saveAdminSubscriptionPlan(token, buildPlanPayload(editing.item as Partial<AdminSubscriptionPlan>, values));
            else await saveAdminCreditPackage(token, buildPackagePayload(editing.item as Partial<AdminCreditPackage>, values));
            message.success("配置已保存");
            closeEditor();
            await loadItems();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const removeItem = (kind: "plan" | "package", id: string) => {
        if (!token) return;
        modal.confirm({
            title: "删除配置",
            content: "删除后前台将不再展示该项。",
            okText: "删除",
            cancelText: "取消",
            onOk: async () => {
                if (kind === "plan") await deleteAdminSubscriptionPlan(token, id);
                else await deleteAdminCreditPackage(token, id);
                message.success("已删除");
                await loadItems();
            },
        });
    };

    const toggleEnabled = async (kind: "plan" | "package", item: AdminSubscriptionPlan | AdminCreditPackage, enabled: boolean) => {
        if (!token) return;
        try {
            if (kind === "plan") await saveAdminSubscriptionPlan(token, { ...(item as AdminSubscriptionPlan), enabled });
            else await saveAdminCreditPackage(token, { ...(item as AdminCreditPackage), enabled });
            message.success(enabled ? "已启用，前台会展示" : "已关闭，前台不再展示");
            await loadItems();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "状态更新失败");
        }
    };

    const planColumns: ColumnsType<AdminSubscriptionPlan> = [
        { title: "套餐", dataIndex: "name" },
        { title: "说明", dataIndex: "description", ellipsis: true },
        { title: "价格", dataIndex: "price", width: 110, render: priceText },
        { title: "原价", dataIndex: "originalPrice", width: 110, render: priceText },
        { title: "积分", dataIndex: "credits", width: 100 },
        { title: "展示周期", dataIndex: "priceCycle", width: 100, render: (value) => value || "-" },
        { title: "权益", dataIndex: "benefits", width: 80, render: (value: AdminBillingBenefit[]) => `${value?.length || 0} 条` },
        { title: "周期", dataIndex: "durationDays", width: 100, render: (value) => `${value || 0} 天` },
        { title: "前台显示", dataIndex: "enabled", width: 120, render: (value, item) => <Switch checked={value} checkedChildren="启用" unCheckedChildren="关闭" onChange={(checked) => void toggleEnabled("plan", item, checked)} /> },
        { title: "排序", dataIndex: "sort", width: 90 },
        { title: "操作", width: 130, render: (_, item) => <RowActions onEdit={() => openEditor("plan", item)} onDelete={() => removeItem("plan", item.id)} /> },
    ];
    const packageColumns: ColumnsType<AdminCreditPackage> = [
        { title: "充值包", dataIndex: "name" },
        { title: "说明", dataIndex: "description", ellipsis: true },
        { title: "充值金额", dataIndex: "price", width: 110, render: priceText },
        { title: "获得积分", dataIndex: "credits", width: 110 },
        { title: "折扣额外赠送", dataIndex: "bonusCredits", width: 130 },
        { title: "前台显示", dataIndex: "enabled", width: 120, render: (value, item) => <Switch checked={value} checkedChildren="启用" unCheckedChildren="关闭" onChange={(checked) => void toggleEnabled("package", item, checked)} /> },
        { title: "排序", dataIndex: "sort", width: 90 },
        { title: "操作", width: 130, render: (_, item) => <RowActions onEdit={() => openEditor("package", item)} onDelete={() => removeItem("package", item.id)} /> },
    ];

    return (
        <main style={{ minHeight: "100%", padding: 24, background: antToken.colorBgLayout }}>
            <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 20 }}>
                <aside style={{ height: "fit-content", border: `1px solid ${antToken.colorBorder}`, borderRadius: 12, background: antToken.colorBgContainer, padding: 8 }}>
                    <div style={{ padding: "12px 12px 10px" }}>
                        <div style={{ color: antToken.colorTextTertiary, fontSize: 12 }}>套餐与积分</div>
                        <div style={{ marginTop: 4, color: antToken.colorText, fontSize: 18, fontWeight: 600 }}>计费配置</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                        {navItems.map((item) => {
                            const active = item.key === activeTab;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setActiveTab(item.key)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        width: "100%",
                                        height: 40,
                                        padding: "0 12px",
                                        border: 0,
                                        borderRadius: 8,
                                        background: active ? "#171717" : "transparent",
                                        color: active ? "#FFFFFF" : antToken.colorTextSecondary,
                                        cursor: "pointer",
                                        textAlign: "left",
                                        fontWeight: active ? 500 : 400,
                                        transition: "all 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.background = antToken.colorFillTertiary;
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.background = "transparent";
                                        }
                                    }}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <section style={{ minWidth: 0 }}>
                    <Flex align="flex-start" justify="space-between" gap={12} wrap style={{ marginBottom: 16 }}>
                        <div>
                            <h1 style={{ margin: 0, color: "var(--app-text-primary)", fontSize: 22 }}>{activeTab === "plans" ? "订阅套餐" : "积分充值"}</h1>
                            <p style={{ margin: "8px 0 0", color: "var(--app-text-muted)" }}>
                                配置前台展示的{activeTab === "plans" ? "订阅套餐，包含标题、价格、月积分、积分折扣和权益描述" : "积分充值金额、获得积分和折扣额外赠送规则"}。
                            </p>
                        </div>
                        <Space>
                            <Button icon={<RefreshCw className="size-4" />} onClick={() => void loadItems()} loading={loading}>
                                刷新
                            </Button>
                            <Button
                                type="primary"
                                icon={<Plus className="size-4" />}
                                onClick={() => openEditor(activeTab === "plans" ? "plan" : "package")}
                                style={primaryButtonStyle(antToken)}
                            >
                                {activeTab === "plans" ? "新增套餐" : "新增充值包"}
                            </Button>
                        </Space>
                    </Flex>
                    {activeTab === "plans" ? <Table rowKey="id" loading={loading} columns={planColumns} dataSource={plans} pagination={false} /> : null}
                    {activeTab === "packages" ? <Table rowKey="id" loading={loading} columns={packageColumns} dataSource={packages} pagination={false} /> : null}
                </section>
            </div>

            <Drawer
                title={editing?.kind === "plan" ? "订阅套餐配置" : "积分充值包配置"}
                open={!!editing}
                width={620}
                onClose={closeEditor}
                extra={
                    <Button type="primary" loading={saving} onClick={() => void saveItem()} style={primaryButtonStyle(antToken)}>
                        保存
                    </Button>
                }
            >
                <Form form={form} layout="vertical" preserve={false}>
                    <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
                        <Input size="large" placeholder="例如：基础版、专业版、企业版" />
                    </Form.Item>
                    <Form.Item name="description" label="权益描述" rules={[{ required: true, message: "请输入权益描述" }]}>
                        <Input.TextArea rows={4} placeholder="描述套餐权益和特色，支持多行文本" />
                    </Form.Item>
                    <Space size={16} align="start" style={{ width: "100%" }}>
                        <Form.Item name="price" label={editing?.kind === "plan" ? "价格（分）" : "充值金额（分）"} rules={[{ required: true, message: "请输入价格" }]}>
                            <InputNumber min={0} style={{ width: 150 }} placeholder="单位：分" />
                        </Form.Item>
                        {editing?.kind === "plan" ? (
                            <Form.Item name="originalPrice" label="前台原价（分）">
                                <InputNumber min={0} style={{ width: 150 }} placeholder="不填则不显示" />
                            </Form.Item>
                        ) : null}
                        <Form.Item name="credits" label={editing?.kind === "plan" ? "月积分" : "获得积分"} rules={[{ required: true, message: "请输入积分" }]}>
                            <InputNumber min={0} style={{ width: 150 }} />
                        </Form.Item>
                    </Space>
                    <Space size={16} align="start" style={{ width: "100%" }}>
                        {editing?.kind === "plan" ? (
                            <Form.Item name="durationDays" label="有效天数" rules={[{ required: true, message: "请输入天数" }]}>
                                <InputNumber min={0} style={{ width: 150 }} />
                            </Form.Item>
                        ) : (
                            <Form.Item name="bonusCredits" label="折扣额外赠送">
                                <InputNumber min={0} style={{ width: 150 }} placeholder="按金额额外赠送" />
                            </Form.Item>
                        )}
                        {editing?.kind === "plan" ? (
                            <>
                                <Form.Item name="priceCycle" label="前台价格周期">
                                    <Input style={{ width: 150 }} placeholder="例如：每月" />
                                </Form.Item>
                                <Form.Item name="buttonText" label="按钮文案">
                                    <Input style={{ width: 150 }} placeholder="订阅套餐" />
                                </Form.Item>
                            </>
                        ) : null}
                    </Space>
                    {editing?.kind === "package" && (
                        <div style={{ marginBottom: 16, padding: 12, background: "#f5f5f5", borderRadius: 8, fontSize: 13, color: "#737373" }}>
                            <Gift className="size-4 inline mr-1" />
                            到账积分 = 获得积分 + 折扣额外赠送；不同充值金额可配置不同赠送额度。
                        </div>
                    )}
                    {editing?.kind === "plan" ? (
                        <>
                            <Space size={16} align="start" style={{ width: "100%" }}>
                                <Form.Item name="creditLabel" label="积分模块文案">
                                    <Input style={{ width: 210 }} placeholder="积分每月" />
                                </Form.Item>
                                <Form.Item name="creditRateText" label="积分换算说明">
                                    <Input style={{ width: 300 }} placeholder="例如：换算¥10=177积分" />
                                </Form.Item>
                            </Space>
                            <Form.Item
                                name="benefitsText"
                                label="前台权益列表"
                                extra="每行一条，格式：权益文字 | 标签。标签可不填，例如：无限画布项目 | 专属通道"
                            >
                                <Input.TextArea rows={6} placeholder={"无限画布项目 | 专属通道\n图片生成 8 折 | 生成 8 折\n商用授权"} />
                            </Form.Item>
                        </>
                    ) : null}
                    <Space size={16} align="start">
                        <Form.Item name="enabled" label="启用" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                        <Form.Item name="sort" label="排序">
                            <InputNumber min={0} placeholder="数值越小越靠前" />
                        </Form.Item>
                    </Space>
                </Form>
            </Drawer>
        </main>
    );
}

function priceText(value: number) {
    return `¥${((value || 0) / 100).toFixed(2)}`;
}

function stringifyBenefits(items?: AdminBillingBenefit[]) {
    return (items || []).map((item) => `${item.text}${item.tag ? ` | ${item.tag}` : ""}`).join("\n");
}

function parseBenefits(value?: string) {
    return (value || "")
        .split("\n")
        .map((line) => {
            const [text, ...tagParts] = line.split("|");
            return { text: text.trim(), tag: tagParts.join("|").trim() };
        })
        .filter((item) => item.text);
}

function buildPlanPayload(item: Partial<AdminSubscriptionPlan>, values: BillingFormValues): Partial<AdminSubscriptionPlan> {
    const benefitsText = values.benefitsText === undefined ? stringifyBenefits(item.benefits) : values.benefitsText;
    return {
        id: item.id,
        name: stringValue(values.name, item.name),
        description: stringValue(values.description, item.description),
        price: numberValue(values.price, item.price),
        originalPrice: numberValue(values.originalPrice, item.originalPrice),
        credits: numberValue(values.credits, item.credits),
        durationDays: numberValue(values.durationDays, item.durationDays),
        priceCycle: stringValue(values.priceCycle, item.priceCycle),
        buttonText: stringValue(values.buttonText, item.buttonText),
        creditLabel: stringValue(values.creditLabel, item.creditLabel),
        creditRateText: stringValue(values.creditRateText, item.creditRateText),
        benefits: parseBenefits(benefitsText),
        enabled: values.enabled ?? item.enabled ?? true,
        sort: numberValue(values.sort, item.sort),
    };
}

function buildPackagePayload(item: Partial<AdminCreditPackage>, values: BillingFormValues): Partial<AdminCreditPackage> {
    return {
        id: item.id,
        name: stringValue(values.name, item.name),
        description: stringValue(values.description, item.description),
        price: numberValue(values.price, item.price),
        credits: numberValue(values.credits, item.credits),
        bonusCredits: numberValue(values.bonusCredits, item.bonusCredits),
        enabled: values.enabled ?? item.enabled ?? true,
        sort: numberValue(values.sort, item.sort),
    };
}

function stringValue(value: unknown, fallback?: string) {
    return typeof value === "string" ? value : fallback || "";
}

function numberValue(value: unknown, fallback?: number) {
    return typeof value === "number" ? value : fallback || 0;
}

function primaryButtonStyle(token: ReturnType<typeof theme.useToken>["token"]): CSSProperties {
    const dark = token.colorBgLayout === "#0f0f0f";
    return {
        background: dark ? "#404040" : "#171717",
        borderColor: dark ? "#525252" : "#171717",
        color: "#ffffff",
    };
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
    return (
        <Space size={4}>
            <Button size="small" icon={<Edit className="size-3.5" />} onClick={onEdit} />
            <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={onDelete} />
        </Space>
    );
}
