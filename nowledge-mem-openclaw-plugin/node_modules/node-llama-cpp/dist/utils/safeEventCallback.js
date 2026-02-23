const safeCallbackSymbol = Symbol("safeCallback");
export function safeEventCallback(callback, message) {
    if (callback == null)
        return undefined;
    // do not wrap the callback if it's already wrapped
    if (callback?.[safeCallbackSymbol] === true)
        return callback;
    const res = (...args) => {
        try {
            const res = callback(...args);
            if (res instanceof Promise)
                res.catch((error) => {
                    if (message != null)
                        console.error(message, error);
                    else
                        console.error(error);
                });
        }
        catch (error) {
            if (message != null)
                console.error(message, error);
            else
                console.error(error);
        }
    };
    res[safeCallbackSymbol] = true;
    return res;
}
//# sourceMappingURL=safeEventCallback.js.map