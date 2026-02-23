import { LlamaGrammar } from "../../LlamaGrammar.js";
import { ChatModelFunctions } from "../../../types.js";
import { ChatWrapper } from "../../../ChatWrapper.js";
import { Llama } from "../../../bindings/Llama.js";
export declare class FunctionCallNameGrammar<const Functions extends ChatModelFunctions> extends LlamaGrammar {
    private readonly _functions;
    private readonly _chatWrapper;
    constructor(llama: Llama, functions: Functions, chatWrapper: ChatWrapper);
    parseFunctionName(generatedFunctionName: string): keyof Functions & string;
    private _validateFunctions;
}
