export declare function basicChooseFromListConsoleInteraction<T>({ title, footer, items, renderItem, canFocusItem, canSelectItem, initialFocusIndex, aboveItemsPadding, belowItemsPadding, renderSummaryOnExit, exitOnCtrlC }: {
    title: string | ((focusedItem: T, rerender: () => void) => string);
    footer?: string | ((focusedItem: T, rerender: () => void) => string | undefined);
    items: T[];
    renderItem(item: T, focused: boolean, rerender: () => void): string;
    canFocusItem?(item: T): boolean;
    canSelectItem?(item: T): boolean;
    initialFocusIndex?: number;
    aboveItemsPadding?: number;
    belowItemsPadding?: number;
    renderSummaryOnExit?(item: T | null): string;
    exitOnCtrlC?: boolean;
}): Promise<T | null>;
