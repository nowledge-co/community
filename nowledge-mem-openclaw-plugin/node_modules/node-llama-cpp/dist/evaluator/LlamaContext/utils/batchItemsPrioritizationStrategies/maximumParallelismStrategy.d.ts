import { BatchItem, PrioritizedBatchItem } from "../../types.js";
export declare function maximumParallelismStrategy({ items, size }: {
    items: readonly BatchItem[];
    size: number;
}): PrioritizedBatchItem[];
