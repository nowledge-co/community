/**
 * `DisposeAggregator` is a utility class that allows you to add multiple items and then dispose them all at once.
 * You can add a function to call, an object with a `dispose` method, or an object with a `Symbol.dispose` method.
 * To dispose all the items, call `dispose` or use the `Symbol.dispose` symbol.
 *
 * For example,
 * ```typescript
 * const disposeAggregator = new DisposeAggregator();
 *
 * const eventRelay = new EventRelay<string>();
 * disposeAggregator.add(eventRelay);
 *
 * const eventRelay2 = disposeAggregator.add(new EventRelay<string>());
 *
 * disposeAggregator.dispose();
 * console.log(eventRelay.disposed === true); // true
 * console.log(eventRelay2.disposed === true); // true
 * ```
 */
export declare class DisposeAggregator {
    constructor();
    /**
     * Adds a target to be disposed.
     * You can wrap the target with a `WeakRef` to prevent this class from holding a strong reference to the target.
     */
    add<T extends DisposeAggregatorTarget>(target: T): T;
    /**
     * Disposes all the targets that have been added and clears the list of targets.
     */
    dispose(): void;
    [Symbol.dispose](): void;
    get targetCount(): number;
}
export type DisposeAggregatorTarget = (() => void) | {
    [Symbol.dispose](): void;
} | {
    dispose(): void;
} | WeakRef<{
    [Symbol.dispose](): void;
} | {
    dispose(): void;
}>;
