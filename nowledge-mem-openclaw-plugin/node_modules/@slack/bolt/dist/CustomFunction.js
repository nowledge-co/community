"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFunctionFail = exports.createFunctionComplete = exports.validate = exports.CustomFunction = exports.matchCallbackId = void 0;
const errors_1 = require("./errors");
const builtin_1 = require("./middleware/builtin");
/*
 * Middleware that matches a function callback ID
 */
function matchCallbackId(callbackId) {
    return async ({ payload, next }) => {
        if (payload.function.callback_id === callbackId) {
            await next();
        }
    };
}
exports.matchCallbackId = matchCallbackId;
/** Class */
class CustomFunction {
    /** Function callback_id */
    callbackId;
    listeners;
    options;
    constructor(callbackId, listeners, options) {
        validate(callbackId, listeners);
        this.callbackId = callbackId;
        this.listeners = listeners;
        this.options = options;
    }
    getListeners() {
        if (this.options.autoAcknowledge) {
            return [
                builtin_1.onlyEvents,
                (0, builtin_1.matchEventType)('function_executed'),
                matchCallbackId(this.callbackId),
                builtin_1.autoAcknowledge,
                ...this.listeners,
            ];
        }
        return [
            builtin_1.onlyEvents,
            (0, builtin_1.matchEventType)('function_executed'),
            matchCallbackId(this.callbackId),
            ...this.listeners,
        ]; // FIXME: workaround for TypeScript 4.7 breaking changes
    }
}
exports.CustomFunction = CustomFunction;
/** Helper Functions */
function validate(callbackId, middleware) {
    // Ensure callbackId is valid
    if (typeof callbackId !== 'string') {
        const errorMsg = 'CustomFunction expects a callback_id as the first argument';
        throw new errors_1.CustomFunctionInitializationError(errorMsg);
    }
    // Ensure middleware argument is either a function or an array
    if (typeof middleware !== 'function' && !Array.isArray(middleware)) {
        const errorMsg = 'CustomFunction expects a function or array of functions as the second argument';
        throw new errors_1.CustomFunctionInitializationError(errorMsg);
    }
    // Ensure array includes only functions
    if (Array.isArray(middleware)) {
        for (const fn of middleware) {
            if (!(fn instanceof Function)) {
                const errorMsg = 'All CustomFunction middleware must be functions';
                throw new errors_1.CustomFunctionInitializationError(errorMsg);
            }
        }
    }
}
exports.validate = validate;
/**
 * Factory for `complete()` utility
 */
function createFunctionComplete(context, client) {
    const { functionExecutionId } = context;
    if (!functionExecutionId) {
        const errorMsg = 'No function_execution_id found';
        throw new errors_1.CustomFunctionCompleteSuccessError(errorMsg);
    }
    let called = false;
    const complete = (params = {}) => {
        called = true;
        return client.functions.completeSuccess({
            outputs: params.outputs || {},
            function_execution_id: functionExecutionId,
        });
    };
    complete.hasBeenCalled = () => called;
    return complete;
}
exports.createFunctionComplete = createFunctionComplete;
/**
 * Factory for `fail()` utility
 */
function createFunctionFail(context, client) {
    const { functionExecutionId } = context;
    if (!functionExecutionId) {
        const errorMsg = 'No function_execution_id found';
        throw new errors_1.CustomFunctionCompleteFailError(errorMsg);
    }
    let called = false;
    const fail = (params) => {
        called = true;
        return client.functions.completeError({
            error: params.error,
            function_execution_id: functionExecutionId,
        });
    };
    fail.hasBeenCalled = () => called;
    return fail;
}
exports.createFunctionFail = createFunctionFail;
//# sourceMappingURL=CustomFunction.js.map