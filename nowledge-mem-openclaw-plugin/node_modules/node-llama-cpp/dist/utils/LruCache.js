export class LruCache {
    maxSize;
    /** @internal */ _cache = new Map();
    /** @internal */ _onDelete;
    constructor(maxSize, { onDelete } = {}) {
        this.maxSize = maxSize;
        this._onDelete = onDelete;
    }
    get(key) {
        if (!this._cache.has(key))
            return undefined;
        // move the key to the end of the cache
        const item = this._cache.get(key);
        this._cache.delete(key);
        this._cache.set(key, item);
        return item;
    }
    set(key, value) {
        if (this._cache.has(key))
            this._cache.delete(key);
        else if (this._cache.size >= this.maxSize) {
            const firstKey = this.firstKey;
            if (this._onDelete != null)
                this._onDelete(firstKey, this._cache.get(firstKey));
            this._cache.delete(firstKey);
        }
        this._cache.set(key, value);
        return this;
    }
    get firstKey() {
        return this._cache.keys()
            .next().value;
    }
    clear() {
        this._cache.clear();
    }
    keys() {
        return this._cache.keys();
    }
    delete(key) {
        this._cache.delete(key);
    }
}
//# sourceMappingURL=LruCache.js.map