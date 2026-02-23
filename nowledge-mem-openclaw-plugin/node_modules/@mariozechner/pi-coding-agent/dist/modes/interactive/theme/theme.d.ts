import type { EditorTheme, MarkdownTheme, SelectListTheme } from "@mariozechner/pi-tui";
export type ThemeColor = "accent" | "border" | "borderAccent" | "borderMuted" | "success" | "error" | "warning" | "muted" | "dim" | "text" | "thinkingText" | "userMessageText" | "customMessageText" | "customMessageLabel" | "toolTitle" | "toolOutput" | "mdHeading" | "mdLink" | "mdLinkUrl" | "mdCode" | "mdCodeBlock" | "mdCodeBlockBorder" | "mdQuote" | "mdQuoteBorder" | "mdHr" | "mdListBullet" | "toolDiffAdded" | "toolDiffRemoved" | "toolDiffContext" | "syntaxComment" | "syntaxKeyword" | "syntaxFunction" | "syntaxVariable" | "syntaxString" | "syntaxNumber" | "syntaxType" | "syntaxOperator" | "syntaxPunctuation" | "thinkingOff" | "thinkingMinimal" | "thinkingLow" | "thinkingMedium" | "thinkingHigh" | "thinkingXhigh" | "bashMode";
export type ThemeBg = "selectedBg" | "userMessageBg" | "customMessageBg" | "toolPendingBg" | "toolSuccessBg" | "toolErrorBg";
type ColorMode = "truecolor" | "256color";
export declare class Theme {
    readonly name?: string;
    readonly sourcePath?: string;
    private fgColors;
    private bgColors;
    private mode;
    constructor(fgColors: Record<ThemeColor, string | number>, bgColors: Record<ThemeBg, string | number>, mode: ColorMode, options?: {
        name?: string;
        sourcePath?: string;
    });
    fg(color: ThemeColor, text: string): string;
    bg(color: ThemeBg, text: string): string;
    bold(text: string): string;
    italic(text: string): string;
    underline(text: string): string;
    inverse(text: string): string;
    strikethrough(text: string): string;
    getFgAnsi(color: ThemeColor): string;
    getBgAnsi(color: ThemeBg): string;
    getColorMode(): ColorMode;
    getThinkingBorderColor(level: "off" | "minimal" | "low" | "medium" | "high" | "xhigh"): (str: string) => string;
    getBashModeBorderColor(): (str: string) => string;
}
export declare function getAvailableThemes(): string[];
export interface ThemeInfo {
    name: string;
    path: string | undefined;
}
export declare function getAvailableThemesWithPaths(): ThemeInfo[];
export declare function loadThemeFromPath(themePath: string, mode?: ColorMode): Theme;
export declare function getThemeByName(name: string): Theme | undefined;
export declare const theme: Theme;
export declare function setRegisteredThemes(themes: Theme[]): void;
export declare function initTheme(themeName?: string, enableWatcher?: boolean): void;
export declare function setTheme(name: string, enableWatcher?: boolean): {
    success: boolean;
    error?: string;
};
export declare function setThemeInstance(themeInstance: Theme): void;
export declare function onThemeChange(callback: () => void): void;
export declare function stopThemeWatcher(): void;
/**
 * Get resolved theme colors as CSS-compatible hex strings.
 * Used by HTML export to generate CSS custom properties.
 */
export declare function getResolvedThemeColors(themeName?: string): Record<string, string>;
/**
 * Check if a theme is a "light" theme (for CSS that needs light/dark variants).
 */
export declare function isLightTheme(themeName?: string): boolean;
/**
 * Get explicit export colors from theme JSON, if specified.
 * Returns undefined for each color that isn't explicitly set.
 */
export declare function getThemeExportColors(themeName?: string): {
    pageBg?: string;
    cardBg?: string;
    infoBg?: string;
};
/**
 * Highlight code with syntax coloring based on file extension or language.
 * Returns array of highlighted lines.
 */
export declare function highlightCode(code: string, lang?: string): string[];
/**
 * Get language identifier from file path extension.
 */
export declare function getLanguageFromPath(filePath: string): string | undefined;
export declare function getMarkdownTheme(): MarkdownTheme;
export declare function getSelectListTheme(): SelectListTheme;
export declare function getEditorTheme(): EditorTheme;
export declare function getSettingsListTheme(): import("@mariozechner/pi-tui").SettingsListTheme;
export {};
//# sourceMappingURL=theme.d.ts.map