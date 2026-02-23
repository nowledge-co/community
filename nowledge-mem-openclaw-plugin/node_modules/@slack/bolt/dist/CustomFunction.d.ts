import type { FunctionsCompleteErrorResponse, FunctionsCompleteSuccessResponse, WebClient } from '@slack/web-api';
import type { AllMiddlewareArgs, AnyMiddlewareArgs, Context, Middleware, SlackEventMiddlewareArgs, SlackEventMiddlewareArgsOptions } from './types';
interface FunctionCompleteArguments {
    outputs?: Record<string, any>;
}
export type FunctionCompleteFn = {
    (params?: FunctionCompleteArguments): Promise<FunctionsCompleteSuccessResponse>;
    /**
     * @description Check if this complete function has been called.
     */
    hasBeenCalled(): boolean;
};
interface FunctionFailArguments {
    error: string;
}
export type FunctionFailFn = {
    (params: FunctionFailArguments): Promise<FunctionsCompleteErrorResponse>;
    /**
     * @description Check if this fail function has been called.
     */
    hasBeenCalled(): boolean;
};
export type SlackCustomFunctionMiddlewareArgs = SlackEventMiddlewareArgs<'function_executed'>;
/** @deprecated use Middleware<SlackCustomFunctionMiddlewareArgs>[] instead - this may be removed in a minor release */
export type CustomFunctionMiddleware = Middleware<SlackCustomFunctionMiddlewareArgs>[];
/** @deprecated use SlackCustomFunctionMiddlewareArgs & AllMiddlewareArgs instead - this may be removed in a minor release */
export type AllCustomFunctionMiddlewareArgs<T extends SlackCustomFunctionMiddlewareArgs = SlackCustomFunctionMiddlewareArgs> = T & AllMiddlewareArgs;
export declare function matchCallbackId(callbackId: string): Middleware<SlackCustomFunctionMiddlewareArgs>;
/** Class */
export declare class CustomFunction {
    /** Function callback_id */
    callbackId: string;
    private listeners;
    private options;
    constructor(callbackId: string, listeners: Middleware<SlackCustomFunctionMiddlewareArgs>[], options: SlackEventMiddlewareArgsOptions);
    getListeners(): Middleware<AnyMiddlewareArgs>[];
}
/** Helper Functions */
export declare function validate(callbackId: string, middleware: Middleware<SlackCustomFunctionMiddlewareArgs>[]): void;
/**
 * Factory for `complete()` utility
 */
export declare function createFunctionComplete(context: Context, client: WebClient): FunctionCompleteFn;
/**
 * Factory for `fail()` utility
 */
export declare function createFunctionFail(context: Context, client: WebClient): FunctionFailFn;
export {};
//# sourceMappingURL=CustomFunction.d.ts.map