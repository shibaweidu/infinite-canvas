"use client";

import { Menu, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AnnouncementsDialog } from "@/components/dialogs/announcements-dialog";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { navigationTools } from "@/constant/navigation-tools";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/use-config-store";

type RuntimeNavItem = {
    id: string;
    label: string;
    path: string;
    enabled: boolean;
    sort: number;
};

export function AppTopNav() {
    const pathname = usePathname();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [announcementsOpen, setAnnouncementsOpen] = useState(false);
    const site = useConfigStore((state) => state.publicSettings?.site);
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const navItems = resolveNavItems(site?.navigation);
    const activePath = navItems.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))?.path;
    const mainNavItems = navItems.filter((item) => item.id !== "announcements" && item.path !== "/announcements");
    const announcementItem = navItems.find((item) => item.id === "announcements" || item.path === "/announcements");
    const logoUrl = site?.logoUrl || "/logo.svg";
    const siteName = site?.name || "无限画布";
    const slogan = site?.slogan || "";

    return (
        <>
            {!hideHeader ? (
                <header className="sticky top-0 z-20 h-[76px] shrink-0 border-b border-black/10 bg-background/80 backdrop-blur-2xl dark:border-white/10 dark:bg-[#050505]/[0.78]">
                    <div className="flex h-full w-full items-center justify-between gap-5 px-5 lg:px-7">
                        <div className="flex min-w-0 shrink-0 items-center">
                            <Link href="/" className="flex h-full shrink-0 cursor-pointer items-center gap-2.5 text-left text-sm font-semibold leading-none tracking-tight text-stone-950 transition hover:text-stone-600 dark:text-stone-100 dark:hover:text-stone-300">
                                <img src={logoUrl} alt="" className="size-6 shrink-0 object-contain" />
                                <span className="inline-flex min-w-0 items-baseline gap-2 text-left">
                                    <span className="max-w-32 truncate text-base font-medium">{siteName}</span>
                                    {slogan ? <span className="max-w-44 truncate text-xs font-normal leading-none text-stone-500 dark:text-stone-400">{slogan}</span> : null}
                                </span>
                            </Link>

                            <button
                                type="button"
                                className="ml-3 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center text-stone-600 transition hover:text-stone-950 md:hidden dark:text-stone-300 dark:hover:text-white"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label="打开导航菜单"
                                title="导航菜单"
                            >
                                <Menu className="size-5" />
                            </button>
                        </div>

                        <nav
                            className={cn(
                                "hide-scrollbar mx-2 hidden min-w-0 max-w-[760px] flex-1 items-center justify-center overflow-x-auto rounded-full border px-2 py-2 md:flex",
                                "border-black/10 bg-white/[0.62] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur-2xl",
                                "dark:border-white/[0.14] dark:bg-black/[0.34] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(255,255,255,0.06),0_24px_70px_rgba(0,0,0,0.42)]",
                            )}
                            aria-label="主导航"
                        >
                            <div className="mr-1 h-6 w-px shrink-0 bg-black/10 dark:bg-white/16" />
                            <div className="flex min-w-max items-center gap-1.5">
                                {mainNavItems.map((tool) => (
                                    <NavItem key={tool.id} item={tool} active={tool.path === activePath} onAnnouncementsClick={() => setAnnouncementsOpen(true)} />
                                ))}
                            </div>
                        </nav>

                        <div className="my-auto flex h-9 min-w-0 shrink-0 items-center justify-end gap-4 justify-self-end whitespace-nowrap">
                            {announcementItem ? (
                                <NavItem item={announcementItem} active={announcementItem.path === activePath} compact onAnnouncementsClick={() => setAnnouncementsOpen(true)} />
                            ) : null}
                            <UserStatusActions />
                        </div>
                    </div>
                </header>
            ) : null}

            <MobileNavDrawer open={mobileNavOpen} activePath={activePath} navItems={navItems} onClose={() => setMobileNavOpen(false)} onAnnouncementsClick={() => setAnnouncementsOpen(true)} />
            <AppConfigModal />
            <AnnouncementsDialog open={announcementsOpen} onClose={() => setAnnouncementsOpen(false)} />
        </>
    );
}

function NavItem({ item, active, compact = false, onAnnouncementsClick }: { item: { id: string; label: string; path: string; icon: LucideIcon }; active: boolean; compact?: boolean; onAnnouncementsClick: () => void }) {
    const Icon = item.icon;
    const className = cn(
        "group inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full text-[15px] leading-none transition duration-200",
        compact ? "h-9 px-3.5" : "h-11 px-5",
        active
            ? "border border-black/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(226,232,240,0.86))] font-semibold text-stone-950 shadow-[inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(15,23,42,0.10),0_10px_26px_rgba(15,23,42,0.18)] dark:border-white/[0.22] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.10))] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.55),0_16px_42px_rgba(0,0,0,0.52),0_0_28px_rgba(255,255,255,0.08)]"
            : "text-stone-500 hover:bg-black/[0.035] hover:text-stone-950 dark:text-white/[0.52] dark:hover:bg-white/[0.07] dark:hover:text-white/[0.86]",
    );
    const content = (
        <>
            <Icon className="size-[18px] transition group-hover:scale-[1.03]" strokeWidth={1.85} />
            <span className="truncate whitespace-nowrap">{item.label}</span>
        </>
    );

    if (item.id === "announcements") {
        return (
            <button type="button" onClick={onAnnouncementsClick} className={className}>
                {content}
            </button>
        );
    }
    return (
        <Link href={item.path} className={className}>
            {content}
        </Link>
    );
}

function resolveNavItems(items?: RuntimeNavItem[]): Array<{ id: string; label: string; path: string; icon: LucideIcon }> {
    const fallback = navigationTools.map((item, index) => ({ ...item, id: item.slug, path: `/${item.slug}`, enabled: true, sort: (index + 1) * 10 }));
    const source = items === undefined ? fallback : items;
    return source
        .filter((item) => item.enabled && item.label && item.path)
        .sort((a, b) => a.sort - b.sort)
        .map((item) => {
            const path = normalizePath(item.path);
            const slug = path.split("/").filter(Boolean)[0];
            const matched = navigationTools.find((tool) => tool.slug === slug);
            return { id: item.id || path, label: item.label, path, icon: matched?.icon || Menu };
        });
}

function normalizePath(path: string) {
    if (path.startsWith("/") || path.startsWith("http://") || path.startsWith("https://")) return path;
    return `/${path}`;
}
