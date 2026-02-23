import { matchesKey } from "./keys.js";
/**
 * Default editor keybindings.
 */
export const DEFAULT_EDITOR_KEYBINDINGS = {
    // Cursor movement
    cursorUp: "up",
    cursorDown: "down",
    cursorLeft: ["left", "ctrl+b"],
    cursorRight: ["right", "ctrl+f"],
    cursorWordLeft: ["alt+left", "ctrl+left", "alt+b"],
    cursorWordRight: ["alt+right", "ctrl+right", "alt+f"],
    cursorLineStart: ["home", "ctrl+a"],
    cursorLineEnd: ["end", "ctrl+e"],
    jumpForward: "ctrl+]",
    jumpBackward: "ctrl+alt+]",
    pageUp: "pageUp",
    pageDown: "pageDown",
    // Deletion
    deleteCharBackward: "backspace",
    deleteCharForward: ["delete", "ctrl+d"],
    deleteWordBackward: ["ctrl+w", "alt+backspace"],
    deleteWordForward: ["alt+d", "alt+delete"],
    deleteToLineStart: "ctrl+u",
    deleteToLineEnd: "ctrl+k",
    // Text input
    newLine: "shift+enter",
    submit: "enter",
    tab: "tab",
    // Selection/autocomplete
    selectUp: "up",
    selectDown: "down",
    selectPageUp: "pageUp",
    selectPageDown: "pageDown",
    selectConfirm: "enter",
    selectCancel: ["escape", "ctrl+c"],
    // Clipboard
    copy: "ctrl+c",
    // Kill ring
    yank: "ctrl+y",
    yankPop: "alt+y",
    // Undo
    undo: "ctrl+-",
    // Tool output
    expandTools: "ctrl+o",
    // Session
    toggleSessionPath: "ctrl+p",
    toggleSessionSort: "ctrl+s",
    renameSession: "ctrl+r",
    deleteSession: "ctrl+d",
    deleteSessionNoninvasive: "ctrl+backspace",
};
/**
 * Manages keybindings for the editor.
 */
export class EditorKeybindingsManager {
    actionToKeys;
    constructor(config = {}) {
        this.actionToKeys = new Map();
        this.buildMaps(config);
    }
    buildMaps(config) {
        this.actionToKeys.clear();
        // Start with defaults
        for (const [action, keys] of Object.entries(DEFAULT_EDITOR_KEYBINDINGS)) {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            this.actionToKeys.set(action, [...keyArray]);
        }
        // Override with user config
        for (const [action, keys] of Object.entries(config)) {
            if (keys === undefined)
                continue;
            const keyArray = Array.isArray(keys) ? keys : [keys];
            this.actionToKeys.set(action, keyArray);
        }
    }
    /**
     * Check if input matches a specific action.
     */
    matches(data, action) {
        const keys = this.actionToKeys.get(action);
        if (!keys)
            return false;
        for (const key of keys) {
            if (matchesKey(data, key))
                return true;
        }
        return false;
    }
    /**
     * Get keys bound to an action.
     */
    getKeys(action) {
        return this.actionToKeys.get(action) ?? [];
    }
    /**
     * Update configuration.
     */
    setConfig(config) {
        this.buildMaps(config);
    }
}
// Global instance
let globalEditorKeybindings = null;
export function getEditorKeybindings() {
    if (!globalEditorKeybindings) {
        globalEditorKeybindings = new EditorKeybindingsManager();
    }
    return globalEditorKeybindings;
}
export function setEditorKeybindings(manager) {
    globalEditorKeybindings = manager;
}
//# sourceMappingURL=keybindings.js.map