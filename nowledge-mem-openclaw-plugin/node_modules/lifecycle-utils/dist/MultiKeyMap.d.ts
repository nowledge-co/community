/**
 * A utility class that works like a `Map`, but accepts multiple values as the key for each value.
 */
export declare class MultiKeyMap<const Key extends readonly any[], const V> {
    constructor(entries?: readonly (readonly [key: Key, value: V])[] | MultiKeyMap<Key, V> | ReadonlyMultiKeyMap<Key, V> | null);
    /**
     * Add or update a value for a given key.
     *
     * Time complexity: O(1), given that the length of the key is constant.
     */
    set(key: Readonly<Key>, value: V): this;
    /**
     * Get a value for a given key.
     *
     * Time complexity: O(1), given that the length of the key is constant.
     */
    get(key: Readonly<Key>): V | undefined;
    /**
     * Check if a value exists for a given key.
     *
     * Time complexity: O(1), given that the length of the key is constant.
     */
    has(key: Readonly<Key>): boolean;
    /**
     * Delete the value for a given key.
     *
     * Time complexity: O(1), given that the length of the key is constant.
     */
    delete(key: Readonly<Key>): boolean;
    /**
     * Clear all values from the map.
     */
    clear(): void;
    /**
     * Get the number of entries in the map.
     */
    get size(): number;
    /**
     * Get an iterator for all entries in the map.
     */
    entries(): Generator<[key: Key, value: V]>;
    /**
     * Get an iterator for all keys in the map.
     */
    keys(): Generator<Key>;
    /**
     * Get an iterator for all values in the map.
     */
    values(): Generator<V>;
    /**
     * Call a function for each entry in the map.
     */
    forEach(callbackfn: (value: V, key: Key, map: this) => void, thisArg?: any): void;
    [Symbol.iterator](): Generator<[key: Key, value: V]>;
}
export type ReadonlyMultiKeyMap<Key extends readonly any[], V> = Omit<MultiKeyMap<Key, V>, "set" | "delete" | "clear">;
//# sourceMappingURL=MultiKeyMap.d.ts.map