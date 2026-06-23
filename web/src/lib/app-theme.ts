import type { CSSProperties } from "react";
import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";

const neutral = {
    light: {
        primary: "#171717",
        primaryHover: "#000000",
        primaryText: "#ffffff",
        menuBg: "#f5f5f5",
        menuText: "#171717",
        selectActiveBg: "#f5f5f5",
        selectSelectedBg: "#f0f0f0",
        selectText: "#171717",
        tableSelectedBg: "rgba(17, 17, 17, 0.05)",
        tableSelectedHoverBg: "rgba(17, 17, 17, 0.08)",
    },
    dark: {
        primary: "#fafafa",
        primaryHover: "#ffffff",
        primaryText: "#171717",
        menuBg: "#262626",
        menuText: "#fafafa",
        selectActiveBg: "#262626",
        selectSelectedBg: "#333333",
        selectText: "#fafafa",
        tableSelectedBg: "rgba(255, 255, 255, 0.08)",
        tableSelectedHoverBg: "rgba(255, 255, 255, 0.12)",
    },
};

export const adminLayoutStyle = {
    siderWidth: 232,
    headerHeight: 56,
    brandHeight: 64,
    menu: { borderInlineEnd: 0, padding: "18px 12px", fontSize: 15 } satisfies CSSProperties,
    menuItem: { height: 44, lineHeight: "44px", marginBlock: 4, borderRadius: 8 } satisfies CSSProperties,
};

export function getAntThemeConfig(dark: boolean): ThemeConfig {
    const color = dark ? neutral.dark : neutral.light;

    return {
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        cssVar: { key: dark ? "infinite-canvas-dark" : "infinite-canvas-light" },
        token: {
            colorPrimary: color.primary,
            colorInfo: color.primary,
            colorLink: color.primary,
            colorLinkHover: color.primaryHover,
            colorLinkActive: color.primary,
            colorTextLightSolid: color.primaryText,
            colorBgContainer: dark ? "#171717" : "#ffffff",
            colorBgElevated: dark ? "#1f1f1f" : "#ffffff",
            colorBgLayout: dark ? "#0f0f0f" : "#f5f5f5",
            colorFillQuaternary: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
            colorText: dark ? "#f5f5f5" : "#171717",
            colorTextBase: dark ? "#f5f5f5" : "#171717",
            colorTextSecondary: dark ? "#d4d4d4" : "#525252",
            colorTextTertiary: dark ? "#a3a3a3" : "#737373",
            colorBorder: dark ? "#404040" : "#d4d4d4",
            colorBorderSecondary: dark ? "#2f2f2f" : "#e5e5e5",
            controlItemBgActive: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
            controlItemBgHover: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
        },
        components: {
            Button: {
                primaryShadow: "none",
            },
            Card: {
                colorBgContainer: dark ? "#171717" : "#ffffff",
            },
            Drawer: {
                colorBgElevated: dark ? "#1f1f1f" : "#ffffff",
                colorText: dark ? "#f5f5f5" : "#171717",
            },
            Input: {
                colorBgContainer: dark ? "#1f1f1f" : "#ffffff",
                colorText: dark ? "#f5f5f5" : "#171717",
                colorTextPlaceholder: dark ? "#8a8a8a" : "#8c8c8c",
                activeBorderColor: color.primary,
                hoverBorderColor: dark ? "#737373" : "#737373",
            },
            InputNumber: {
                colorBgContainer: dark ? "#1f1f1f" : "#ffffff",
                colorText: dark ? "#f5f5f5" : "#171717",
                activeBorderColor: color.primary,
                hoverBorderColor: dark ? "#737373" : "#737373",
            },
            Menu: {
                itemActiveBg: color.menuBg,
                itemHoverBg: color.menuBg,
                itemSelectedBg: color.menuBg,
                itemSelectedColor: color.menuText,
                darkItemHoverBg: neutral.dark.menuBg,
                darkItemSelectedBg: neutral.dark.menuBg,
                darkItemSelectedColor: neutral.dark.menuText,
            },
            Select: {
                optionActiveBg: color.selectActiveBg,
                optionSelectedBg: color.selectSelectedBg,
                optionSelectedColor: color.selectText,
                colorBgContainer: dark ? "#1f1f1f" : "#ffffff",
                colorBgElevated: dark ? "#262626" : "#ffffff",
                colorText: dark ? "#f5f5f5" : "#171717",
                colorTextPlaceholder: dark ? "#8a8a8a" : "#8c8c8c",
            },
            Segmented: {
                itemActiveBg: color.selectActiveBg,
                itemHoverBg: color.selectActiveBg,
                itemSelectedBg: color.selectSelectedBg,
                itemSelectedColor: color.selectText,
                trackBg: dark ? "#1f1f1f" : "#f5f5f5",
            },
            Switch: {
                handleBg: dark ? "#f5f5f5" : "#ffffff",
                trackBg: dark ? "#404040" : "#d4d4d4",
                trackCheckedBg: color.primary,
                trackHoverBg: dark ? "#525252" : "#c4c4c4",
                trackCheckedHoverBg: color.primaryHover,
            },
            Table: {
                rowSelectedBg: color.tableSelectedBg,
                rowSelectedHoverBg: color.tableSelectedHoverBg,
                colorBgContainer: dark ? "#171717" : "#ffffff",
                headerBg: dark ? "#1f1f1f" : "#f5f5f5",
                headerColor: dark ? "#f5f5f5" : "#171717",
            },
            Tabs: {
                itemActiveColor: color.primary,
                itemHoverColor: color.primaryHover,
                itemSelectedColor: color.primary,
            },
        },
    };
}
