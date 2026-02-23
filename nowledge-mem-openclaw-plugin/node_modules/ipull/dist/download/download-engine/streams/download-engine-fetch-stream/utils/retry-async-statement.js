import retry from "async-retry";
export function promiseWithResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });
    return { promise, resolve: resolve, reject: reject };
}
function retryAsyncStatement(options) {
    const resolvers = promiseWithResolvers();
    const waitResolvers = promiseWithResolvers();
    const promiseWithRetry = retry(async () => {
        try {
            waitResolvers.resolve();
            Object.assign(waitResolvers, promiseWithResolvers());
            await resolvers.promise;
        }
        catch (error) {
            Object.assign(resolvers, promiseWithResolvers());
            throw error;
        }
    }, options);
    promiseWithRetry.catch((reason) => {
        waitResolvers.reject(reason);
    });
    promiseWithRetry.then((value) => {
        waitResolvers.resolve(value);
    });
    return {
        waitResolvers,
        resolvers
    };
}
export function retryAsyncStatementSimple(options) {
    const retryState = retryAsyncStatement(options);
    return (reason = new Error()) => {
        retryState.resolvers.reject(reason);
        return retryState.waitResolvers.promise;
    };
}
//# sourceMappingURL=retry-async-statement.js.map