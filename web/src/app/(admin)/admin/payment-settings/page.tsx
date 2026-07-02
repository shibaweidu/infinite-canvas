"use client";

import { App, Button, Card, Form, Input, Select, Space, Switch, Typography, theme } from "antd";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchAdminPaymentSettings, saveAdminPaymentSettings, type AdminPaymentSettings } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

type PaymentSettingsForm = Partial<AdminPaymentSettings>;

export default function AdminPaymentSettingsPage() {
    const { token: antToken } = theme.useToken();
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const [form] = Form.useForm<PaymentSettingsForm>();
    const [settings, setSettings] = useState<AdminPaymentSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadSettings = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const next = await fetchAdminPaymentSettings(token);
            setSettings(next);
            form.setFieldsValue({ ...next, key: "" });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "支付设置读取失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSettings();
    }, [token]);

    const saveSettings = async () => {
        if (!token) return;
        const values = await form.validateFields();
        setSaving(true);
        try {
            const saved = await saveAdminPaymentSettings(token, { ...settings, ...values, provider: "epay" });
            setSettings(saved);
            form.setFieldsValue({ ...saved, key: "" });
            message.success("支付设置已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "支付设置保存失败");
        } finally {
            setSaving(false);
        }
    };

    return (
        <main style={{ minHeight: "100%", padding: 24, background: antToken.colorBgLayout }}>
            <div style={{ maxWidth: 920 }}>
                <Space direction="vertical" size={6} style={{ marginBottom: 20 }}>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                        支付设置
                    </Typography.Title>
                    <Typography.Text type="secondary">配置易支付商户信息，前台订阅套餐和积分充值会使用这里的支付通道。</Typography.Text>
                </Space>

                <Card loading={loading} styles={{ body: { padding: 24 } }}>
                    <Form form={form} layout="vertical" initialValues={{ enabled: false, provider: "epay", payType: "alipay" }}>
                        <Form.Item name="enabled" label="启用支付" valuePropName="checked">
                            <Switch checkedChildren="启用" unCheckedChildren="关闭" />
                        </Form.Item>
                        <Form.Item name="gatewayUrl" label="易支付网关" rules={[{ required: true, message: "请输入易支付网关" }]} extra="例如：https://pay.example.com，不需要填写 submit.php">
                            <Input size="large" placeholder="https://pay.example.com" />
                        </Form.Item>
                        <Space size={16} align="start" style={{ width: "100%" }} wrap>
                            <Form.Item name="pid" label="商户 ID" rules={[{ required: true, message: "请输入商户 ID" }]}>
                                <Input style={{ width: 260 }} size="large" placeholder="易支付 PID" />
                            </Form.Item>
                            <Form.Item name="payType" label="默认支付方式" rules={[{ required: true, message: "请选择支付方式" }]}>
                                <Select
                                    size="large"
                                    style={{ width: 180 }}
                                    options={[
                                        { label: "支付宝", value: "alipay" },
                                        { label: "微信支付", value: "wxpay" },
                                        { label: "QQ 钱包", value: "qqpay" },
                                    ]}
                                />
                            </Form.Item>
                        </Space>
                        <Form.Item name="key" label="商户密钥" extra={settings?.hasKey ? "已保存密钥；留空会继续使用原密钥。" : "首次启用支付时必须填写商户密钥。"}>
                            <Input.Password size="large" placeholder={settings?.hasKey ? "留空表示不修改" : "请输入易支付商户密钥"} autoComplete="new-password" />
                        </Form.Item>
                        <Form.Item name="siteName" label="收银台站点名称">
                            <Input size="large" placeholder="默认可留空" />
                        </Form.Item>
                        <Form.Item name="notifyUrl" label="异步通知地址" extra="留空时自动使用当前站点 /api/payment/epay/notify">
                            <Input size="large" placeholder="https://your-domain.com/api/payment/epay/notify" />
                        </Form.Item>
                        <Form.Item name="returnUrl" label="同步返回地址" extra="留空时自动返回当前站点的个人中心支付结果页。">
                            <Input size="large" placeholder="https://your-domain.com/api/payment/epay/return" />
                        </Form.Item>
                        <Button type="primary" icon={<Save className="size-4" />} loading={saving} onClick={() => void saveSettings()} style={{ background: "#171717", borderColor: "#171717", color: "#ffffff" }}>
                            保存支付设置
                        </Button>
                    </Form>
                </Card>
            </div>
        </main>
    );
}
