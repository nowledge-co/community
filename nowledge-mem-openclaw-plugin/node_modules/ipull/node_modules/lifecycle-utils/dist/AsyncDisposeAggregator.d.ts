/**
 * `AsyncDisposeAggregator` is a utility class that allows you to add multiple items and then dispose them all at once.
 * The items are disposed one by one in the order they were added.
 * You can add a function to call, an object with a `dispose` method, an object with a `Symbol.dispose` method,
 * an object with a `Symbol.asyncDispose` method, or a Promise that resolves to one of the previous types.
 * To dispose all the items, call `dispose` or use the `Symbol.asyncDispose` symbol.
 * The difference between `AsyncDisposeAggregator` and `DisposeAggregator` is that `AsyncDisposeAggregator` can dispose async targets.
 *
 * For example,
 * ```typescript
 * import {AsyncDisposeAggregator, EventRelay} from "lifecycle-utils";
 *
 * const disposeAggregator = new AsyncDisposeAggregator();
 *
 * const eventRelay = new EventRelay<string>();
 * disposeAggregator.add(eventRelay);
 *
 * disposeAggregator.add(async () => {
 *     await new Promise(resolve => setTimeout(resolve, 0));
 *     // do some async work
 * });
 *
 * disposeAggregator.dispose();
 * ```
 */
export declare class AsyncDisposeAggregator {
    constructor();
    /**
     * Adds a target to be disposed.
     * You can wrap the target with a `WeakRef` to prevent this class from holding a strong reference to the target.
     */
    add(target: AsyncDisposeAggregatorTarget): this;
    /**
     * Disposes all the targets that have been added and clears the list of targets.
     */
    dispose(): Promise<void>;
    [Symbol.asyncDispose](): Promise<void>;
    get targetCount(): number;
}
export type AsyncDisposeAggregatorTarget = AsyncDisposeAggregatorWrappedTarget | Promise<AsyncDisposeAggregatorWrappedTarget>;
export type AsyncDisposeAggregatorWrappedTarget = (() => void | Promise<void>) | {
    [Symbol.asyncDispose](): void | Promise<void>;
} | {
    [Symbol.dispose](): void;
} | {
    dispose(): void | Promise<void>;
} | WeakRef<{
    [Symbol.asyncDispose](): void | Promise<void>;
} | {
    [Symbol.dispose](): void;
} | {
    dispose(): void | Promise<void>;
}>;
