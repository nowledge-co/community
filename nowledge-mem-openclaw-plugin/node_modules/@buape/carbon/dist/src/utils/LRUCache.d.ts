/**
 * Simple LRU (Least Recently Used) cache implementation
 * Automatically evicts least recently used items when capacity is reached
 */
export declare class LRUCache<K, V> {
    private cache;
    private readonly maxSize;
    constructor(maxSize?: number);
    /**
     * Get a value from the cache
     * @param key The key to retrieve
     * @returns The value if found, undefined otherwise
     */
    get(key: K): V | undefined;
    /**
     * Set a value in the cache
     * @param key The key to set
     * @param value The value to store
     */
    set(key: K, value: V): void;
    /**
     * Check if a key exists in the cache
     * @param key The key to check
     * @returns true if the key exists
     */
    has(key: K): boolean;
    /**
     * Delete a key from the cache
     * @param key The key to delete
     * @returns true if the key was deleted
     */
    delete(key: K): boolean;
    /**
     * Get the current size of the cache
     */
    get size(): number;
    /**
     * Get all values in the cache
     */
    values(): IterableIterator<V>;
    /**
     * Clear all entries from the cache
     */
    clear(): void;
}
//# sourceMappingURL=LRUCache.d.ts.map