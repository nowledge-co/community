import { LlamaGrammar } from "../../LlamaGrammar.js";
import { ChatModelFunctions } from "../../../types.js";
import { ChatWrapper } from "../../../ChatWrapper.js";
import { Llama } from "../../../bindings/Llama.js";
import { GbnfJsonSchema } from "../../../utils/gbnfJson/types.js";
export declare class FunctionCallParamsGrammar<const Functions extends ChatModelFunctions> extends LlamaGrammar {
    private readonly _functions;
    private readonly _chatWrapper;
    private readonly _functionName;
    private readonly _paramsSchema;
    constructor(llama: Llama, functions: Functions, chatWrapper: ChatWrapper, functionName: string, paramsSchema: GbnfJsonSchema);
    parseParams(callText: string): {
        params: any;
        raw: string;
    };
}
