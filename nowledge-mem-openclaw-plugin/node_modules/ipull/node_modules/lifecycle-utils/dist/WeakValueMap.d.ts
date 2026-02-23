/**
 * A utility class that works like a `Map`,
 * but does not keep strong references to the values (allowing them to be garbage collected).
 *
 * When a value is garbage collected, it is automatically removed from the map.
 */
export declare class WeakValueMap<const Key, const V extends object> {
    constructor(entries?: readonly (readonly [key: Key, value: V])[] | Map<Key, V> | ReadonlyMap<Key, V> | WeakValueMap<Key, V> | ReadonlyWeakValueMap<Key, V> | null);
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
export type ReadonlyWeakValueMap<Key, V extends object> = Omit<WeakValueMap<Key, V>, "set" | "delete" | "clear">;
