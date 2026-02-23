import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { Transport } from "@mariozechner/pi-ai";
import { Container, SettingsList } from "@mariozechner/pi-tui";
export interface SettingsConfig {
    autoCompact: boolean;
    showImages: boolean;
    autoResizeImages: boolean;
    blockImages: boolean;
    enableSkillCommands: boolean;
    steeringMode: "all" | "one-at-a-time";
    followUpMode: "all" | "one-at-a-time";
    transport: Transport;
    thinkingLevel: ThinkingLevel;
    availableThinkingLevels: ThinkingLevel[];
    currentTheme: string;
    availableThemes: string[];
    hideThinkingBlock: boolean;
    collapseChangelog: boolean;
    doubleEscapeAction: "fork" | "tree" | "none";
    showHardwareCursor: boolean;
    editorPaddingX: number;
    autocompleteMaxVisible: number;
    quietStartup: boolean;
    clearOnShrink: boolean;
}
export interface SettingsCallbacks {
    onAutoCompactChange: (enabled: boolean) => void;
    onShowImagesChange: (enabled: boolean) => void;
    onAutoResizeImagesChange: (enabled: boolean) => void;
    onBlockImagesChange: (blocked: boolean) => void;
    onEnableSkillCommandsChange: (enabled: boolean) => void;
    onSteeringModeChange: (mode: "all" | "one-at-a-time") => void;
    onFollowUpModeChange: (mode: "all" | "one-at-a-time") => void;
    onTransportChange: (transport: Transport) => void;
    onThinkingLevelChange: (level: ThinkingLevel) => void;
    onThemeChange: (theme: string) => void;
    onThemePreview?: (theme: string) => void;
    onHideThinkingBlockChange: (hidden: boolean) => void;
    onCollapseChangelogChange: (collapsed: boolean) => void;
    onDoubleEscapeActionChange: (action: "fork" | "tree" | "none") => void;
    onShowHardwareCursorChange: (enabled: boolean) => void;
    onEditorPaddingXChange: (padding: number) => void;
    onAutocompleteMaxVisibleChange: (maxVisible: number) => void;
    onQuietStartupChange: (enabled: boolean) => void;
    onClearOnShrinkChange: (enabled: boolean) => void;
    onCancel: () => void;
}
/**
 * Main settings selector component.
 */
export declare class SettingsSelectorComponent extends Container {
    private settingsList;
    constructor(config: SettingsConfig, callbacks: SettingsCallbacks);
    getSettingsList(): SettingsList;
}
//# sourceMappingURL=settings-selector.d.ts.map