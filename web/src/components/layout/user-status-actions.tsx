"use client";

import type { CSSProperties, RefObject } from "react";
import { useEffect, useState } from "react";
import { Avatar, Dropdown, Tooltip } from "antd";
import { Bell, Keyboard, LogOut, Settings2, Shield, UserRound, WalletCards } from "lucide-react";
import type { ItemType } from "antd/es/menu/interface";
import Link from "next/link";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { AccountDialog } from "@/components/dialogs/account-dialog";
import { AnnouncementsDialog } from "@/components/dialogs/announcements-dialog";
import { CreditSymbol } from "@/constant/credits";
import { canvasThemes } from "@/lib/canvas-theme";
import { fetchAccountSummary } from "@/services/api/auth";
import { useConfigStore } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";

type UserStatusActionsProps = {
    showConfig?: boolean;
    variant?: "default" | "canvas";
    onOpenShortcuts?: () => void;
    accountOpen?: boolean;
    onAccountOpenChange?: (open: boolean) => void;
    accountRef?: RefObject<HTMLDivElement | null>;
    getPopupContainer?: (node: HTMLElement) => HTMLElement;
};

export function UserStatusActions({ showConfig = true, variant = "default", onOpenShortcuts, accountOpen, onAccountOpenChange, accountRef, getPopupContainer }: UserStatusActionsProps) {
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const user = useUserStore((state) => state.user);
    const token = useUserStore((state) => state.token);
    const logout = useUserStore((state) => state.clearSession);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const [accountDialogOpen, setAccountDialogOpen] = useState(false);
    const [announcementsOpen, setAnnouncementsOpen] = useState(false);
    const [initialTab, setInitialTab] = useState<"profile" | "plans" | "packages" | "recharge" | "consume">("profile");
    const [billingVisible, setBillingVisible] = useState({ plans: false, packages: false });
    const canvasTheme = canvasThemes[theme];
    const userName = user?.displayName || user?.username || "";
    const credits = user?.credits ?? 0;
    const avatarUrl = user?.avatarUrl?.trim();
    const avatarText = (userName.trim()[0] || "U").toUpperCase();
    const naturalIconClass = "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center text-stone-600 transition hover:text-stone-950 dark:text-stone-300 dark:hover:text-white [&_svg]:size-4";
    const iconStyle: CSSProperties | undefined = variant === "canvas" ? { color: canvasTheme.node.text } : undefined;
    const avatarStyle: CSSProperties | undefined = variant === "canvas" ? { borderColor: canvasTheme.toolbar.border, color: canvasTheme.node.text, background: "transparent" } : undefined;
    const menuItems: ItemType[] = [
        { key: "user", disabled: true, label: <span className="font-medium text-current">{userName}</span> },
        { key: "account", icon: <UserRound className="size-4" />, label: "个人中心", onClick: () => { setInitialTab("profile"); setAccountDialogOpen(true); } },
        { key: "announcements", icon: <Bell className="size-4" />, label: "公告中心", onClick: () => setAnnouncementsOpen(true) },
        ...(user?.role === "admin" ? [{ key: "admin", icon: <Shield className="size-4" />, label: <Link href="/admin">管理后台</Link> }] : []),
        ...(onOpenShortcuts ? [{ key: "shortcuts", icon: <Keyboard className="size-4" />, label: "快捷键", onClick: onOpenShortcuts }] : []),
        { type: "divider" },
        { key: "logout", icon: <LogOut className="size-4" />, label: "退出登录", onClick: logout },
    ];

    useEffect(() => {
        if (!token || !user) {
            setBillingVisible({ plans: false, packages: false });
            return;
        }
        fetchAccountSummary(token)
            .then((summary) => setBillingVisible({ plans: Boolean(summary.plans?.length), packages: Boolean(summary.creditPackages?.length) }))
            .catch(() => setBillingVisible({ plans: false, packages: false }));
    }, [token, user]);

    return (
        <>
            <div className="inline-flex shrink-0 items-center gap-2">
                {showConfig ? (
                    <button type="button" className={naturalIconClass} style={iconStyle} onClick={() => openConfigDialog(false)} aria-label="配置" title="配置">
                        <Settings2 className="size-4" />
                    </button>
                ) : null}
                <AnimatedThemeToggler theme={theme} onThemeChange={setTheme} className={naturalIconClass} style={iconStyle} aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"} title={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"} />

                {/* Canvas 特殊布局 */}
                {variant === "canvas" && user ? (
                    <Tooltip title="当前积分余额" placement="bottom">
                        <div className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 px-1.5 text-xs font-medium tabular-nums opacity-75 transition hover:opacity-100" style={{ color: canvasTheme.node.text }}>
                            <CreditSymbol className="text-sm leading-none" />
                            <span>{credits.toLocaleString()}</span>
                        </div>
                    </Tooltip>
                ) : null}

                {/* 默认布局 - 订阅套餐按钮 */}
                {variant === "default" && user && billingVisible.plans ? (
                    <button
                        type="button"
                        onClick={() => {
                            setAccountDialogOpen(true);
                            setTimeout(() => {
                                setInitialTab("plans");
                            }, 0);
                        }}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:bg-stone-50 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
                        style={iconStyle}
                    >
                        <WalletCards className="size-3.5" />
                        <span>订阅套餐</span>
                    </button>
                ) : null}

                {/* 积分显示（可点击） */}
                {variant === "default" && user && billingVisible.packages ? (
                    <button
                        type="button"
                        onClick={() => {
                            setAccountDialogOpen(true);
                            setTimeout(() => {
                                setInitialTab("packages");
                            }, 0);
                        }}
                        className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium transition hover:bg-stone-50 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800"
                        style={iconStyle}
                        title="充值积分"
                    >
                        <CreditSymbol className="text-sm text-stone-600 dark:text-stone-400" />
                        <span className="font-semibold text-stone-900 dark:text-stone-100">{credits.toLocaleString()}</span>
                    </button>
                ) : null}

                {!user && onOpenShortcuts ? (
                    <button type="button" className={naturalIconClass} style={iconStyle} onClick={onOpenShortcuts} aria-label="快捷键" title="快捷键">
                        <Keyboard className="size-4" />
                    </button>
                ) : null}
                {!user ? (
                    <Link href="/login" className="cursor-pointer px-1.5 text-sm font-medium text-stone-600 underline-offset-4 transition hover:text-stone-950 hover:underline dark:text-stone-300 dark:hover:text-stone-100" style={iconStyle}>
                        登录
                    </Link>
                ) : null}
                {user ? (
                    <div ref={accountRef}>
                        <Dropdown open={accountOpen} onOpenChange={onAccountOpenChange} trigger={["click"]} placement="bottomRight" getPopupContainer={getPopupContainer} styles={{ root: { minWidth: 150 } }} menu={{ items: menuItems }}>
                            <button type="button" className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent p-0 text-[0] leading-[0] transition" aria-label="账户菜单">
                                <Avatar
                                    size={28}
                                    src={avatarUrl ? <img src={avatarUrl} alt={userName} referrerPolicy="no-referrer" /> : undefined}
                                    alt={userName}
                                    className="!flex !items-center !justify-center border border-stone-300 bg-white text-[11px] font-semibold text-stone-800 transition hover:border-stone-400 hover:shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-600"
                                    style={avatarStyle}
                                >
                                    {avatarText}
                                </Avatar>
                            </button>
                        </Dropdown>
                    </div>
                ) : null}
            </div>

            <AccountDialog open={accountDialogOpen} onClose={() => setAccountDialogOpen(false)} initialTab={initialTab} />
            <AnnouncementsDialog open={announcementsOpen} onClose={() => setAnnouncementsOpen(false)} />
        </>
    );
}
