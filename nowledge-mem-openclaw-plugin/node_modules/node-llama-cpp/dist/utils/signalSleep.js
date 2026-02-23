export function signalSleep(delay, abortSignal) {
    return new Promise((accept, reject) => {
        if (abortSignal?.aborted)
            return void reject(abortSignal.reason);
        let timeout = undefined;
        function onAbort() {
            reject(abortSignal?.reason);
            clearTimeout(timeout);
            abortSignal?.removeEventListener("abort", onAbort);
        }
        function onTimeout() {
            accept();
            timeout = undefined;
            abortSignal?.removeEventListener("abort", onAbort);
        }
        abortSignal?.addEventListener("abort", onAbort);
        timeout = setTimeout(onTimeout, delay);
    });
}
//# sourceMappingURL=signalSleep.js.map