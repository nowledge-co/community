export declare function concurrency<Value>(array: Value[], concurrencyCount: number, callback: (value: Value) => Promise<void>): Promise<void>;
