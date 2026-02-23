import { LlamaGrammar } from "../../LlamaGrammar.js";
import { LlamaText } from "../../../utils/LlamaText.js";
import { validateObjectAgainstGbnfSchema } from "../../../utils/gbnfJson/utils/validateObjectAgainstGbnfSchema.js";
import { GbnfGrammarGenerator } from "../../../utils/gbnfJson/GbnfGrammarGenerator.js";
import { getGbnfJsonTerminalForGbnfJsonSchema } from "../../../utils/gbnfJson/utils/getGbnfJsonTerminalForGbnfJsonSchema.js";
import { LlamaFunctionCallValidationError } from "./LlamaFunctionCallValidationError.js";
export class FunctionCallParamsGrammar extends LlamaGrammar {
    _functions;
    _chatWrapper;
    _functionName;
    _paramsSchema;
    constructor(llama, functions, chatWrapper, functionName, paramsSchema) {
        const grammar = getGbnfGrammarForFunctionParams(paramsSchema);
        super(llama, {
            grammar,
            stopGenerationTriggers: [LlamaText("\n".repeat(4))],
            trimWhitespaceSuffix: true
        });
        this._functions = functions;
        this._chatWrapper = chatWrapper;
        this._functionName = functionName;
        this._paramsSchema = paramsSchema;
    }
    parseParams(callText) {
        const endIndex = callText.lastIndexOf("\n".repeat(4));
        if (endIndex < 0)
            throw new LlamaFunctionCallValidationError(`Expected function call params for function "${this._functionName}" to end with stop generation trigger`, this._functions, this._chatWrapper, callText);
        const paramsString = callText.slice(0, endIndex);
        if (paramsString.trim().length === 0)
            throw new LlamaFunctionCallValidationError(`Expected function call params for function "${this._functionName}" to not be empty`, this._functions, this._chatWrapper, callText);
        const params = JSON.parse(paramsString);
        validateObjectAgainstGbnfSchema(params, this._paramsSchema);
        return {
            params: params, // prevent infinite TS type instantiation
            raw: paramsString
        };
    }
}
function getGbnfGrammarForFunctionParams(paramsSchema) {
    const grammarGenerator = new GbnfGrammarGenerator();
    const rootTerminal = getGbnfJsonTerminalForGbnfJsonSchema(paramsSchema, grammarGenerator);
    const rootGrammar = rootTerminal.resolve(grammarGenerator, true);
    return grammarGenerator.generateGbnfFile(rootGrammar + ` "${"\\n".repeat(4)}"`);
}
//# sourceMappingURL=FunctionCallParamsGrammar.js.map