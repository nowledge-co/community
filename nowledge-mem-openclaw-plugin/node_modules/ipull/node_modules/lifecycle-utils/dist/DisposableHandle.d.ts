/**
 * An object that provides a `.dispose()` method that can called only once.
 *
 * Calling `.dispose()` will call the provided `onDispose` function only once.
 * Any subsequent calls to `.dispose()` will do nothing.
 */
export declare class DisposableHandle {
    constructor(onDispose: () => void);
    get disposed(): boolean;
    [Symbol.dispose](): void;
    dispose(): void;
}
