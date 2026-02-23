import { Editor, type EditorOptions, type EditorTheme, type TUI } from "@mariozechner/pi-tui";
import type { AppAction, KeybindingsManager } from "../../../core/keybindings.js";
/**
 * Custom editor that handles app-level keybindings for coding-agent.
 */
export declare class CustomEditor extends Editor {
    private keybindings;
    actionHandlers: Map<AppAction, () => void>;
    onEscape?: () => void;
    onCtrlD?: () => void;
    onPasteImage?: () => void;
    /** Handler for extension-registered shortcuts. Returns true if handled. */
    onExtensionShortcut?: (data: string) => boolean;
    constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, options?: EditorOptions);
    /**
     * Register a handler for an app action.
     */
    onAction(action: AppAction, handler: () => void): void;
    handleInput(data: string): void;
}
//# sourceMappingURL=custom-editor.d.ts.map