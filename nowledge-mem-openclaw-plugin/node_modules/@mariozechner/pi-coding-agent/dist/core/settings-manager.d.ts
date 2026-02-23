import type { Transport } from "@mariozechner/pi-ai";
export interface CompactionSettings {
    enabled?: boolean;
    reserveTokens?: number;
    keepRecentTokens?: number;
}
export interface BranchSummarySettings {
    reserveTokens?: number;
}
export interface RetrySettings {
    enabled?: boolean;
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
}
export interface TerminalSettings {
    showImages?: boolean;
    clearOnShrink?: boolean;
}
export interface ImageSettings {
    autoResize?: boolean;
    blockImages?: boolean;
}
export interface ThinkingBudgetsSettings {
    minimal?: number;
    low?: number;
    medium?: number;
    high?: number;
}
export interface MarkdownSettings {
    codeBlockIndent?: string;
}
export type TransportSetting = Transport;
/**
 * Package source for npm/git packages.
 * - String form: load all resources from the package
 * - Object form: filter which resources to load
 */
export type PackageSource = string | {
    source: string;
    extensions?: string[];
    skills?: string[];
    prompts?: string[];
    themes?: string[];
};
export interface Settings {
    lastChangelogVersion?: string;
    defaultProvider?: string;
    defaultModel?: string;
    defaultThinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
    transport?: TransportSetting;
    steeringMode?: "all" | "one-at-a-time";
    followUpMode?: "all" | "one-at-a-time";
    theme?: string;
    compaction?: CompactionSettings;
    branchSummary?: BranchSummarySettings;
    retry?: RetrySettings;
    hideThinkingBlock?: boolean;
    shellPath?: string;
    quietStartup?: boolean;
    shellCommandPrefix?: string;
    collapseChangelog?: boolean;
    packages?: PackageSource[];
    extensions?: string[];
    skills?: string[];
    prompts?: string[];
    themes?: string[];
    enableSkillCommands?: boolean;
    terminal?: TerminalSettings;
    images?: ImageSettings;
    enabledModels?: string[];
    doubleEscapeAction?: "fork" | "tree" | "none";
    thinkingBudgets?: ThinkingBudgetsSettings;
    editorPaddingX?: number;
    autocompleteMaxVisible?: number;
    showHardwareCursor?: boolean;
    markdown?: MarkdownSettings;
}
export type SettingsScope = "global" | "project";
export interface SettingsStorage {
    withLock(scope: SettingsScope, fn: (current: string | undefined) => string | undefined): void;
}
export interface SettingsError {
    scope: SettingsScope;
    error: Error;
}
export declare class FileSettingsStorage implements SettingsStorage {
    private globalSettingsPath;
    private projectSettingsPath;
    constructor(cwd?: string, agentDir?: string);
    withLock(scope: SettingsScope, fn: (current: string | undefined) => string | undefined): void;
}
export declare class InMemorySettingsStorage implements SettingsStorage {
    private global;
    private project;
    withLock(scope: SettingsScope, fn: (current: string | undefined) => string | undefined): void;
}
export declare class SettingsManager {
    private storage;
    private globalSettings;
    private projectSettings;
    private settings;
    private modifiedFields;
    private modifiedNestedFields;
    private modifiedProjectFields;
    private modifiedProjectNestedFields;
    private globalSettingsLoadError;
    private projectSettingsLoadError;
    private writeQueue;
    private errors;
    private constructor();
    /** Create a SettingsManager that loads from files */
    static create(cwd?: string, agentDir?: string): SettingsManager;
    /** Create a SettingsManager from an arbitrary storage backend */
    static fromStorage(storage: SettingsStorage): SettingsManager;
    /** Create an in-memory SettingsManager (no file I/O) */
    static inMemory(settings?: Partial<Settings>): SettingsManager;
    private static loadFromStorage;
    private static tryLoadFromStorage;
    /** Migrate old settings format to new format */
    private static migrateSettings;
    getGlobalSettings(): Settings;
    getProjectSettings(): Settings;
    reload(): void;
    /** Apply additional overrides on top of current settings */
    applyOverrides(overrides: Partial<Settings>): void;
    /** Mark a global field as modified during this session */
    private markModified;
    /** Mark a project field as modified during this session */
    private markProjectModified;
    private recordError;
    private clearModifiedScope;
    private enqueueWrite;
    private cloneModifiedNestedFields;
    private persistScopedSettings;
    private save;
    private saveProjectSettings;
    flush(): Promise<void>;
    drainErrors(): SettingsError[];
    getLastChangelogVersion(): string | undefined;
    setLastChangelogVersion(version: string): void;
    getDefaultProvider(): string | undefined;
    getDefaultModel(): string | undefined;
    setDefaultProvider(provider: string): void;
    setDefaultModel(modelId: string): void;
    setDefaultModelAndProvider(provider: string, modelId: string): void;
    getSteeringMode(): "all" | "one-at-a-time";
    setSteeringMode(mode: "all" | "one-at-a-time"): void;
    getFollowUpMode(): "all" | "one-at-a-time";
    setFollowUpMode(mode: "all" | "one-at-a-time"): void;
    getTheme(): string | undefined;
    setTheme(theme: string): void;
    getDefaultThinkingLevel(): "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | undefined;
    setDefaultThinkingLevel(level: "off" | "minimal" | "low" | "medium" | "high" | "xhigh"): void;
    getTransport(): TransportSetting;
    setTransport(transport: TransportSetting): void;
    getCompactionEnabled(): boolean;
    setCompactionEnabled(enabled: boolean): void;
    getCompactionReserveTokens(): number;
    getCompactionKeepRecentTokens(): number;
    getCompactionSettings(): {
        enabled: boolean;
        reserveTokens: number;
        keepRecentTokens: number;
    };
    getBranchSummarySettings(): {
        reserveTokens: number;
    };
    getRetryEnabled(): boolean;
    setRetryEnabled(enabled: boolean): void;
    getRetrySettings(): {
        enabled: boolean;
        maxRetries: number;
        baseDelayMs: number;
        maxDelayMs: number;
    };
    getHideThinkingBlock(): boolean;
    setHideThinkingBlock(hide: boolean): void;
    getShellPath(): string | undefined;
    setShellPath(path: string | undefined): void;
    getQuietStartup(): boolean;
    setQuietStartup(quiet: boolean): void;
    getShellCommandPrefix(): string | undefined;
    setShellCommandPrefix(prefix: string | undefined): void;
    getCollapseChangelog(): boolean;
    setCollapseChangelog(collapse: boolean): void;
    getPackages(): PackageSource[];
    setPackages(packages: PackageSource[]): void;
    setProjectPackages(packages: PackageSource[]): void;
    getExtensionPaths(): string[];
    setExtensionPaths(paths: string[]): void;
    setProjectExtensionPaths(paths: string[]): void;
    getSkillPaths(): string[];
    setSkillPaths(paths: string[]): void;
    setProjectSkillPaths(paths: string[]): void;
    getPromptTemplatePaths(): string[];
    setPromptTemplatePaths(paths: string[]): void;
    setProjectPromptTemplatePaths(paths: string[]): void;
    getThemePaths(): string[];
    setThemePaths(paths: string[]): void;
    setProjectThemePaths(paths: string[]): void;
    getEnableSkillCommands(): boolean;
    setEnableSkillCommands(enabled: boolean): void;
    getThinkingBudgets(): ThinkingBudgetsSettings | undefined;
    getShowImages(): boolean;
    setShowImages(show: boolean): void;
    getClearOnShrink(): boolean;
    setClearOnShrink(enabled: boolean): void;
    getImageAutoResize(): boolean;
    setImageAutoResize(enabled: boolean): void;
    getBlockImages(): boolean;
    setBlockImages(blocked: boolean): void;
    getEnabledModels(): string[] | undefined;
    setEnabledModels(patterns: string[] | undefined): void;
    getDoubleEscapeAction(): "fork" | "tree" | "none";
    setDoubleEscapeAction(action: "fork" | "tree" | "none"): void;
    getShowHardwareCursor(): boolean;
    setShowHardwareCursor(enabled: boolean): void;
    getEditorPaddingX(): number;
    setEditorPaddingX(padding: number): void;
    getAutocompleteMaxVisible(): number;
    setAutocompleteMaxVisible(maxVisible: number): void;
    getCodeBlockIndent(): string;
}
//# sourceMappingURL=settings-manager.d.ts.map