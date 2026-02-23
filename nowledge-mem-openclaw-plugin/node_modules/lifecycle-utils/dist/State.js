/**
 * `State` is a utility class that allows you to hold a value and notify listeners when the value changes.
 */
export class State {
    /** @internal */ _queueEvents;
    /** @internal */ _listenerCallbacks;
    /** @internal */ _state;
    /** @internal */ _changeEventMicrotaskQueued;
    /**
     * @param defaultState
     * @param [options]
     * @param [options.queueEvents] - queue events to be dispatched in a microtask.
     * If the state changes multiple times in the same microtask, only the last change will be dispatched.
     * If the most recent value is the same as the previous value, no event will be dispatched.
     * Set this to `false` to dispatch events immediately upon state changes.
     */
    constructor(defaultState, { queueEvents = true } = {}) {
        this._queueEvents = queueEvents;
        this._listenerCallbacks = new Map();
        this._state = defaultState;
        this._changeEventMicrotaskQueued = false;
        this.createChangeListener = this.createChangeListener.bind(this);
        this.clearChangeListeners = this.clearChangeListeners.bind(this);
    }
    get state() {
        return this._state;
    }
    set state(newState) {
        if (this._state === newState)
            return;
        this._state = newState;
        if (!this._queueEvents) {
            this._dispatchChangeEvent(this._state);
        }
        else if (!this._changeEventMicrotaskQueued) {
            this._changeEventMicrotaskQueued = true;
            (globalThis.queueMicrotask || globalThis.setTimeout)(() => {
                this._changeEventMicrotaskQueued = false;
                this._dispatchChangeEvent(this._state);
            });
        }
    }
    createChangeListener(callback, callInstantlyWithCurrentState = false) {
        this._listenerCallbacks.set(callback, this._state);
        if (callInstantlyWithCurrentState) {
            try {
                callback(this._state, undefined);
            }
            catch (err) {
                console.error(err);
            }
        }
        return StateChangeListenerHandle._create(() => {
            this._listenerCallbacks.delete(callback);
        });
    }
    clearChangeListeners() {
        this._listenerCallbacks.clear();
    }
    get changeListenerCount() {
        return this._listenerCallbacks.size;
    }
    /** @internal */
    _dispatchChangeEvent(newState) {
        for (const [listenerCallback, lastValue] of Array.from(this._listenerCallbacks.entries())) {
            if (lastValue === newState)
                continue;
            if (this._listenerCallbacks.has(listenerCallback))
                this._listenerCallbacks.set(listenerCallback, newState);
            try {
                listenerCallback(newState, lastValue);
            }
            catch (err) {
                console.error(err);
            }
        }
    }
    /**
     * Create a listener that listens to multiple states and calls the callback when any of the states change.
     *
     * For example,
     * ```typescript
     * import {State} from "lifecycle-utils";
     *
     * const valueState1 = new State<number>(6);
     * const valueState2 = new State<string>("hello");
     * const valueState3 = new State<boolean>(true);
     *
     * const eventHandle = State.createCombinedChangeListener([valueState1, valueState2, valueState3], (newValues, previousValues) => {
     *     console.log("new values:", newValues);
     *     console.log("previous values:", previousValues);
     * });
     *
     * valueState1.state = 7;
     * valueState2.state = "world";
     * valueState3.state = false;
     *
     * // after a microtask, the listener will be called
     * // to make event fire immediately upon change, disable the `queueEvents` option on the constructor
     * await new Promise(resolve => setTimeout(resolve, 0));
     * // will print:
     * // new values: [7, "world", false]
     * // previous values: [6, "hello", true]
     *
     * eventHandle.dispose();
     * ```
     * @param states
     * @param callback
     * @param [options]
     * @param [options.callInstantlyWithCurrentState]
     * @param [options.queueEvents] - queue events to be dispatched in a microtask.
     * If the state changes multiple times in the same microtask, only the last change will be dispatched.
     * If the most recent value is the same as the previous value, no event will be dispatched.
     * Set this to `false` to dispatch events immediately upon state changes.
     */
    static createCombinedChangeListener(states, callback, { callInstantlyWithCurrentState = false, queueEvents = true } = {}) {
        let changeEventMicrotaskQueued = false;
        const getState = () => states.map((state) => state.state);
        let lastDispatchState = getState();
        const dispatchEvent = (onlyIfChanged = true, includeLastState = true) => {
            const newState = getState();
            const previousState = lastDispatchState;
            if (onlyIfChanged &&
                newState.every((value, index) => value === previousState[index]))
                return;
            lastDispatchState = newState;
            try {
                callback(newState, includeLastState
                    ? previousState
                    : previousState.map(() => undefined));
            }
            catch (err) {
                console.error(err);
            }
        };
        const onChange = () => {
            if (changeEventMicrotaskQueued)
                return;
            if (!queueEvents)
                dispatchEvent();
            else {
                changeEventMicrotaskQueued = true;
                (globalThis.queueMicrotask || globalThis.setTimeout)(() => {
                    changeEventMicrotaskQueued = false;
                    dispatchEvent();
                });
            }
        };
        const handlers = states.map((state) => state.createChangeListener(onChange, false));
        if (callInstantlyWithCurrentState)
            dispatchEvent(false, false);
        return StateChangeListenerHandle._create(() => handlers.forEach((handler) => handler.dispose()));
    }
}
export class StateChangeListenerHandle {
    /** @internal */
    _dispose;
    constructor(dispose) {
        this._dispose = dispose;
        this.dispose = this.dispose.bind(this);
        this[Symbol.dispose] = this[Symbol.dispose].bind(this);
    }
    dispose() {
        if (this._dispose != null) {
            this._dispose();
            this._dispose = null;
        }
    }
    [Symbol.dispose]() {
        this.dispose();
    }
    get disposed() {
        return this._dispose == null;
    }
    /** @internal */
    static _create(dispose) {
        return new StateChangeListenerHandle(dispose);
    }
}
//# sourceMappingURL=State.js.map