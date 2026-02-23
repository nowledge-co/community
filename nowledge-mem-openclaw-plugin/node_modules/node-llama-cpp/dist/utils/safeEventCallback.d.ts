/**
 * Wraps a callback in a try-catch block and logs any errors to the console
 */
export declare function safeEventCallback<const Params extends any[]>(callback: ((...args: Params) => void) | ((...args: Params) => Promise<void>) | ((...args: Params) => void | Promise<void>), message?: string): ((...args: Params) => void);
export declare function safeEventCallback(callback?: undefined | void | never, message?: string): undefined;
export declare function safeEventCallback<const Params extends any[] = any[]>(callback?: undefined | void | never | ((...args: Params) => void) | ((...args: Params) => Promise<void>) | ((...args: Params) => void | Promise<void>), message?: string): undefined | ((...args: Params) => void);
