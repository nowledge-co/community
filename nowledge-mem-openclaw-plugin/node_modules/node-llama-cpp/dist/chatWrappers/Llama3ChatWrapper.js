import { ChatWrapper } from "../ChatWrapper.js";
import { SpecialToken, LlamaText, SpecialTokensText } from "../utils/LlamaText.js";
import { ChatModelFunctionsDocumentationGenerator } from "./utils/ChatModelFunctionsDocumentationGenerator.js";
// source: https://github.com/meta-llama/llama-recipes/blob/79aa70442e97c3127e53c2d22c54438c32adcf5e/README.md
// source: https://llama.meta.com/docs/model-cards-and-prompt-formats/meta-llama-3/
export class Llama3ChatWrapper extends ChatWrapper {
    wrapperName = "Llama 3";
    settings;
    constructor({ parallelFunctionCalling = true } = {}) {
        super();
        if (parallelFunctionCalling)
            this.settings = {
                supportsSystemMessages: true,
                functions: {
                    call: {
                        optionalPrefixSpace: true,
                        prefix: "||call: ",
                        paramsPrefix: LlamaText(new SpecialTokensText("(")),
                        suffix: LlamaText(new SpecialTokensText(")"))
                    },
                    result: {
                        prefix: LlamaText(new SpecialTokensText("<|start_header_id|>function_call_result<|end_header_id|>\n\n")),
                        suffix: LlamaText(new SpecialTokensText("<|eot_id|>"))
                    },
                    parallelism: {
                        call: {
                            sectionPrefix: "",
                            betweenCalls: "\n",
                            sectionSuffix: LlamaText(new SpecialTokensText("<|eot_id|>"))
                        },
                        result: {
                            sectionPrefix: "",
                            betweenResults: "",
                            sectionSuffix: LlamaText(new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>\n\n"))
                        }
                    }
                }
            };
        else
            this.settings = {
                supportsSystemMessages: true,
                functions: {
                    call: {
                        optionalPrefixSpace: true,
                        prefix: "||call: ",
                        paramsPrefix: LlamaText(new SpecialTokensText("(")),
                        suffix: LlamaText(new SpecialTokensText(")"))
                    },
                    result: {
                        prefix: LlamaText([
                            LlamaText(new SpecialTokensText("<|eot_id|>")),
                            new SpecialTokensText("<|start_header_id|>function_call_result<|end_header_id|>\n\n")
                        ]),
                        suffix: LlamaText([
                            new SpecialTokensText("<|eot_id|>"),
                            new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>\n\n")
                        ])
                    }
                }
            };
    }
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }) {
        const historyWithFunctions = this.addAvailableFunctionsSystemMessageToHistory(chatHistory, availableFunctions, {
            documentParams: documentFunctionParams
        });
        const resultItems = [];
        let systemTexts = [];
        let userTexts = [];
        let modelTexts = [];
        let currentAggregateFocus = null;
        function flush() {
            if (systemTexts.length > 0 || userTexts.length > 0 || modelTexts.length > 0)
                resultItems.push({
                    system: systemTexts.length === 0
                        ? null
                        : LlamaText.joinValues("\n\n", systemTexts),
                    user: userTexts.length === 0
                        ? null
                        : LlamaText.joinValues("\n\n", userTexts),
                    model: modelTexts.length === 0
                        ? null
                        : LlamaText.joinValues("\n\n", modelTexts)
                });
            systemTexts = [];
            userTexts = [];
            modelTexts = [];
        }
        for (const item of historyWithFunctions) {
            if (item.type === "system") {
                if (currentAggregateFocus !== "system")
                    flush();
                currentAggregateFocus = "system";
                systemTexts.push(LlamaText.fromJSON(item.text));
            }
            else if (item.type === "user") {
                if (currentAggregateFocus !== "user")
                    flush();
                currentAggregateFocus = "user";
                userTexts.push(LlamaText(item.text));
            }
            else if (item.type === "model") {
                if (currentAggregateFocus !== "model")
                    flush();
                currentAggregateFocus = "model";
                modelTexts.push(this.generateModelResponseText(item.response));
            }
            else
                void item;
        }
        flush();
        const contextText = LlamaText(new SpecialToken("BOS"), resultItems.map((item, index) => {
            const isLastItem = index === resultItems.length - 1;
            const res = [];
            if (item.system != null) {
                res.push(LlamaText([
                    new SpecialTokensText("<|start_header_id|>system<|end_header_id|>\n\n"),
                    item.system,
                    new SpecialTokensText("<|eot_id|>")
                ]));
            }
            if (item.user != null) {
                res.push(LlamaText([
                    new SpecialTokensText("<|start_header_id|>user<|end_header_id|>\n\n"),
                    item.user,
                    new SpecialTokensText("<|eot_id|>")
                ]));
            }
            if (item.model != null) {
                res.push(LlamaText([
                    new SpecialTokensText("<|start_header_id|>assistant<|end_header_id|>\n\n"),
                    item.model,
                    isLastItem
                        ? LlamaText([])
                        : new SpecialTokensText("<|eot_id|>")
                ]));
            }
            return LlamaText(res);
        }));
        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText(new SpecialToken("EOT")),
                LlamaText(new SpecialTokensText("<|eot_id|>")),
                LlamaText(new SpecialTokensText("<|end_of_text|>")),
                LlamaText("<|eot_id|>"),
                LlamaText("<|end_of_text|>")
            ]
        };
    }
    generateAvailableFunctionsSystemText(availableFunctions, { documentParams = true }) {
        const functionsDocumentationGenerator = new ChatModelFunctionsDocumentationGenerator(availableFunctions);
        if (!functionsDocumentationGenerator.hasAnyFunctions)
            return LlamaText([]);
        return LlamaText.joinValues("\n", [
            "The assistant calls the provided functions as needed to retrieve information instead of relying on existing knowledge.",
            "To fulfill a request, the assistant calls relevant functions in advance when needed before responding to the request, and does not tell the user prior to calling a function.",
            "Provided functions:",
            "```typescript",
            functionsDocumentationGenerator.getTypeScriptFunctionSignatures({ documentParams }),
            "```",
            "",
            "Calling any of the provided functions can be done like this:",
            this.generateFunctionCall("getSomeInfo", { someKey: "someValue" }),
            "",
            "Note that the || prefix is mandatory.",
            "The assistant does not inform the user about using functions and does not explain anything before calling a function.",
            "After calling a function, the raw result appears afterwards and is not part of the conversation.",
            "To make information be part of the conversation, the assistant paraphrases and repeats the information without the function syntax."
        ]);
    }
}
//# sourceMappingURL=Llama3ChatWrapper.js.map