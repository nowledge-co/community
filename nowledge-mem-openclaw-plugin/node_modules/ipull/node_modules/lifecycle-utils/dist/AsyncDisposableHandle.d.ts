/**
 * An object that provides an async `.dispose()` method that can called only once.
 *
 * Calling `.dispose()` will call the provided `onDispose` function only once.
 * Any subsequent calls to `.dispose()` will do nothing.
 */
export declare class AsyncDisposableHandle {
    constructor(onDispose: () => Promise<void>);
    get disposed(): boolean;
    [Symbol.asyncDispose](): Promise<void>;
    dispose(): Promise<void>;
}
