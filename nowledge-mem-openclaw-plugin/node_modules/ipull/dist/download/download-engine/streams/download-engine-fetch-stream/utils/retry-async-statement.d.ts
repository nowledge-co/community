import retry from "async-retry";
export declare function promiseWithResolvers<Resolve = void>(): {
    promise: Promise<Resolve>;
    resolve: (value: Resolve) => void;
    reject: (reason: unknown) => void;
};
export declare function retryAsyncStatementSimple(options?: retry.Options): (reason?: Error) => Promise<void>;
