"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function processMiddleware(middleware, initialArgs, context, client, logger, last) {
    let lastCalledMiddlewareIndex = -1;
    async function invokeMiddleware(toCallMiddlewareIndex) {
        if (lastCalledMiddlewareIndex >= toCallMiddlewareIndex) {
            // TODO: use a coded error
            throw Error('next() called multiple times');
        }
        if (toCallMiddlewareIndex < middleware.length) {
            lastCalledMiddlewareIndex = toCallMiddlewareIndex;
            return middleware[toCallMiddlewareIndex]({
                ...initialArgs,
                next: () => invokeMiddleware(toCallMiddlewareIndex + 1),
                context,
                client,
                logger,
            });
        }
        return last();
    }
    return invokeMiddleware(0);
}
exports.default = processMiddleware;
//# sourceMappingURL=process.js.map