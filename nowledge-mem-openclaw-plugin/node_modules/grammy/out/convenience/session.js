"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorySessionStorage = void 0;
exports.session = session;
exports.lazySession = lazySession;
exports.enhanceStorage = enhanceStorage;
const platform_node_js_1 = require("../platform.node.js");
const debug = (0, platform_node_js_1.debug)("grammy:session");
/**
 * Session middleware provides a persistent data storage for your bot. You can
 * use it to let your bot remember any data you want, for example the messages
 * it sent or received in the past. This is done by attaching _session data_ to
 * every chat. The stored data is then provided on the context object under
 * `ctx.session`.
 *
 * > **What is a session?** Simply put, the session of a chat is a little
 * > persistent storage that is attached to it. As an example, your bot can send
 * > a message to a chat and store the identifier of that message in the
 * > corresponding session. The next time your bot receives an update from that
 * > chat, the session will still contain that ID.
 * >
 * > Session data can be stored in a database, in a file, or simply in memory.
 * > grammY only supports memory sessions out of the box, but you can use
 * > third-party session middleware to connect to other storage solutions. Note
 * > that memory sessions will be lost when you stop your bot and the process
 * > exits, so they are usually not useful in production.
 *
 * Whenever your bot receives an update, the first thing the session middleware
 * will do is to load the correct session from your storage solution. This
 * object is then provided on `ctx.session` while your other middleware is
 * running. As soon as your bot is done handling the update, the middleware
 * takes over again and writes back the session object to your storage. This
 * allows you to modify the session object arbitrarily in your middleware, and
 * to stop worrying about the database.
 *
 * ```ts
 * bot.use(session())
 *
 * bot.on('message', ctx => {
 *   // The session object is persisted across updates!
 *   const session = ctx.session
 * })
 * ```
 *
 * It is recommended to make use of the `initial` option in the configuration
 * object, which correctly initializes session objects for new chats.
 *
 * You can delete the session data by setting `ctx.session` to `null` or
 * `undefined`.
 *
 * Check out the [documentation](https://grammy.dev/plugins/session) on the
 * website to know more about how sessions work in grammY.
 *
 * @param options Optional configuration to pass to the session middleware
 */
function session(options = {}) {
    return options.type === "multi"
        ? strictMultiSession(options)
        : strictSingleSession(options);
}
function strictSingleSession(options) {
    const { initial, storage, getSessionKey, custom } = fillDefaults(options);
    return async (ctx, next) => {
        const propSession = new PropertySession(storage, ctx, "session", initial);
        const key = await getSessionKey(ctx);
        await propSession.init(key, { custom, lazy: false });
        await next(); // no catch: do not write back if middleware throws
        await propSession.finish();
    };
}
function strictMultiSession(options) {
    const props = Object.keys(options).filter((k) => k !== "type");
    const defaults = Object.fromEntries(props.map((prop) => [prop, fillDefaults(options[prop])]));
    return async (ctx, next) => {
        ctx.session = {};
        const propSessions = await Promise.all(props.map(async (prop) => {
            const { initial, storage, getSessionKey, custom } = defaults[prop];
            const s = new PropertySession(
            // @ts-expect-error cannot express that the storage works for a concrete prop
            storage, ctx.session, prop, initial);
            const key = await getSessionKey(ctx);
            await s.init(key, { custom, lazy: false });
            return s;
        }));
        await next(); // no catch: do not write back if middleware throws
        if (ctx.session == null)
            propSessions.forEach((s) => s.delete());
        await Promise.all(propSessions.map((s) => s.finish()));
    };
}
/**
 * > This is an advanced function of grammY.
 *
 * Generally speaking, lazy sessions work just like normal sessions—just they
 * are loaded on demand. Except for a few `async`s and `await`s here and there,
 * their usage looks 100 % identical.
 *
 * Instead of directly querying the storage every time an update arrives, lazy
 * sessions quickly do this _once you access_ `ctx.session`. This can
 * significantly reduce the database traffic (especially when your bot is added
 * to group chats), because it skips a read and a wrote operation for all
 * updates that the bot does not react to.
 *
 * ```ts
 * // The options are identical
 * bot.use(lazySession({ storage: ... }))
 *
 * bot.on('message', async ctx => {
 *   // The session object is persisted across updates!
 *   const session = await ctx.session
 *   //                        ^
 *   //                        |
 *   //                       This plain property access (no function call) will trigger the database query!
 * })
 * ```
 *
 * Check out the
 * [documentation](https://grammy.dev/plugins/session#lazy-sessions) on the
 * website to know more about how lazy sessions work in grammY.
 *
 * @param options Optional configuration to pass to the session middleware
 */
function lazySession(options = {}) {
    if (options.type !== undefined && options.type !== "single") {
        throw new Error("Cannot use lazy multi sessions!");
    }
    const { initial, storage, getSessionKey, custom } = fillDefaults(options);
    return async (ctx, next) => {
        const propSession = new PropertySession(
        // @ts-expect-error suppress promise nature of values
        storage, ctx, "session", initial);
        const key = await getSessionKey(ctx);
        await propSession.init(key, { custom, lazy: true });
        await next(); // no catch: do not write back if middleware throws
        await propSession.finish();
    };
}
/**
 * Internal class that manages a single property on the session. Can be used
 * both in a strict and a lazy way. Works by using `Object.defineProperty` to
 * install `O[P]`.
 */
// deno-lint-ignore ban-types
class PropertySession {
    constructor(storage, obj, prop, initial) {
        this.storage = storage;
        this.obj = obj;
        this.prop = prop;
        this.initial = initial;
        this.fetching = false;
        this.read = false;
        this.wrote = false;
    }
    /** Performs a read op and stores the result in `this.value` */
    load() {
        if (this.key === undefined) {
            // No session key provided, cannot load
            return;
        }
        if (this.wrote) {
            // Value was set, no need to load
            return;
        }
        // Perform read op if not cached
        if (this.promise === undefined) {
            this.fetching = true;
            this.promise = Promise.resolve(this.storage.read(this.key))
                .then((val) => {
                var _a;
                this.fetching = false;
                // Check for write op in the meantime
                if (this.wrote) {
                    // Discard read op
                    return this.value;
                }
                // Store received value in `this.value`
                if (val !== undefined) {
                    this.value = val;
                    return val;
                }
                // No value, need to initialize
                val = (_a = this.initial) === null || _a === void 0 ? void 0 : _a.call(this);
                if (val !== undefined) {
                    // Wrote initial value
                    this.wrote = true;
                    this.value = val;
                }
                return val;
            });
        }
        return this.promise;
    }
    async init(key, opts) {
        this.key = key;
        if (!opts.lazy)
            await this.load();
        Object.defineProperty(this.obj, this.prop, {
            enumerable: true,
            get: () => {
                if (key === undefined) {
                    const msg = undef("access", opts);
                    throw new Error(msg);
                }
                this.read = true;
                if (!opts.lazy || this.wrote)
                    return this.value;
                this.load();
                return this.fetching ? this.promise : this.value;
            },
            set: (v) => {
                if (key === undefined) {
                    const msg = undef("assign", opts);
                    throw new Error(msg);
                }
                this.wrote = true;
                this.fetching = false;
                this.value = v;
            },
        });
    }
    delete() {
        Object.assign(this.obj, { [this.prop]: undefined });
    }
    async finish() {
        if (this.key !== undefined) {
            if (this.read)
                await this.load();
            if (this.read || this.wrote) {
                const value = await this.value;
                if (value == null)
                    await this.storage.delete(this.key);
                else
                    await this.storage.write(this.key, value);
            }
        }
    }
}
function fillDefaults(opts = {}) {
    let { prefix = "", getSessionKey = defaultGetSessionKey, initial, storage, } = opts;
    if (storage == null) {
        debug("Storing session data in memory, all data will be lost when the bot restarts.");
        storage = new MemorySessionStorage();
    }
    const custom = getSessionKey !== defaultGetSessionKey;
    return {
        initial,
        storage,
        getSessionKey: async (ctx) => {
            const key = await getSessionKey(ctx);
            return key === undefined ? undefined : prefix + key;
        },
        custom,
    };
}
/** Stores session data per chat by default */
function defaultGetSessionKey(ctx) {
    var _a;
    return (_a = ctx.chatId) === null || _a === void 0 ? void 0 : _a.toString();
}
/** Returns a useful error message for when the session key is undefined */
function undef(op, opts) {
    const { lazy = false, custom } = opts;
    const reason = custom
        ? "the custom `getSessionKey` function returned undefined for this update"
        : "this update does not belong to a chat, so the session key is undefined";
    return `Cannot ${op} ${lazy ? "lazy " : ""}session data because ${reason}!`;
}
function isEnhance(value) {
    return value === undefined ||
        typeof value === "object" && value !== null && "__d" in value;
}
/**
 * You can use this function to transform an existing storage adapter, and add
 * more features to it. Currently, you can add session migrations and expiry
 * dates.
 *
 * You can use this function like so:
 * ```ts
 * const storage = ... // define your storage adapter
 * const enhanced = enhanceStorage({ storage, millisecondsToLive: 500 })
 * bot.use(session({ storage: enhanced }))
 * ```
 *
 * @param options Session enhancing options
 * @returns The enhanced storage adapter
 */
function enhanceStorage(options) {
    let { storage, millisecondsToLive, migrations } = options;
    storage = compatStorage(storage);
    if (millisecondsToLive !== undefined) {
        storage = timeoutStorage(storage, millisecondsToLive);
    }
    if (migrations !== undefined) {
        storage = migrationStorage(storage, migrations);
    }
    return wrapStorage(storage);
}
function compatStorage(storage) {
    return {
        read: async (k) => {
            const v = await storage.read(k);
            return isEnhance(v) ? v : { __d: v };
        },
        write: (k, v) => storage.write(k, v),
        delete: (k) => storage.delete(k),
    };
}
function timeoutStorage(storage, millisecondsToLive) {
    const ttlStorage = {
        read: async (k) => {
            const value = await storage.read(k);
            if (value === undefined)
                return undefined;
            if (value.e === undefined) {
                await ttlStorage.write(k, value);
                return value;
            }
            if (value.e < Date.now()) {
                await ttlStorage.delete(k);
                return undefined;
            }
            return value;
        },
        write: async (k, v) => {
            v.e = addExpiryDate(v, millisecondsToLive).expires;
            await storage.write(k, v);
        },
        delete: (k) => storage.delete(k),
    };
    return ttlStorage;
}
function migrationStorage(storage, migrations) {
    const versions = Object.keys(migrations)
        .map((v) => parseInt(v))
        .sort((a, b) => a - b);
    const count = versions.length;
    if (count === 0)
        throw new Error("No migrations given!");
    const earliest = versions[0];
    const last = count - 1;
    const latest = versions[last];
    const index = new Map();
    versions.forEach((v, i) => index.set(v, i)); // inverse array lookup
    function nextAfter(current) {
        // TODO: use `findLastIndex` with Node 18
        let i = last;
        while (current <= versions[i])
            i--;
        return i;
        // return versions.findLastIndex((v) => v < current)
    }
    return {
        read: async (k) => {
            var _a;
            const val = await storage.read(k);
            if (val === undefined)
                return val;
            let { __d: value, v: current = earliest - 1 } = val;
            let i = 1 + ((_a = index.get(current)) !== null && _a !== void 0 ? _a : nextAfter(current));
            for (; i < count; i++)
                value = migrations[versions[i]](value);
            return { ...val, v: latest, __d: value };
        },
        write: (k, v) => storage.write(k, { v: latest, ...v }),
        delete: (k) => storage.delete(k),
    };
}
function wrapStorage(storage) {
    return {
        read: (k) => Promise.resolve(storage.read(k)).then((v) => v === null || v === void 0 ? void 0 : v.__d),
        write: (k, v) => storage.write(k, { __d: v }),
        delete: (k) => storage.delete(k),
    };
}
// === Memory storage adapter
/**
 * The memory session storage is a built-in storage adapter that saves your
 * session data in RAM using a regular JavaScript `Map` object. If you use this
 * storage adapter, all sessions will be lost when your process terminates or
 * restarts. Hence, you should only use it for short-lived data that is not
 * important to persist.
 *
 * This class is used as default if you do not provide a storage adapter, e.g.
 * to your database.
 *
 * This storage adapter features expiring sessions. When instantiating this
 * class yourself, you can pass a time to live in milliseconds that will be used
 * for each session object. If a session for a user expired, the session data
 * will be discarded on its first read, and a fresh session object as returned
 * by the `initial` option (or undefined) will be put into place.
 */
class MemorySessionStorage {
    /**
     * Constructs a new memory session storage with the given time to live. Note
     * that this storage adapter will not store your data permanently.
     *
     * @param timeToLive TTL in milliseconds, default is `Infinity`
     */
    constructor(timeToLive) {
        this.timeToLive = timeToLive;
        /**
         * Internally used `Map` instance that stores the session data
         */
        this.storage = new Map();
    }
    read(key) {
        const value = this.storage.get(key);
        if (value === undefined)
            return undefined;
        if (value.expires !== undefined && value.expires < Date.now()) {
            this.delete(key);
            return undefined;
        }
        return value.session;
    }
    /**
     * @deprecated Use {@link readAllValues} instead
     */
    readAll() {
        return this.readAllValues();
    }
    readAllKeys() {
        return Array.from(this.storage.keys());
    }
    readAllValues() {
        return Array
            .from(this.storage.keys())
            .map((key) => this.read(key))
            .filter((value) => value !== undefined);
    }
    readAllEntries() {
        return Array.from(this.storage.keys())
            .map((key) => [key, this.read(key)])
            .filter((pair) => pair[1] !== undefined);
    }
    has(key) {
        return this.storage.has(key);
    }
    write(key, value) {
        this.storage.set(key, addExpiryDate(value, this.timeToLive));
    }
    delete(key) {
        this.storage.delete(key);
    }
}
exports.MemorySessionStorage = MemorySessionStorage;
function addExpiryDate(value, ttl) {
    if (ttl !== undefined && ttl < Infinity) {
        const now = Date.now();
        return { session: value, expires: now + ttl };
    }
    else {
        return { session: value };
    }
}
