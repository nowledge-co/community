/**
 * Utilities for formatting keybinding hints in the UI.
 */
import { type EditorAction } from "@mariozechner/pi-tui";
import type { AppAction, KeybindingsManager } from "../../../core/keybindings.js";
/**
 * Get display string for an editor action.
 */
export declare function editorKey(action: EditorAction): string;
/**
 * Get display string for an app action.
 */
export declare function appKey(keybindings: KeybindingsManager, action: AppAction): string;
/**
 * Format a keybinding hint with consistent styling: dim key, muted description.
 * Looks up the key from editor keybindings automatically.
 *
 * @param action - Editor action name (e.g., "selectConfirm", "expandTools")
 * @param description - Description text (e.g., "to expand", "cancel")
 * @returns Formatted string with dim key and muted description
 */
export declare function keyHint(action: EditorAction, description: string): string;
/**
 * Format a keybinding hint for app-level actions.
 * Requires the KeybindingsManager instance.
 *
 * @param keybindings - KeybindingsManager instance
 * @param action - App action name (e.g., "interrupt", "externalEditor")
 * @param description - Description text
 * @returns Formatted string with dim key and muted description
 */
export declare function appKeyHint(keybindings: KeybindingsManager, action: AppAction, description: string): string;
/**
 * Format a raw key string with description (for non-configurable keys like ↑↓).
 *
 * @param key - Raw key string
 * @param description - Description text
 * @returns Formatted string with dim key and muted description
 */
export declare function rawKeyHint(key: string, description: string): string;
//# sourceMappingURL=keybinding-hints.d.ts.map