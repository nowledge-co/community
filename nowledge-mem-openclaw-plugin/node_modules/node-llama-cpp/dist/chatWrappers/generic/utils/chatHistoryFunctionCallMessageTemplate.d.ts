import { ChatWrapperSettings } from "../../../types.js";
export declare function parseFunctionCallMessageTemplate(template?: ChatHistoryFunctionCallMessageTemplate): ChatWrapperSettings["functions"] | null;
/**
 * Template format for how functions can be called by the model and how their results are fed to the model after function calls.
 *
 * Consists of an object with two properties:
 * 1. **`call`**: The function call template.
 * 2. **`result`**: The function call result template.
 *
 * For example:
 * ```ts
 * const template: ChatHistoryFunctionCallMessageTemplate = {
 *     call: "[[call: {{functionName}}({{functionParams}})]]",
 *     result: " [[result: {{functionCallResult}}]]"
 * };
 * ```
 *
 * It's mandatory for the call template to have text before <span v-pre>`{{functionName}}`</span> in order for the chat wrapper know when
 * to activate the function calling grammar.
 */
export type ChatHistoryFunctionCallMessageTemplate = {
    call: `${string}{{functionName}}${string}{{functionParams}}${string}`;
    result: `${string}{{functionCallResult}}${string}`;
};
