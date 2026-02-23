import { type Component, Container, type Focusable } from "@mariozechner/pi-tui";
import type { SessionTreeNode } from "../../../core/session-manager.js";
declare class TreeList implements Component {
    private flatNodes;
    private filteredNodes;
    private selectedIndex;
    private currentLeafId;
    private maxVisibleLines;
    private filterMode;
    private searchQuery;
    private toolCallMap;
    private multipleRoots;
    private activePathIds;
    private lastSelectedId;
    onSelect?: (entryId: string) => void;
    onCancel?: () => void;
    onLabelEdit?: (entryId: string, currentLabel: string | undefined) => void;
    constructor(tree: SessionTreeNode[], currentLeafId: string | null, maxVisibleLines: number, initialSelectedId?: string);
    /**
     * Find the index of the nearest visible entry, walking up the parent chain if needed.
     * Returns the index in filteredNodes, or the last index as fallback.
     */
    private findNearestVisibleIndex;
    /** Build the set of entry IDs on the path from root to current leaf */
    private buildActivePath;
    private flattenTree;
    private applyFilter;
    /**
     * Recompute indentation/connectors for the filtered view
     *
     * Filtering can hide intermediate entries; descendants attach to the nearest visible ancestor.
     * Keep indentation semantics aligned with flattenTree() so single-child chains don't drift right.
     */
    private recalculateVisualStructure;
    /** Get searchable text content from a node */
    private getSearchableText;
    invalidate(): void;
    getSearchQuery(): string;
    getSelectedNode(): SessionTreeNode | undefined;
    updateNodeLabel(entryId: string, label: string | undefined): void;
    private getFilterLabel;
    render(width: number): string[];
    private getEntryDisplayText;
    private extractContent;
    private hasTextContent;
    private formatToolCall;
    handleInput(keyData: string): void;
}
/**
 * Component that renders a session tree selector for navigation
 */
export declare class TreeSelectorComponent extends Container implements Focusable {
    private treeList;
    private labelInput;
    private labelInputContainer;
    private treeContainer;
    private onLabelChangeCallback?;
    private _focused;
    get focused(): boolean;
    set focused(value: boolean);
    constructor(tree: SessionTreeNode[], currentLeafId: string | null, terminalHeight: number, onSelect: (entryId: string) => void, onCancel: () => void, onLabelChange?: (entryId: string, label: string | undefined) => void, initialSelectedId?: string);
    private showLabelInput;
    private hideLabelInput;
    handleInput(keyData: string): void;
    getTreeList(): TreeList;
}
export {};
//# sourceMappingURL=tree-selector.d.ts.map