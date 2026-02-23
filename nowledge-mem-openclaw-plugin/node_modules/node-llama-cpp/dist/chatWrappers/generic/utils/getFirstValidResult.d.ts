/**
 * Call the functions in the array one by one and return the result of the first one that doesn't throw an error.
 *
 * If all functions throw an error, throw the error of the last function.
 */
export declare function getFirstValidResult<const T extends (() => any)[]>(options: T): ReturnType<T[number]>;
