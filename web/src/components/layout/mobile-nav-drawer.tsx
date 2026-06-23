"use client";

import { Drawer } from "antd";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type MobileNavItem = {
    id: string;
    label: string;
    path: string;
    icon: LucideIcon;
};

type MobileNavDrawerProps = {
    open: boolean;
    activePath?: string;
    navItems: MobileNavItem[];
    onClose: () => void;
};

export function MobileNavDrawer({ open, activePath, navItems, onClose }: MobileNavDrawerProps) {
    return (
        <Drawer title="导航" placement="left" size={280} open={open} onClose={onClose} className="md:hidden">
            <div className="space-y-1">
                {navItems.map((tool) => {
                    const Icon = tool.icon;
                    const active = tool.path === activePath;
                    return (
                        <Link
                            key={tool.id}
                            href={tool.path}
                            onClick={onClose}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-3 text-base transition",
                                active ? "bg-stone-100 font-medium text-stone-950 dark:bg-stone-800 dark:text-stone-100" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                            )}
                        >
                            <Icon className="size-5" />
                            <span>{tool.label}</span>
                        </Link>
                    );
                })}
            </div>
        </Drawer>
    );
}
