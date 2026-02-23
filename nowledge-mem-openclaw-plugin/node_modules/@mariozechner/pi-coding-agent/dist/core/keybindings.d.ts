import { type EditorAction, type KeyId } from "@mariozechner/pi-tui";
/**
 * Application-level actions (coding agent specific).
 */
export type AppAction = "interrupt" | "clear" | "exit" | "suspend" | "cycleThinkingLevel" | "cycleModelForward" | "cycleModelBackward" | "selectModel" | "expandTools" | "toggleThinking" | "toggleSessionNamedFilter" | "externalEditor" | "followUp" | "dequeue" | "pasteImage" | "newSession" | "tree" | "fork" | "resume";
/**
 * All configurable actions.
 */
export type KeyAction = AppAction | EditorAction;
/**
 * Full keybindings configuration (app + editor actions).
 */
export type KeybindingsConfig = {
    [K in KeyAction]?: KeyId | KeyId[];
};
/**
 * Default application keybindings.
 */
export declare const DEFAULT_APP_KEYBINDINGS: Record<AppAction, KeyId | KeyId[]>;
/**
 * All default keybindings (app + editor).
 */
export declare const DEFAULT_KEYBINDINGS: Required<KeybindingsConfig>;
/**
 * Manages all keybindings (app + editor).
 */
export declare class KeybindingsManager {
    private config;
    private appActionToKeys;
    private constructor();
    /**
     * Create from config file and set up editor keybindings.
     */
    static create(agentDir?: string): KeybindingsManager;
    /**
     * Create in-memory.
     */
    static inMemory(config?: KeybindingsConfig): KeybindingsManager;
    private static loadFromFile;
    private buildMaps;
    /**
     * Check if input matches an app action.
     */
    matches(data: string, action: AppAction): boolean;
    /**
     * Get keys bound to an app action.
     */
    getKeys(action: AppAction): KeyId[];
    /**
     * Get the full effective config.
     */
    getEffectiveConfig(): Required<KeybindingsConfig>;
}
export type { EditorAction, KeyId };
//# sourceMappingURL=keybindings.d.ts.map