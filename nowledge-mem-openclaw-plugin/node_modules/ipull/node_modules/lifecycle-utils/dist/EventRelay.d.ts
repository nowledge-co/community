/**
 * A simple event relay.
 * Create a listener with `createListener` and dispatch events with `dispatchEvent`.
 * For each supported event type, create a new instance of `EventRelay` and expose it as a property.
 *
 * For example, this code:
 * ```ts
 * class MyClass {
 *     public readonly onSomethingHappened = new EventRelay<string>();
 *
 *     public doSomething(whatToDo: string) {
 *         this.onSomethingHappened.dispatchEvent(whatToDo);
 *         console.log("Done notifying listeners");
 *     }
 * }
 *
 * const myClass = new MyClass();
 * myClass.onSomethingHappened.createListener((whatHappened) => {
 *     console.log(`Something happened: ${whatHappened}`);
 * });
 * myClass.doSomething("eat a cookie");
 * ```
 *
 * Will print this:
 * ```
 * Something happened: eat a cookie
 * Done notifying listeners
 * ```
 */
export declare class EventRelay<T> {
    constructor();
    createListener(callback: ((data: T) => void)): EventRelayListenerHandle;
    createOnceListener(callback: ((data: T) => void)): EventRelayListenerHandle;
    dispatchEvent(data: T): void;
    clearListeners(): void;
    get listenerCount(): number;
    get disposed(): boolean;
    dispose(): void;
    [Symbol.dispose](): void;
}
export declare class EventRelayListenerHandle {
    private constructor();
    dispose(): void;
    [Symbol.dispose](): void;
    get disposed(): boolean;
}
