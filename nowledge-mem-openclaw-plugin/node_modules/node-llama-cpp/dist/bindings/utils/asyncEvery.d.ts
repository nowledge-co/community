/**
 * Returns a promise that resolves to true if every promise in the array resolves to true, otherwise false.
 * Note that this function will not throw on error and instead will log the error to the console.
 */
export declare function asyncEvery(promises: Promise<boolean>[]): Promise<boolean>;
