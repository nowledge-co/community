import { type KeyId } from "./keys.js";
/**
 * Editor actions that can be bound to keys.
 */
export type EditorAction = "cursorUp" | "cursorDown" | "cursorLeft" | "cursorRight" | "cursorWordLeft" | "cursorWordRight" | "cursorLineStart" | "cursorLineEnd" | "jumpForward" | "jumpBackward" | "pageUp" | "pageDown" | "deleteCharBackward" | "deleteCharForward" | "deleteWordBackward" | "deleteWordForward" | "deleteToLineStart" | "deleteToLineEnd" | "newLine" | "submit" | "tab" | "selectUp" | "selectDown" | "selectPageUp" | "selectPageDown" | "selectConfirm" | "selectCancel" | "copy" | "yank" | "yankPop" | "undo" | "expandTools" | "toggleSessionPath" | "toggleSessionSort" | "renameSession" | "deleteSession" | "deleteSessionNoninvasive";
export type { KeyId };
/**
 * Editor keybindings configuration.
 */
export type EditorKeybindingsConfig = {
    [K in EditorAction]?: KeyId | KeyId[];
};
/**
 * Default editor keybindings.
 */
export declare const DEFAULT_EDITOR_KEYBINDINGS: Required<EditorKeybindingsConfig>;
/**
 * Manages keybindings for the editor.
 */
export declare class EditorKeybindingsManager {
    private actionToKeys;
    constructor(config?: EditorKeybindingsConfig);
    private buildMaps;
    /**
     * Check if input matches a specific action.
     */
    matches(data: string, action: EditorAction): boolean;
    /**
     * Get keys bound to an action.
     */
    getKeys(action: EditorAction): KeyId[];
    /**
     * Update configuration.
     */
    setConfig(config: EditorKeybindingsConfig): void;
}
export declare function getEditorKeybindings(): EditorKeybindingsManager;
export declare function setEditorKeybindings(manager: EditorKeybindingsManager): void;
//# sourceMappingURL=keybindings.d.ts.map