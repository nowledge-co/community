/**
 * Returns a promise that fulfills as soon as any of the promises return `true`.
 * Note that this function will not throw on error and instead will log the error to the console.
 */
export declare function asyncSome(promises: Promise<boolean>[]): Promise<boolean>;
