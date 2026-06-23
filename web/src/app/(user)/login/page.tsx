"use client";

import { GoogleOutlined, LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Segmented, Space } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { fetchCurrentUser, sendRegisterEmailCode } from "@/services/api/auth";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

type LoginFormValues = {
    username: string;
    email?: string;
    emailCode?: string;
    password: string;
    confirmPassword?: string;
};

// 仅放行站内相对路径，拦截开放重定向。浏览器会忽略 URL 中的 Tab/换行/回车，并把
// //host 或 /\host 解析为协议相对的跨站地址，因此先剥离控制字符，再拒绝 // 与 /\ 前缀。
function safeRedirect(value: string | null): string {
    const cleaned = (value ?? "").replace(/[\t\n\r]/g, "");
    if (!cleaned.startsWith("/") || cleaned.startsWith("//") || cleaned.startsWith("/\\")) {
        return "/";
    }
    return cleaned;
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const { message } = App.useApp();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [form] = Form.useForm<LoginFormValues>();
    const login = useUserStore((state) => state.login);
    const register = useUserStore((state) => state.register);
    const setSession = useUserStore((state) => state.setSession);
    const isLoading = useUserStore((state) => state.isLoading);
    const linuxDoEnabled = useConfigStore((state) => state.publicSettings?.auth?.linuxDo?.enabled === true);
    const googleEnabled = useConfigStore((state) => state.publicSettings?.auth?.google?.enabled === true);
    const allowRegister = useConfigStore((state) => state.publicSettings?.auth?.allowRegister !== false);
    const emailRegister = useConfigStore((state) => state.publicSettings?.auth?.emailRegister);
    const emailRegisterEnabled = emailRegister?.enabled !== false;
    const emailRequired = emailRegister?.emailRequired === true;
    const emailCodeEnabled = emailRegister?.codeEnabled === true;
    const [mode, setMode] = useState<"login" | "register">("login");
    const [codeSeconds, setCodeSeconds] = useState(0);
    const [isSendingCode, setIsSendingCode] = useState(false);
    const emailValue = Form.useWatch("email", form);
    const redirect = safeRedirect(searchParams.get("redirect"));

    useEffect(() => {
        const token = searchParams.get("token");
        const error = searchParams.get("error");
        if (error) message.error(error);
        if (!token) return;
        void fetchCurrentUser(token).then((user) => {
            setSession(token, user);
            message.success("登录成功");
            router.replace(redirect);
            router.refresh();
        });
    }, [message, redirect, router, searchParams, setSession]);

    useEffect(() => {
        if ((!allowRegister || !emailRegisterEnabled) && mode === "register") setMode("login");
    }, [allowRegister, emailRegisterEnabled, mode]);

    useEffect(() => {
        if (codeSeconds <= 0) return;
        const timer = window.setTimeout(() => setCodeSeconds((value) => Math.max(0, value - 1)), 1000);
        return () => window.clearTimeout(timer);
    }, [codeSeconds]);

    const sendEmailCode = async () => {
        const email = String(form.getFieldValue("email") || "").trim();
        if (!email) {
            message.error("请输入邮箱");
            return;
        }
        setIsSendingCode(true);
        try {
            await sendRegisterEmailCode(email);
            setCodeSeconds(60);
            message.success("验证码已发送");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "验证码发送失败");
        } finally {
            setIsSendingCode(false);
        }
    };

    const submit = async (values: LoginFormValues) => {
        try {
            if (mode === "register" && !allowRegister) {
                message.error("当前未开放注册");
                return;
            }
            if (mode === "register" && values.password !== values.confirmPassword) {
                message.error("两次输入的密码不一致");
                return;
            }
            if (mode === "register" && !emailRegisterEnabled) {
                message.error("邮箱注册未开启");
                return;
            }
            if (mode === "register" && emailRequired && !values.email?.trim()) {
                message.error("请输入邮箱");
                return;
            }
            if (mode === "register" && emailCodeEnabled && !values.emailCode?.trim()) {
                message.error("请输入邮箱验证码");
                return;
            }
            const action = mode === "register" ? register : login;
            const user = await action({ username: values.username, email: values.email, emailCode: values.emailCode, password: values.password });
            message.success(mode === "register" ? "注册成功" : "登录成功");
            router.replace(redirect);
            router.refresh();
            if (user.role !== "admin") router.replace("/");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "登录失败");
        }
    };

    return (
        <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 py-10 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.16)_1px,transparent_1px)]">
            <section className="w-full max-w-[420px]">
                <div className="mb-7 text-center">
                    <span
                        className="mx-auto mb-4 block size-12 bg-stone-950 dark:bg-stone-100"
                        style={{
                            mask: "url(/logo.svg) center / contain no-repeat",
                            WebkitMask: "url(/logo.svg) center / contain no-repeat",
                        }}
                        aria-label="无限画布"
                    />
                    <h1 className="text-3xl font-semibold tracking-normal text-stone-950 dark:text-stone-100">账号登录</h1>
                    <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">支持账号密码和第三方登录。</p>
                </div>

                <Form<LoginFormValues> form={form} layout="vertical" size="large" requiredMark={false} onFinish={submit}>
                    <Form.Item>
                        <Segmented
                            block
                            value={mode}
                            onChange={(value) => setMode(value as "login" | "register")}
                            options={allowRegister && emailRegisterEnabled ? [{ label: "登录", value: "login" }, { label: "注册", value: "register" }] : [{ label: "登录", value: "login" }]}
                        />
                    </Form.Item>
                    <Form.Item name="username" label={<span className="font-medium text-stone-800 dark:text-stone-200">{mode === "login" ? "用户名或邮箱" : "用户名"}</span>} rules={[{ required: true, message: mode === "login" ? "请输入用户名或邮箱" : "请输入用户名" }]}>
                        <Input prefix={<UserOutlined />} autoComplete="username" />
                    </Form.Item>
                    {mode === "register" ? (
                        <Form.Item name="email" label={<span className="font-medium text-stone-800 dark:text-stone-200">邮箱</span>} rules={emailRequired || emailCodeEnabled ? [{ required: true, message: "请输入邮箱" }, { type: "email", message: "邮箱格式不正确" }] : [{ type: "email", message: "邮箱格式不正确" }]}>
                            <Input prefix={<MailOutlined />} autoComplete="email" />
                        </Form.Item>
                    ) : null}
                    {mode === "register" && emailCodeEnabled ? (
                        <Form.Item name="emailCode" label={<span className="font-medium text-stone-800 dark:text-stone-200">邮箱验证码</span>} rules={[{ required: true, message: "请输入邮箱验证码" }]}>
                            <Space.Compact style={{ width: "100%" }}>
                                <Input maxLength={6} inputMode="numeric" autoComplete="one-time-code" />
                                <Button loading={isSendingCode} disabled={codeSeconds > 0 || !String(emailValue || "").trim()} onClick={() => void sendEmailCode()}>
                                    {codeSeconds > 0 ? `${codeSeconds}s` : "发送验证码"}
                                </Button>
                            </Space.Compact>
                        </Form.Item>
                    ) : null}
                    <Form.Item name="password" label={<span className="font-medium text-stone-800 dark:text-stone-200">密码</span>} rules={[{ required: true, message: "请输入密码" }]}>
                        <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
                    </Form.Item>
                    {mode === "register" ? (
                        <Form.Item name="confirmPassword" label={<span className="font-medium text-stone-800 dark:text-stone-200">确认密码</span>} rules={[{ required: true, message: "请再次输入密码" }]}>
                            <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                        </Form.Item>
                    ) : null}
                    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                        <Button block type="primary" htmlType="submit" loading={isLoading}>
                            {mode === "register" ? "注册" : "登录"}
                        </Button>
                        {linuxDoEnabled ? (
                            <Button block href={`/api/auth/linux-do/authorize?redirect=${encodeURIComponent(redirect)}`} icon={<img src="/icons/linuxdo.svg" alt="" width={18} height={18} />}>
                                使用 Linux.do 登录
                            </Button>
                        ) : null}
                        {googleEnabled ? (
                            <Button block href={`/api/auth/google/authorize?redirect=${encodeURIComponent(redirect)}`} icon={<GoogleOutlined />}>
                                使用 Google 登录
                            </Button>
                        ) : null}
                    </Space>
                </Form>
            </section>
        </main>
    );
}
