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
export declare class DecayingDeque<Y, R = unknown> {
    private readonly taskTimeout;
    private readonly worker;
    private readonly catchError;
    private readonly catchTimeout;
    /**
     * Number of drifts in the queue. Equivalent to the number of currently
     * pending tasks.
     */
    private len;
    /** Head element (oldest), `null` iff the queue is empty */
    private head;
    /** Tail element (newest), `null` iff the queue is empty */
    private tail;
    /**
     * Number of currently pending tasks that we strive for (`add` calls will
     * resolve only after the number of pending tasks falls below this value.
     *
     * In the context of `grammy`, it is possible to `await` calls to `add` to
     * determine when to fetch more updates.
     */
    readonly concurrency: number;
    /**
     * Timer that waits for the head element to time out, will be rescheduled
     * whenever the head element changes. It is `undefined` iff the queue is
     * empty.
     */
    private timer;
    /**
     * List of subscribers that wait for the queue to have capacity again. All
     * functions in this array will be called as soon as new capacity is
     * available, i.e. the number of pending tasks falls below `concurrency`.
     */
    private subscribers;
    private emptySubscribers;
    /**
     * Creates a new decaying queue with the given parameters.
     *
     * @param taskTimeout Max period of time for a task
     * @param worker Task generator
     * @param concurrency `add` will return only after the number of pending tasks fell below `concurrency`. `false` means `1`, `true` means `Infinity`, numbers below `1` mean `1`
     * @param catchError Error handler, receives the error and the source element
     * @param catchTimeout Timeout handler, receives the source element and the promise of the task
     */
    constructor(taskTimeout: number, worker: (t: Y) => Promise<void>, concurrency: boolean | number, catchError: (err: R, elem: Y) => void | Promise<void>, catchTimeout: (t: Y, task: Promise<void>) => void);
    /**
     * Adds the provided elements to the queue and starts tasks for all of them
     * immediately. Returns a `Promise` that resolves with `concurrency - length`
     * once this value becomes positive.
     * @param elems Elements to be added
     * @returns `this.capacity()`
     */
    add(elems: Y[]): Promise<number>;
    empty(): Promise<void>;
    /**
     * Returns a `Promise` that resolves with `concurrency - length` once this
     * value becomes positive. Use `await queue.capacity()` to wait until the
     * queue has free space again.
     *
     * @returns `concurrency - length` once positive
     */
    capacity(): Promise<number>;
    /**
     * Called when a node completed its lifecycle and should be removed from the
     * queue. Effectively wraps the `remove` call and takes care of the timer.
     *
     * @param node Drift to decay
     */
    private decay;
    /**
     * Removes an element from the queue. Calls subscribers if there is capacity
     * after performing this operation.
     *
     * @param node Drift to remove
     */
    private remove;
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
    private toDrift;
    /**
     * Starts a timer that fires off a timeout after the given period of time.
     *
     * @param ms Number of milliseconds to wait before the timeout kicks in
     */
    private startTimer;
    /**
     * Performs a timeout event. This removes the head element as well as all
     * subsequent drifts with the same date (added in the same millisecond).
     *
     * The timeout handler is called in sequence for every removed drift.
     */
    private timeout;
    /**
     * Number of pending tasks in the queue. Equivalent to
     * `this.pendingTasks().length` (but much more efficient).
     */
    get length(): number;
    /**
     * Creates a snapshot of the queue by computing a list of those elements that
     * are currently being processed.
     */
    pendingTasks(): Y[];
}
