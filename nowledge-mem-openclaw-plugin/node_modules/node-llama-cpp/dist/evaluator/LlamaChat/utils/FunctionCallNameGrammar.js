import { LlamaGrammar } from "../../LlamaGrammar.js";
import { LlamaText } from "../../../utils/LlamaText.js";
import { GbnfGrammarGenerator } from "../../../utils/gbnfJson/GbnfGrammarGenerator.js";
import { GbnfGrammar } from "../../../utils/gbnfJson/terminals/GbnfGrammar.js";
import { GbnfOr } from "../../../utils/gbnfJson/terminals/GbnfOr.js";
import { GbnfVerbatimText } from "../../../utils/gbnfJson/terminals/GbnfVerbatimText.js";
import { LlamaFunctionCallValidationError } from "./LlamaFunctionCallValidationError.js";
export class FunctionCallNameGrammar extends LlamaGrammar {
    _functions;
    _chatWrapper;
    constructor(llama, functions, chatWrapper) {
        const grammar = getGbnfGrammarForFunctionName(functions, chatWrapper);
        super(llama, {
            grammar,
            stopGenerationTriggers: [LlamaText("\n")],
            trimWhitespaceSuffix: true
        });
        this._functions = functions;
        this._chatWrapper = chatWrapper;
        this._validateFunctions();
    }
    parseFunctionName(generatedFunctionName) {
        if (this._chatWrapper.settings.functions.call.optionalPrefixSpace && generatedFunctionName[0] === " ")
            generatedFunctionName = generatedFunctionName.slice(1);
        const newlineIndex = generatedFunctionName.indexOf("\n");
        const functionName = generatedFunctionName.slice(0, newlineIndex < 0
            ? generatedFunctionName.length
            : newlineIndex);
        if (!Object.hasOwn(this._functions, functionName))
            throw new LlamaFunctionCallValidationError(`Function name "${functionName}" is not in the supplied functions object`, this._functions, this._chatWrapper, generatedFunctionName);
        return functionName;
    }
    _validateFunctions() {
        for (const functionsName of Object.keys(this._functions)) {
            if (functionsName.includes(" ") || functionsName.includes("\n") || functionsName.includes("\t"))
                throw new Error(`Function name "${functionsName}" contains spaces, new lines or tabs`);
            else if (functionsName === "")
                throw new Error("Function name cannot be an empty string");
        }
    }
}
function getGbnfGrammarForFunctionName(functions, chatWrapper) {
    const grammarGenerator = new GbnfGrammarGenerator();
    const functionNameGrammars = [];
    for (const functionName of Object.keys(functions))
        functionNameGrammars.push(new GbnfVerbatimText(functionName));
    const callGrammar = new GbnfOr(functionNameGrammars);
    const rootTerminal = new GbnfGrammar([
        ...(chatWrapper.settings.functions.call.optionalPrefixSpace ? ["[ ]?"] : []),
        callGrammar.resolve(grammarGenerator)
    ]);
    const rootGrammar = rootTerminal.getGrammar();
    return grammarGenerator.generateGbnfFile(rootGrammar + " [\\n]");
}
//# sourceMappingURL=FunctionCallNameGrammar.js.map