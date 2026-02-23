"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecayingDeque = void 0;
// Maximal valid value that can be passed to `setTimeout`
const MAX_TIMEOUT_VALUE = ~(1 << 31); // equals (2 ** 31 - 1)
/**
 * A _decaying deque_ is a special kind of doubly linked list that serves as a
 * queue for a special kind of nodes, called _drifts_.
 *
 * A decaying deque has a worker function that spawns a task for each element
 * that is added to the queue. This task then gets wrapped into a drift. The
 * drifts are then the actual elements (aka. links) in the queue.
 *
 * In addition, the decaying deque runs a timer that purges old elements from
 * the queue. This period of time is determined by the `taskTimeout`.
 *
 * When a task completes or exceeds its timeout, the corresponding drift is
 * removed from the queue. As a result, only drifts with pending tasks are
 * contained in the queue at all times.
 *
 * When a tasks completes with failure (`reject`s or exceeds the timeout), the
 * respective handler (`catchError` or `catchTimeout`) is called.
 *
 * The decaying deque has its name from the observation that new elements are
 * appended to the tail, and the old elements are removed at arbitrary positions
 * in the queue whenever a task completes, hence, the queue seems to _decay_.
 */
class DecayingDeque {
    /**
     * Creates a new decaying queue with the given parameters.
     *
     * @param taskTimeout Max period of time for a task
     * @param worker Task generator
     * @param concurrency `add` will return only after the number of pending tasks fell below `concurrency`. `false` means `1`, `true` means `Infinity`, numbers below `1` mean `1`
     * @param catchError Error handler, receives the error and the source element
     * @param catchTimeout Timeout handler, receives the source element and the promise of the task
     */
    constructor(taskTimeout, worker, concurrency, catchError, catchTimeout) {
        this.taskTimeout = taskTimeout;
        this.worker = worker;
        this.catchError = catchError;
        this.catchTimeout = catchTimeout;
        /**
         * Number of drifts in the queue. Equivalent to the number of currently
         * pending tasks.
         */
        this.len = 0;
        /** Head element (oldest), `null` iff the queue is empty */
        this.head = null;
        /** Tail element (newest), `null` iff the queue is empty */
        this.tail = null;
        /**
         * List of subscribers that wait for the queue to have capacity again. All
         * functions in this array will be called as soon as new capacity is
         * available, i.e. the number of pending tasks falls below `concurrency`.
         */
        this.subscribers = [];
        this.emptySubscribers = [];
        if (concurrency === false)
            this.concurrency = 1;
        else if (concurrency === true)
            this.concurrency = Infinity;
        else
            this.concurrency = concurrency < 1 ? 1 : concurrency;
    }
    /**
     * Adds the provided elements to the queue and starts tasks for all of them
     * immediately. Returns a `Promise` that resolves with `concurrency - length`
     * once this value becomes positive.
     * @param elems Elements to be added
     * @returns `this.capacity()`
     */
    add(elems) {
        const len = elems.length;
        this.len += len;
        if (len > 0) {
            let i = 0;
            const now = Date.now();
            // emptyness check
            if (this.head === null) {
                this.head = this.tail = this.toDrift(elems[i++], now);
                // start timer because head element changed
                this.startTimer();
            }
            let prev = this.tail;
            while (i < len) {
                // create drift from source element
                const node = this.toDrift(elems[i++], now);
                // link it to previous element (append operation)
                prev.next = node;
                node.prev = prev;
                prev = node;
            }
            this.tail = prev;
        }
        return this.capacity();
    }
    empty() {
        return new Promise((resolve) => {
            if (this.len === 0)
                resolve();
            else
                this.emptySubscribers.push(resolve);
        });
    }
    /**
     * Returns a `Promise` that resolves with `concurrency - length` once this
     * value becomes positive. Use `await queue.capacity()` to wait until the
     * queue has free space again.
     *
     * @returns `concurrency - length` once positive
     */
    capacity() {
        return new Promise((resolve) => {
            const capacity = this.concurrency - this.len;
            if (capacity > 0)
                resolve(capacity);
            else
                this.subscribers.push(resolve);
        });
    }
    /**
     * Called when a node completed its lifecycle and should be removed from the
     * queue. Effectively wraps the `remove` call and takes care of the timer.
     *
     * @param node Drift to decay
     */
    decay(node) {
        var _a;
        // We only need to restart the timer if we decay the head element of the
        // queue, however, if the next element has the same date as `node`, we can
        // skip this step, too.
        if (this.head === node && node.date !== ((_a = node.next) === null || _a === void 0 ? void 0 : _a.date)) {
            // Clear previous timeout
            if (this.timer !== undefined)
                clearTimeout(this.timer);
            // Emptyness check (do not start if queue is now empty)
            if (node.next === null)
                this.timer = undefined;
            // Reschedule timer for the next node's timeout
            else {
                this.startTimer(node.next.date + this.taskTimeout - Date.now());
            }
        }
        this.remove(node);
    }
    /**
     * Removes an element from the queue. Calls subscribers if there is capacity
     * after performing this operation.
     *
     * @param node Drift to remove
     */
    remove(node) {
        // Connecting the links of `prev` and `next` removes `node`
        if (this.head === node)
            this.head = node.next;
        else
            node.prev.next = node.next;
        if (this.tail === node)
            this.tail = node.prev;
        else
            node.next.prev = node.prev;
        // Mark this drift as no longer contained
        node.date = -1;
        // Notify subscribers if there is capacity by now
        const capacity = this.concurrency - --this.len;
        if (capacity > 0) {
            this.subscribers.forEach((resolve) => resolve(capacity));
            this.subscribers = [];
        }
        // Notify subscribers if the queue is empty now
        if (this.len === 0) {
            this.emptySubscribers.forEach((resolve) => resolve());
            this.emptySubscribers = [];
        }
    }
    /**
     * Takes a source element and starts the task for it by calling the worker
     * function. Then wraps this task into a drift. Also makes sure that the drift
     * removes itself from the queue once it completes, and that the error handler
     * is invoked if it fails (rejects).
     *
     * @param elem Source element
     * @param date Date when this drift is created
     * @returns The created drift
     */
    toDrift(elem, date) {
        const node = {
            prev: null,
            task: this.worker(elem)
                .catch(async (err) => {
                // Rethrow iff the drift is no longer contained (timed out)
                if (node.date > 0)
                    await this.catchError(err, elem);
                else
                    throw err;
            })
                .finally(() => {
                // Decay the node once the task completes (unless the drift was
                // removed due to a timeout before)
                if (node.date > 0)
                    this.decay(node);
            }),
            next: null,
            date,
            elem,
        };
        return node;
    }
    /**
     * Starts a timer that fires off a timeout after the given period of time.
     *
     * @param ms Number of milliseconds to wait before the timeout kicks in
     */
    startTimer(ms = this.taskTimeout) {
        this.timer = ms > MAX_TIMEOUT_VALUE
            ? undefined
            : setTimeout(() => this.timeout(), ms);
    }
    /**
     * Performs a timeout event. This removes the head element as well as all
     * subsequent drifts with the same date (added in the same millisecond).
     *
     * The timeout handler is called in sequence for every removed drift.
     */
    timeout() {
        var _a;
        // Rare cases of the event ordering might fire a timeout even though the
        // head element has just decayed.
        if (this.head === null)
            return;
        while (this.head.date === ((_a = this.head.next) === null || _a === void 0 ? void 0 : _a.date)) {
            this.catchTimeout(this.head.elem, this.head.task);
            // No need to restart timer here, we'll modify head again anyway
            this.remove(this.head);
        }
        this.catchTimeout(this.head.elem, this.head.task);
        this.decay(this.head);
    }
    /**
     * Number of pending tasks in the queue. Equivalent to
     * `this.pendingTasks().length` (but much more efficient).
     */
    get length() {
        return this.len;
    }
    /**
     * Creates a snapshot of the queue by computing a list of those elements that
     * are currently being processed.
     */
    pendingTasks() {
        const len = this.len;
        const snapshot = Array(len);
        let drift = this.head;
        for (let i = 0; i < len; i++) {
            snapshot[i] = drift.elem;
            drift = drift.next;
        }
        return snapshot;
    }
}
exports.DecayingDeque = DecayingDeque;
