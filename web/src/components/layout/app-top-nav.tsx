"use client";

import { Menu, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AppConfigModal } from "@/components/layout/app-config-modal";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { AnnouncementsDialog } from "@/components/dialogs/announcements-dialog";
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
    const announcementsIndex = navItems.findIndex((item) => item.id === "announcements" || item.path === "/announcements");
    const leftNavItems = announcementsIndex >= 0 ? navItems.slice(0, announcementsIndex) : navItems;
    const rightNavItems = announcementsIndex >= 0 ? navItems.slice(announcementsIndex) : [];
    const logoUrl = site?.logoUrl || "/logo.svg";
    const siteName = site?.name || "无限画布";
    const slogan = site?.slogan || "";

    return (
        <>
            {!hideHeader ? (
                <header className="sticky top-0 z-20 h-16 shrink-0 border-b border-stone-200 bg-background/90 backdrop-blur-xl dark:border-stone-800">
                    <div className="flex h-full w-full items-stretch justify-between gap-5 px-6">
                        <div className="flex min-w-0 flex-1 items-center">
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

                            <nav className="hide-scrollbar ml-8 hidden h-16 min-w-0 items-center gap-7 overflow-x-auto md:flex">
                                {leftNavItems.map((tool) => {
                                    const Icon = tool.icon;
                                    const active = tool.path === activePath;

                                    return (
                                        <Link
                                            key={tool.id}
                                            href={tool.path}
                                            className={cn(
                                                "relative flex h-16 shrink-0 cursor-pointer items-center gap-2 text-sm leading-6 transition after:absolute after:inset-x-0 after:bottom-0 after:h-px",
                                                active
                                                    ? "font-medium text-stone-950 after:bg-stone-950 dark:text-stone-100 dark:after:bg-stone-100"
                                                    : "text-stone-500 after:bg-transparent hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100",
                                            )}
                                        >
                                            <Icon className="size-4" />
                                            <span className="truncate">{tool.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="my-auto flex h-9 min-w-0 shrink-0 items-center justify-end gap-5 justify-self-end whitespace-nowrap">
                            <nav className="hidden h-9 items-center gap-5 md:flex">
                                {rightNavItems.map((tool) => {
                                    const Icon = tool.icon;
                                    const active = tool.path === activePath;
                                    const isAnnouncements = tool.id === "announcements";
                                    if (isAnnouncements) {
                                        return (
                                            <button
                                                key={tool.id}
                                                type="button"
                                                onClick={() => setAnnouncementsOpen(true)}
                                                className={cn(
                                                    "inline-flex h-9 cursor-pointer items-center gap-2 text-sm transition",
                                                    active ? "font-medium text-stone-950 dark:text-stone-100" : "text-stone-500 hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100",
                                                )}
                                            >
                                                <Icon className="size-4" />
                                                <span className="truncate">{tool.label}</span>
                                            </button>
                                        );
                                    }
                                    return (
                                        <Link
                                            key={tool.id}
                                            href={tool.path}
                                            className={cn(
                                                "inline-flex h-9 cursor-pointer items-center gap-2 text-sm transition",
                                                active ? "font-medium text-stone-950 dark:text-stone-100" : "text-stone-500 hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100",
                                            )}
                                        >
                                            <Icon className="size-4" />
                                            <span className="truncate">{tool.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
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
