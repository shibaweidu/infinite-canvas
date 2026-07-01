/**
 * 应用主色系统 - 统一的品牌色彩配置（黑白灰色调）
 */

export const appColors = {
  // 主色 - 黑色
  primary: {
    base: "#171717",
    hover: "#0a0a0a",
    light: "#f5f5f5",
    foreground: "#FFFFFF",
  },
  // 背景色系
  background: {
    cream: "#fafafa",
    surface: "#ffffff",
    white: "#FFFFFF",
    charcoal: "#0a0a0a",
  },
  // 边框和分隔
  border: {
    hairline: "#e5e5e5",
  },
  // 文字色系
  text: {
    primary: "#171717",
    muted: "#737373",
    light: "#a3a3a3",
  },
} as const;

/**
 * 生成 CSS 变量用于全局样式
 */
export function getAppColorVariables() {
  return {
    "--app-primary": appColors.primary.base,
    "--app-primary-hover": appColors.primary.hover,
    "--app-primary-light": appColors.primary.light,
    "--app-primary-foreground": appColors.primary.foreground,
    "--app-bg-cream": appColors.background.cream,
    "--app-bg-surface": appColors.background.surface,
    "--app-bg-white": appColors.background.white,
    "--app-bg-charcoal": appColors.background.charcoal,
    "--app-border-hairline": appColors.border.hairline,
    "--app-text-primary": appColors.text.primary,
    "--app-text-muted": appColors.text.muted,
    "--app-text-light": appColors.text.light,
  };
}
