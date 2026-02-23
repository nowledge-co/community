/**
 * A utility class that works like a `Map`,
 * but does not keep strong references to the values (allowing them to be garbage collected).
 *
 * When a value is garbage collected, it is automatically removed from the map.
 */
export class WeakValueMap {
    /** @internal */ _map = new Map();
    constructor(entries) {
        if (entries != null) {
            for (const [key, value] of entries)
                this.set(key, value);
        }
    }
    /**
     * Add or update a value for a given key.
     *
     * Time complexity: O(1), given that the length of the key is constant.
     */
    set(key, value) {
        const currentWeakValue = this._map.get(key);
        if (currentWeakValue != null) {
            const currentValue = currentWeakValue.ref.deref();
            if (currentValue != null)
                currentWeakValue.tracker.unregister(currentValue);
        }
        const weakValue = {
            ref: new WeakRef(value),
            tracker: null // will be set below
        };
        weakValue.tracker = new FinalizationRegistry(this._finalize.bind(this, weakValue));
        weakValue.tracker.register(value, key);
        this._map.set(key, weakValue);
        return this;
    }
    /**
     * Get a value for a given key.
     *
     * Time complexity: O(1), given that the length of the key is constant.
     */
    get(key) {
        const weakValue = this._map.get(key);
        if (weakValue == null)
            return undefined;
        const value = weakValue.ref.deref();
        /* c8 ignore start */
        if (value == null) {
            this._map.delete(key);
            return undefined;
        } /* c8 ignore stop */
        return value;
    }
    /**
     * Check if a value exists for a given key.
     *
     * Time complexity: O(1), given that the length of the key is constant.
     */
    has(key) {
        return this.get(key) != null;
    }
    /**
     * Delete the value for a given key.
     *
     * Time complexity: O(1), given that the length of the key is constant.
     */
    delete(key) {
        const weakValue = this._map.get(key);
        if (weakValue == null)
            return false;
        const value = weakValue.ref.deref();
        if (value != null)
            weakValue.tracker.unregister(value);
        this._map.delete(key);
        return true;
    }
    /**
     * Clear all values from the map.
     */
    clear() {
        for (const [, weakValue] of this._map.entries()) {
            const value = weakValue.ref.deref();
            if (value != null)
                weakValue.tracker.unregister(value);
        }
        this._map.clear();
    }
    /**
     * Get the number of entries in the map.
     */
    get size() {
        return this._map.size;
    }
    /**
     * Get an iterator for all entries in the map.
     */
    *entries() {
        for (const [key, weakValue] of this._map.entries()) {
            const value = weakValue.ref.deref();
            if (value != null)
                yield [key, value];
        }
    }
    /**
     * Get an iterator for all keys in the map.
     */
    *keys() {
        for (const [key] of this.entries())
            yield key;
    }
    /**
     * Get an iterator for all values in the map.
     */
    *values() {
        for (const [, value] of this.entries())
            yield value;
    }
    /**
     * Call a function for each entry in the map.
     */
    forEach(callbackfn, thisArg) {
        for (const [key, value] of this.entries()) {
            if (thisArg !== undefined)
                callbackfn.call(thisArg, value, key, this);
            else
                callbackfn.call(this, value, key, this);
        }
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    /** @internal */
    _finalize(value, key) {
        const weakValue = this._map.get(key);
        if (weakValue === value)
            this._map.delete(key);
    }
}
//# sourceMappingURL=WeakValueMap.js.map