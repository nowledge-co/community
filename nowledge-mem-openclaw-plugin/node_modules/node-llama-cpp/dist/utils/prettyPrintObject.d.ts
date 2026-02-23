export type PrettyPrintObjectOptions = {
    maxArrayValues?: number;
    useNumberGrouping?: boolean;
    maxArrayItemsWidth?: number;
    multilineObjects?: boolean;
};
export declare function prettyPrintObject(obj: any, indent?: number, options?: PrettyPrintObjectOptions): string;
export declare function formatNumber(num: number | bigint, { useNumberGrouping }?: {
    useNumberGrouping?: boolean;
}): string;
