export declare class LruCache<Key, Value> {
    readonly maxSize: number;
    constructor(maxSize: number, { onDelete }?: {
        onDelete?(key: Key, value: Value): void;
    });
    get(key: Key): Value | undefined;
    set(key: Key, value: Value): this;
    get firstKey(): Key | undefined;
    clear(): void;
    keys(): MapIterator<Key>;
    delete(key: Key): void;
}
