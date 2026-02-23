import type { Component } from "../tui.js";
export interface SelectItem {
    value: string;
    label: string;
    description?: string;
}
export interface SelectListTheme {
    selectedPrefix: (text: string) => string;
    selectedText: (text: string) => string;
    description: (text: string) => string;
    scrollInfo: (text: string) => string;
    noMatch: (text: string) => string;
}
export declare class SelectList implements Component {
    private items;
    private filteredItems;
    private selectedIndex;
    private maxVisible;
    private theme;
    onSelect?: (item: SelectItem) => void;
    onCancel?: () => void;
    onSelectionChange?: (item: SelectItem) => void;
    constructor(items: SelectItem[], maxVisible: number, theme: SelectListTheme);
    setFilter(filter: string): void;
    setSelectedIndex(index: number): void;
    invalidate(): void;
    render(width: number): string[];
    handleInput(keyData: string): void;
    private notifySelectionChange;
    getSelectedItem(): SelectItem | null;
}
//# sourceMappingURL=select-list.d.ts.map