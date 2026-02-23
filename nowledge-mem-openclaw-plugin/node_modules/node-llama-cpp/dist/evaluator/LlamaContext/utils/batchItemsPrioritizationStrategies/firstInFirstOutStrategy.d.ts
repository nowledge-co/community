import { BatchItem, PrioritizedBatchItem } from "../../types.js";
export declare function firstInFirstOutStrategy({ items, size }: {
    items: readonly BatchItem[];
    size: number;
}): PrioritizedBatchItem[];
