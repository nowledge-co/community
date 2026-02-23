import type { AutocompleteProvider } from "../autocomplete.js";
import { type Component, type Focusable, type TUI } from "../tui.js";
import { type SelectListTheme } from "./select-list.js";
/**
 * Represents a chunk of text for word-wrap layout.
 * Tracks both the text content and its position in the original line.
 */
export interface TextChunk {
    text: string;
    startIndex: number;
    endIndex: number;
}
/**
 * Split a line into word-wrapped chunks.
 * Wraps at word boundaries when possible, falling back to character-level
 * wrapping for words longer than the available width.
 *
 * @param line - The text line to wrap
 * @param maxWidth - Maximum visible width per chunk
 * @returns Array of chunks with text and position information
 */
export declare function wordWrapLine(line: string, maxWidth: number): TextChunk[];
export interface EditorTheme {
    borderColor: (str: string) => string;
    selectList: SelectListTheme;
}
export interface EditorOptions {
    paddingX?: number;
    autocompleteMaxVisible?: number;
}
export declare class Editor implements Component, Focusable {
    private state;
    /** Focusable interface - set by TUI when focus changes */
    focused: boolean;
    protected tui: TUI;
    private theme;
    private paddingX;
    private lastWidth;
    private scrollOffset;
    borderColor: (str: string) => string;
    private autocompleteProvider?;
    private autocompleteList?;
    private autocompleteState;
    private autocompletePrefix;
    private autocompleteMaxVisible;
    private pastes;
    private pasteCounter;
    private pasteBuffer;
    private isInPaste;
    private history;
    private historyIndex;
    private killRing;
    private lastAction;
    private jumpMode;
    private preferredVisualCol;
    private undoStack;
    onSubmit?: (text: string) => void;
    onChange?: (text: string) => void;
    disableSubmit: boolean;
    constructor(tui: TUI, theme: EditorTheme, options?: EditorOptions);
    getPaddingX(): number;
    setPaddingX(padding: number): void;
    getAutocompleteMaxVisible(): number;
    setAutocompleteMaxVisible(maxVisible: number): void;
    setAutocompleteProvider(provider: AutocompleteProvider): void;
    /**
     * Add a prompt to history for up/down arrow navigation.
     * Called after successful submission.
     */
    addToHistory(text: string): void;
    private isEditorEmpty;
    private isOnFirstVisualLine;
    private isOnLastVisualLine;
    private navigateHistory;
    /** Internal setText that doesn't reset history state - used by navigateHistory */
    private setTextInternal;
    invalidate(): void;
    render(width: number): string[];
    handleInput(data: string): void;
    private layoutText;
    getText(): string;
    /**
     * Get text with paste markers expanded to their actual content.
     * Use this when you need the full content (e.g., for external editor).
     */
    getExpandedText(): string;
    getLines(): string[];
    getCursor(): {
        line: number;
        col: number;
    };
    setText(text: string): void;
    /**
     * Insert text at the current cursor position.
     * Used for programmatic insertion (e.g., clipboard image markers).
     * This is atomic for undo - single undo restores entire pre-insert state.
     */
    insertTextAtCursor(text: string): void;
    /**
     * Internal text insertion at cursor. Handles single and multi-line text.
     * Does not push undo snapshots or trigger autocomplete - caller is responsible.
     * Normalizes line endings and calls onChange once at the end.
     */
    private insertTextAtCursorInternal;
    private insertCharacter;
    private handlePaste;
    private addNewLine;
    private shouldSubmitOnBackslashEnter;
    private submitValue;
    private handleBackspace;
    /**
     * Set cursor column and clear preferredVisualCol.
     * Use this for all non-vertical cursor movements to reset sticky column behavior.
     */
    private setCursorCol;
    /**
     * Move cursor to a target visual line, applying sticky column logic.
     * Shared by moveCursor() and pageScroll().
     */
    private moveToVisualLine;
    /**
     * Compute the target visual column for vertical cursor movement.
     * Implements the sticky column decision table:
     *
     * | P | S | T | U | Scenario                                             | Set Preferred | Move To     |
     * |---|---|---|---| ---------------------------------------------------- |---------------|-------------|
     * | 0 | * | 0 | - | Start nav, target fits                               | null          | current     |
     * | 0 | * | 1 | - | Start nav, target shorter                            | current       | target end  |
     * | 1 | 0 | 0 | 0 | Clamped, target fits preferred                       | null          | preferred   |
     * | 1 | 0 | 0 | 1 | Clamped, target longer but still can't fit preferred | keep          | target end  |
     * | 1 | 0 | 1 | - | Clamped, target even shorter                         | keep          | target end  |
     * | 1 | 1 | 0 | - | Rewrapped, target fits current                       | null          | current     |
     * | 1 | 1 | 1 | - | Rewrapped, target shorter than current               | current       | target end  |
     *
     * Where:
     * - P = preferred col is set
     * - S = cursor in middle of source line (not clamped to end)
     * - T = target line shorter than current visual col
     * - U = target line shorter than preferred col
     */
    private computeVerticalMoveColumn;
    private moveToLineStart;
    private moveToLineEnd;
    private deleteToStartOfLine;
    private deleteToEndOfLine;
    private deleteWordBackwards;
    private deleteWordForward;
    private handleForwardDelete;
    /**
     * Build a mapping from visual lines to logical positions.
     * Returns an array where each element represents a visual line with:
     * - logicalLine: index into this.state.lines
     * - startCol: starting column in the logical line
     * - length: length of this visual line segment
     */
    private buildVisualLineMap;
    /**
     * Find the visual line index for the current cursor position.
     */
    private findCurrentVisualLine;
    private moveCursor;
    /**
     * Scroll by a page (direction: -1 for up, 1 for down).
     * Moves cursor by the page size while keeping it in bounds.
     */
    private pageScroll;
    private moveWordBackwards;
    /**
     * Yank (paste) the most recent kill ring entry at cursor position.
     */
    private yank;
    /**
     * Cycle through kill ring (only works immediately after yank or yank-pop).
     * Replaces the last yanked text with the previous entry in the ring.
     */
    private yankPop;
    /**
     * Insert text at cursor position (used by yank operations).
     */
    private insertYankedText;
    /**
     * Delete the previously yanked text (used by yank-pop).
     * The yanked text is derived from killRing[end] since it hasn't been rotated yet.
     */
    private deleteYankedText;
    private pushUndoSnapshot;
    private undo;
    /**
     * Jump to the first occurrence of a character in the specified direction.
     * Multi-line search. Case-sensitive. Skips the current cursor position.
     */
    private jumpToChar;
    private moveWordForwards;
    private isSlashMenuAllowed;
    private isAtStartOfMessage;
    private isInSlashCommandContext;
    private tryTriggerAutocomplete;
    private handleTabCompletion;
    private handleSlashCommandCompletion;
    private forceFileAutocomplete;
    private cancelAutocomplete;
    isShowingAutocomplete(): boolean;
    private updateAutocomplete;
}
//# sourceMappingURL=editor.d.ts.map