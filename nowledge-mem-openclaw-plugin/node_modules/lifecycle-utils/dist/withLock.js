import { MultiKeyMap } from "./MultiKeyMap.js";
const locks = new MultiKeyMap();
export async function withLock(scope, acquireLockSignalOrCallback, callback) {
    let acquireLockSignal = undefined;
    if (acquireLockSignalOrCallback instanceof AbortSignal)
        acquireLockSignal = acquireLockSignalOrCallback;
    else if (acquireLockSignalOrCallback != null)
        callback = acquireLockSignalOrCallback;
    if (callback == null)
        throw new Error("callback is required");
    if (acquireLockSignal?.aborted)
        throw acquireLockSignal.reason;
    const scopeClone = scope.slice();
    let [queue, onDelete] = locks.get(scopeClone) || [];
    if (queue != null && onDelete != null)
        await createQueuePromise(queue, acquireLockSignal);
    else {
        queue = [];
        onDelete = [];
        locks.set(scopeClone, [queue, onDelete]);
    }
    try {
        return await callback();
    }
    finally {
        if (queue.length > 0)
            queue.shift()();
        else {
            locks.delete(scopeClone);
            while (onDelete.length > 0)
                onDelete.shift()();
        }
    }
}
/**
 * Check if a lock is currently active for a given `scope` values.
 */
export function isLockActive(scope) {
    return locks.has(scope) ?? false;
}
/**
 * Acquire a lock for a given `scope` values.
 */
export function acquireLock(scope, acquireLockSignal) {
    return new Promise((accept, reject) => {
        const scopeClone = scope.slice();
        void withLock(scopeClone, acquireLockSignal, () => {
            let releaseLock;
            const promise = new Promise((accept) => {
                releaseLock = accept;
            });
            accept({
                scope: scopeClone,
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
 * Wait for a lock to be released for a given `scope` values.
 */
export async function waitForLockRelease(scope, signal) {
    if (signal?.aborted)
        throw signal.reason;
    const [queue, onDelete] = locks.get(scope) ?? [];
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