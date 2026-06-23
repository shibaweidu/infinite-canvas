export type CanvasColorTheme = "light" | "dark";
export type CanvasBackgroundMode = "dots" | "lines" | "blank";

export const canvasThemes = {
    light: {
        canvas: {
            background: "#f4f2ed",
            dot: "rgba(68,64,60,.28)",
            line: "rgba(68,64,60,.12)",
            selectionStroke: "#1c1917",
            selectionFill: "rgba(28,25,23,.06)",
        },
        node: {
            label: "#57534e",
            fill: "#e7e5df",
            panel: "#fbfaf7",
            stroke: "#d6d3ca",
            activeStroke: "#1c1917",
            placeholder: "#8a8479",
            text: "#292524",
            muted: "#78716c",
            faint: "#a8a29e",
        },
        toolbar: {
            panel: "rgba(251,250,247,.96)",
            border: "#d6d3ca",
            item: "#57534e",
            itemHover: "#e7e5df",
            activeBg: "#e7e5df",
            activeText: "#292524",
        },
    },
    dark: {
        canvas: {
            background: "#161616",
            dot: "rgba(245,245,245,.24)",
            line: "rgba(245,245,245,.10)",
            selectionStroke: "#fafafa",
            selectionFill: "rgba(250,250,250,.10)",
        },
        node: {
            label: "#d4d4d4",
            fill: "#262626",
            panel: "#1c1c1c",
            stroke: "#404040",
            activeStroke: "#fafafa",
            placeholder: "#a3a3a3",
            text: "#f5f5f5",
            muted: "#d4d4d4",
            faint: "#737373",
        },
        toolbar: {
            panel: "rgba(28,28,28,.96)",
            border: "#404040",
            item: "#d4d4d4",
            itemHover: "#262626",
            activeBg: "#383838",
            activeText: "#f5f5f5",
        },
    },
} as const;

export type CanvasTheme = (typeof canvasThemes)[CanvasColorTheme];
