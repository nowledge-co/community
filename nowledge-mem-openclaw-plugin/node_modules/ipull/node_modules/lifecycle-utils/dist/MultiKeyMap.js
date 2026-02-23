const valueSymbol = Symbol();
/**
 * A utility class that works like a `Map`, but accepts multiple values as the key for each value.
 */
export class MultiKeyMap {
    /** @internal */ _map = new Map();
    /** @internal */ _keys = new Map();
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
        let map = this._map;
        for (let i = 0; i < key.length; i++) {
            const keyItem = key[i];
            let nextMap = map.get(keyItem);
            if (nextMap == null) {
                nextMap = new Map();
                map.set(keyItem, nextMap);
            }
            map = nextMap;
        }
        const valueKey = map.has(valueSymbol)
            ? map.get(valueSymbol)
            : key.slice();
        this._keys.set(valueKey, value);
        map.set(valueSymbol, valueKey);
        return this;
    }
    /**
     * Get a value for a given key.
     *
     * Time complexity: O(1), given that the length of the key is constant.
     */
    get(key) {
        let map = this._map;
        for (let i = 0; i < key.length && map != null; i++)
            map = map.get(key[i]);
        if (map == null)
            return undefined;
        const valueKey = map.get(valueSymbol);
        if (valueKey == null)
            return undefined;
        return this._keys.get(valueKey);
    }
    /**
     * Check if a value exists for a given key.
     *
     * Time complexity: O(1), given that the length of the key is constant.
     */
    has(key) {
        let map = this._map;
        for (let i = 0; i < key.length && map != null; i++) {
            map = map.get(key[i]);
        }
        return map != null && map.has(valueSymbol);
    }
    /**
     * Delete the value for a given key.
     *
     * Time complexity: O(1), given that the length of the key is constant.
     */
    delete(key) {
        let map = this._map;
        const stack = [];
        for (let i = 0; i < key.length && map != null; i++) {
            stack.push([map, key[i]]);
            map = map.get(key[i]);
        }
        if (map == null)
            return false;
        const valueKey = map.get(valueSymbol);
        if (valueKey == null)
            return false;
        map.delete(valueSymbol);
        this._keys.delete(valueKey);
        for (let i = stack.length - 1; i >= 0; i--) {
            const [accessMap, accessKey] = stack[i];
            if (map.size !== 0)
                break;
            accessMap.delete(accessKey);
            map = accessMap;
        }
        return true;
    }
    /**
     * Clear all values from the map.
     */
    clear() {
        this._map.clear();
        this._keys.clear();
    }
    /**
     * Get the number of entries in the map.
     */
    get size() {
        return this._keys.size;
    }
    /**
     * Get an iterator for all entries in the map.
     */
    *entries() {
        for (const [key, value] of this._keys)
            yield [key.slice(), value];
    }
    /**
     * Get an iterator for all keys in the map.
     */
    *keys() {
        for (const key of this._keys.keys())
            yield key.slice();
    }
    /**
     * Get an iterator for all values in the map.
     */
    *values() {
        for (const value of this._keys.values())
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
}
//# sourceMappingURL=MultiKeyMap.js.map