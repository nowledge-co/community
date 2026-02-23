import { ChatModelFunctions } from "../../../types.js";
import { ChatWrapper } from "../../../ChatWrapper.js";
export declare class LlamaFunctionCallValidationError<const Functions extends ChatModelFunctions> extends Error {
    readonly functions: Functions;
    readonly chatWrapper: ChatWrapper;
    readonly callText: string;
    constructor(message: string, functions: Functions, chatWrapper: ChatWrapper, callText: string);
}
