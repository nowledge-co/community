import { ChatModelFunctions } from "../../types.js";
/**
 * Generate documentation about the functions that are available for a model to call.
 * Useful for generating a system message with information about the available functions as part of a chat wrapper.
 */
export declare class ChatModelFunctionsDocumentationGenerator {
    readonly chatModelFunctions?: ChatModelFunctions;
    readonly hasAnyFunctions: boolean;
    constructor(chatModelFunctions: ChatModelFunctions | undefined);
    /**
     * Example:
     * ```ts
     * // Retrieve the current date
     * function getDate();
     *
     * // Retrieve the current time
     * function getTime(params: {hours: "24" | "12", seconds: boolean});
     * ```
     * @param options
     * @param [options.documentParams] - Whether to document the parameters of the functions
     */
    getTypeScriptFunctionSignatures({ documentParams }?: {
        documentParams?: boolean;
    }): string;
    /**
     * Example:
     * ```ts
     * // Retrieve the current date
     * type getDate = () => any;
     *
     * // Retrieve the current time
     * type getTime = (_: {hours: "24" | "12", seconds: boolean}) => any;
     * ```
     * @param options
     * @param [options.documentParams] - Whether to document the parameters of the functions
     * @param [options.reservedFunctionNames] - Function names that are reserved and cannot be used
     */
    getTypeScriptFunctionTypes({ documentParams, reservedFunctionNames }?: {
        documentParams?: boolean;
        reservedFunctionNames?: string[];
    }): string;
    /**
     * Example:
     * ```
     * Use the function 'getDate' to: Retrieve the current date
     * {"name": "getDate", "description": "Retrieve the current date"}
     *
     * Use the function 'getTime' to: Retrieve the current time
     * {"name": "getTime", "description": "Retrieve the current time", "parameters": {"type": "object", "properties": {"hours": {"enum": ["24", "12"]}, "seconds": {"type": "boolean"}}}}
     * ```
     * @param options
     * @param [options.documentParams] - Whether to document the parameters of the functions
     */
    getLlama3_1FunctionSignatures({ documentParams }?: {
        documentParams?: boolean;
    }): string;
    /**
     * Example:
     * ```
     * {"name": "getDate", "description": "Retrieve the current date"}
     *
     * {"name": "getTime", "description": "Retrieve the current time", "parameters": {"type": "object", "properties": {"hours": {"enum": ["24", "12"]}, "seconds": {"type": "boolean"}}}}
     * ```
     * @param options
     * @param [options.documentParams] - Whether to document the parameters of the functions
     */
    getLlama3_2LightweightFunctionSignatures({ documentParams }?: {
        documentParams?: boolean;
    }): string;
    getQwenFunctionSignatures({ documentParams }?: {
        documentParams?: boolean;
    }): string;
    getSeedFunctionSignatures({ documentParams }?: {
        documentParams?: boolean;
    }): string;
}
