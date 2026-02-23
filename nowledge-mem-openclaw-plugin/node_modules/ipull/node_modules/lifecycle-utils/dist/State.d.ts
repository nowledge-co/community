/**
 * `State` is a utility class that allows you to hold a value and notify listeners when the value changes.
 */
export declare class State<T> {
    /**
     * @param defaultState
     * @param [options]
     * @param [options.queueEvents] - queue events to be dispatched in a microtask.
     * If the state changes multiple times in the same microtask, only the last change will be dispatched.
     * If the most recent value is the same as the previous value, no event will be dispatched.
     * Set this to `false` to dispatch events immediately upon state changes.
     */
    constructor(defaultState: T, { queueEvents }?: {
        queueEvents?: boolean | undefined;
    });
    get state(): T;
    set state(newState: T);
    createChangeListener(callback: ((state: T, lastValue?: T) => void), callInstantlyWithCurrentState?: boolean): StateChangeListenerHandle;
    clearChangeListeners(): void;
    get changeListenerCount(): number;
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
    static createCombinedChangeListener<const StatesObjects extends readonly State<any>[], const StateTypes = {
        -readonly [Index in keyof StatesObjects]: TypeOfState<StatesObjects[Index]>;
    }>(states: StatesObjects, callback: ((state: StateTypes, previousState: StateTypes | {
        -readonly [Index in keyof StatesObjects]: undefined;
    }) => void), { callInstantlyWithCurrentState, queueEvents }?: {
        callInstantlyWithCurrentState?: boolean;
        queueEvents?: boolean;
    }): StateChangeListenerHandle;
}
export declare class StateChangeListenerHandle {
    private constructor();
    dispose(): void;
    [Symbol.dispose](): void;
    get disposed(): boolean;
}
type TypeOfState<T extends State<any>> = T extends State<infer S> ? S : never;
export {};
