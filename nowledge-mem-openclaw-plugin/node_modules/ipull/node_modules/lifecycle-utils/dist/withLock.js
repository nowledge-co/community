const locks = new Map();
export async function withLock(scope, key, acquireLockSignalOrCallback, callback) {
    let acquireLockSignal = undefined;
    if (acquireLockSignalOrCallback instanceof AbortSignal)
        acquireLockSignal = acquireLockSignalOrCallback;
    else if (acquireLockSignalOrCallback != null)
        callback = acquireLockSignalOrCallback;
    if (callback == null)
        throw new Error("callback is required");
    if (acquireLockSignal?.aborted)
        throw acquireLockSignal.reason;
    let keyMap = locks.get(scope);
    if (keyMap == null) {
        keyMap = new Map();
        locks.set(scope, keyMap);
    }
    let [queue, onDelete] = keyMap.get(key) || [];
    if (queue != null && onDelete != null)
        await createQueuePromise(queue, acquireLockSignal);
    else {
        queue = [];
        onDelete = [];
        keyMap.set(key, [queue, onDelete]);
    }
    try {
        return await callback.call(scope);
    }
    finally {
        if (queue.length > 0)
            queue.shift()();
        else {
            locks.get(scope)?.delete(key);
            if (locks.get(scope)?.size === 0)
                locks.delete(scope);
            while (onDelete.length > 0)
                onDelete.shift()();
        }
    }
}
/**
 * Check if a lock is currently active for a given `scope` and `key`.
 */
export function isLockActive(scope, key) {
    return locks.get(scope)?.has(key) ?? false;
}
/**
 * Acquire a lock for a given `scope` and `key`.
 */
export function acquireLock(scope, key, acquireLockSignal) {
    return new Promise((accept, reject) => {
        void withLock(scope, key, acquireLockSignal, () => {
            let releaseLock;
            const promise = new Promise((accept) => {
                releaseLock = accept;
            });
            accept({
                scope,
                key,
                dispose() {
                    releaseLock();
                },
                [Symbol.dispose]() {
                    releaseLock();
                }
            });
            return promise;
        })
            .catch(reject);
    });
}
/**
 * Wait for a lock to be released for a given `scope` and `key`.
 */
export async function waitForLockRelease(scope, key, signal) {
    if (signal?.aborted)
        throw signal.reason;
    const [queue, onDelete] = locks.get(scope)?.get(key) ?? [];
    if (queue == null || onDelete == null)
        return;
    await createQueuePromise(onDelete, signal);
}
function createQueuePromise(queue, signal) {
    if (signal == null)
        return new Promise((accept) => void queue.push(accept));
    return new Promise((accept, reject) => {
        function onAcquireLock() {
            signal.removeEventListener("abort", onAbort);
            accept();
        }
        const queueLength = queue.length;
        function onAbort() {
            const itemIndex = queue.lastIndexOf(onAcquireLock, queueLength);
            if (itemIndex >= 0)
                queue.splice(itemIndex, 1);
            signal.removeEventListener("abort", onAbort);
            reject(signal.reason);
        }
        queue.push(onAcquireLock);
        signal.addEventListener("abort", onAbort);
    });
}
//# sourceMappingURL=withLock.js.map