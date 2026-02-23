/**
 * Iterate of all possible combinations of the given options.
 * @example
 * ```typescript
 * for (const {a, b} of optionsMatrix({a: [1, 2], b: ["x", "y"]}))
 *    console.log(a, b);
 * ```
 *
 * Will output:
 * ```txt
 * 1 x
 * 1 y
 * 2 x
 * 2 y
 * ```
 */
export declare function optionsMatrix<const T extends Record<string, any>>(options: {
    [K in keyof T]: T[K][];
}): Generator<{
    [K in keyof T]: T[K];
}>;
/**
 * Iterate of all possible combinations of the given options and call the callback with each combination.
 *
 * The result of the first combination that doesn't throw an error will be returned as the result of this function.
 *
 * If all combinations throw an error, the error of the last combination will be thrown.
 * @example
 * ```typescript
 * const result = tryMatrix({
 *     a: [1, 2],
 *     b: ["x", "y"]
 * }, ({a, b}) => {
 *     console.log(a, b);
 *
 *     if (a === 2 && b === "y")
 *         return `success ${a} ${b}`;
 *
 *    throw new Error("fail");
 * });
 *
 * console.log(result);
 * ```
 *
 * Will output:
 * ```txt
 * 1 x
 * 1 y
 * 2 x
 * 2 y
 * success 2 y
 * ```
 */
export declare function tryMatrix<const T extends Record<string, any>, R>(options: {
    [K in keyof T]: T[K][];
}, callback: (options: {
    [K in keyof T]: T[K];
}) => R): R;
