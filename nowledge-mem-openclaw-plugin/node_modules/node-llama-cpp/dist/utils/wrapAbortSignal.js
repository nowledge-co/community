export function wrapAbortSignal(abortSignal) {
    const controller = new AbortController();
    function onAbort() {
        controller.abort(abortSignal.reason);
    }
    function dispose() {
        if (abortSignal != null)
            abortSignal.removeEventListener("abort", onAbort);
    }
    if (abortSignal != null)
        abortSignal.addEventListener("abort", onAbort);
    return [controller, dispose];
}
//# sourceMappingURL=wrapAbortSignal.js.map