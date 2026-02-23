export declare class ConsoleTable<const T extends readonly ConsoleTableColumn[]> {
    private readonly _columns;
    private readonly _columnSeparator;
    private readonly _drawHeaderRowSeparator;
    constructor(columns: T, { columnSeparator, drawHeaderRowSeparator }?: {
        columnSeparator?: string;
        drawHeaderRowSeparator?: boolean;
    });
    logHeader({ drawRowSeparator }?: {
        drawRowSeparator?: boolean;
    }): void;
    logLine(data: {
        [key in T[number]["key"]]?: string;
    }): void;
}
export type ConsoleTableColumn<K extends string = string> = {
    readonly key: K;
    readonly title?: string;
    readonly titleFormatter?: (value: string) => string;
    readonly width?: number;
    readonly valueFormatter?: (value: string) => string;
    readonly canSpanOverEmptyColumns?: boolean;
    readonly visible?: boolean;
};
