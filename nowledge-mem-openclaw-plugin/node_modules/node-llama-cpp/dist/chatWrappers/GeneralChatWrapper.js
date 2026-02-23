import { ChatWrapper } from "../ChatWrapper.js";
import { SpecialToken, LlamaText, SpecialTokensText } from "../utils/LlamaText.js";
/**
 * This chat wrapper is not safe against chat syntax injection attacks
 * ([learn more](https://node-llama-cpp.withcat.ai/guide/llama-text#input-safety-in-node-llama-cpp)).
 */
export class GeneralChatWrapper extends ChatWrapper {
    wrapperName = "General";
    /** @internal */ _userMessageTitle;
    /** @internal */ _modelResponseTitle;
    /** @internal */ _middleSystemMessageTitle;
    /** @internal */ _allowSpecialTokensInTitles;
    constructor({ userMessageTitle = "Human", modelResponseTitle = "Assistant", middleSystemMessageTitle = "System", allowSpecialTokensInTitles = false } = {}) {
        super();
        this._userMessageTitle = userMessageTitle;
        this._modelResponseTitle = modelResponseTitle;
        this._middleSystemMessageTitle = middleSystemMessageTitle;
        this._allowSpecialTokensInTitles = allowSpecialTokensInTitles;
    }
    get userMessageTitle() {
        return this._userMessageTitle;
    }
    get modelResponseTitle() {
        return this._modelResponseTitle;
    }
    get middleSystemMessageTitle() {
        return this._middleSystemMessageTitle;
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
                    system: LlamaText.joinValues("\n\n", systemTexts),
                    user: LlamaText.joinValues("\n\n", userTexts),
                    model: LlamaText.joinValues("\n\n", modelTexts)
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
                flush();
                currentAggregateFocus = null;
                userTexts.push(LlamaText(item.text));
            }
            else if (item.type === "model") {
                flush();
                currentAggregateFocus = null;
                modelTexts.push(this.generateModelResponseText(item.response));
            }
            else
                void item;
        }
        flush();
        const contextText = LlamaText(new SpecialToken("BOS"), resultItems.map(({ system, user, model }, index) => {
            const isFirstItem = index === 0;
            const isLastItem = index === resultItems.length - 1;
            return LlamaText([
                (system.values.length === 0)
                    ? LlamaText([])
                    : LlamaText([
                        isFirstItem
                            ? LlamaText([])
                            : SpecialTokensText.wrapIf(this._allowSpecialTokensInTitles, `### ${this._middleSystemMessageTitle}\n`),
                        system,
                        SpecialTokensText.wrapIf(this._allowSpecialTokensInTitles, "\n\n")
                    ]),
                (user.values.length === 0)
                    ? LlamaText([])
                    : LlamaText([
                        SpecialTokensText.wrapIf(this._allowSpecialTokensInTitles, `### ${this._userMessageTitle}\n`),
                        user,
                        SpecialTokensText.wrapIf(this._allowSpecialTokensInTitles, "\n\n")
                    ]),
                (model.values.length === 0 && !isLastItem)
                    ? LlamaText([])
                    : LlamaText([
                        SpecialTokensText.wrapIf(this._allowSpecialTokensInTitles, `### ${this._modelResponseTitle}\n`),
                        model,
                        isLastItem
                            ? LlamaText([])
                            : SpecialTokensText.wrapIf(this._allowSpecialTokensInTitles, "\n\n")
                    ])
            ]);
        }));
        return {
            contextText,
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                LlamaText(new SpecialTokensText("<end>")),
                LlamaText("<end>"),
                LlamaText(`### ${this._userMessageTitle}`),
                LlamaText(`\n### ${this._userMessageTitle}`),
                LlamaText(`\n\n### ${this._userMessageTitle}`),
                LlamaText(`### ${this._modelResponseTitle}`),
                LlamaText(`\n### ${this._modelResponseTitle}`),
                LlamaText(`\n\n### ${this._modelResponseTitle}`),
                LlamaText(`### ${this._middleSystemMessageTitle}`),
                LlamaText(`\n### ${this._middleSystemMessageTitle}`),
                LlamaText(`\n\n### ${this._middleSystemMessageTitle}`),
                ...(!this._allowSpecialTokensInTitles
                    ? []
                    : [
                        LlamaText(new SpecialTokensText(`### ${this._userMessageTitle}`)),
                        LlamaText(new SpecialTokensText(`\n### ${this._userMessageTitle}`)),
                        LlamaText(new SpecialTokensText(`\n\n### ${this._userMessageTitle}`)),
                        LlamaText(new SpecialTokensText(`### ${this._modelResponseTitle}`)),
                        LlamaText(new SpecialTokensText(`\n### ${this._modelResponseTitle}`)),
                        LlamaText(new SpecialTokensText(`\n\n### ${this._modelResponseTitle}`)),
                        LlamaText(new SpecialTokensText(`### ${this._middleSystemMessageTitle}`)),
                        LlamaText(new SpecialTokensText(`\n### ${this._middleSystemMessageTitle}`)),
                        LlamaText(new SpecialTokensText(`\n\n### ${this._middleSystemMessageTitle}`))
                    ])
            ]
        };
    }
    /** @internal */
    static _getOptionConfigurationsToTestIfCanSupersedeJinjaTemplate() {
        return [
            {},
            { allowSpecialTokensInTitles: true }
        ];
    }
}
//# sourceMappingURL=GeneralChatWrapper.js.map