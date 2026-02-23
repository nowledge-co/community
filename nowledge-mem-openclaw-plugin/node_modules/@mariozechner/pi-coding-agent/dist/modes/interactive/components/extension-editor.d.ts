/**
 * Multi-line editor component for extensions.
 * Supports Ctrl+G for external editor.
 */
import { Container, type EditorOptions, type TUI } from "@mariozechner/pi-tui";
import type { KeybindingsManager } from "../../../core/keybindings.js";
export declare class ExtensionEditorComponent extends Container {
    private editor;
    private onSubmitCallback;
    private onCancelCallback;
    private tui;
    private keybindings;
    constructor(tui: TUI, keybindings: KeybindingsManager, title: string, prefill: string | undefined, onSubmit: (value: string) => void, onCancel: () => void, options?: EditorOptions);
    handleInput(keyData: string): void;
    private openExternalEditor;
}
//# sourceMappingURL=extension-editor.d.ts.map