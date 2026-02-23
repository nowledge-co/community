/**
 * The handle returned from `scopeExit` that allows calling or skipping the provided `onExit` function.
 *
 * Calling `.call()` will call the provided `onExit` function immediately, and prevent it from being called again.
 *
 * Calling `.skip()` will prevent the `onExit` function from being called.
 *
 * If neither `.call()` nor `.skip()` is called, the `onExit` function will be called automatically when the handle is disposed.
 */
export declare class ScopeExitHandle<const Callback extends (() => Promise<void> | void)> {
    private constructor();
    /** Whether the `onExit` function has been called */
    get called(): boolean;
    /** Whether the `onExit` function has been skipped */
    get skipped(): boolean;
    /**
     * Call the `onExit` function immediately if it has not been called or skipped yet, and prevent it from being called again.
     */
    call(): ReturnType<Callback> | void;
    /** Prevent the `onExit` function from being called if it has not been called yet */
    skip(): void;
    [Symbol.dispose](): void;
    [Symbol.asyncDispose](): Promise<void>;
}
/**
 * Create a scope exit handle that will call the provided callback when disposed, to be used with `using` or `await using`.
 *
 * For example, this code:
 * ```typescript
 * import {scopeExit} from "lifecycle-utils";
 *
 * function example() {
 *     using exitHandle = scopeExit(() => {
 *         console.log("exiting scope");
 *     });
 *     console.log("inside scope");
 * }
 *
 * async function asyncExample() {
 *     await using exitHandle = scopeExit(async () => {
 *         await new Promise((resolve) => setTimeout(resolve, 100));
 *         console.log("exiting async scope");
 *     });
 *     console.log("inside async scope");
 * }
 *
 * example();
 * console.log("example done");
 * console.log()
 *
 * await asyncExample();
 * console.log("asyncExample done");
 * ```
 *
 * Will print this:
 * ```
 * inside scope
 * exiting scope
 * example done
 *
 * inside async scope
 * exiting async scope
 * asyncExample done
 * ```
 */
export declare function scopeExit<const Callback extends (() => Promise<void> | void)>(onExit: Callback): ScopeExit<Callback>;
export type ScopeExit<Callback extends (() => Promise<void> | void)> = {
    readonly called: boolean;
    readonly skipped: boolean;
    call(): ReturnType<Callback> | void;
    skip(): void;
} & ((Promise<void> extends ReturnType<Callback> ? true : false) extends true ? {
    [Symbol.asyncDispose](): Promise<void>;
} : {
    [Symbol.dispose](): void;
});
//# sourceMappingURL=ScopeExit.d.ts.map