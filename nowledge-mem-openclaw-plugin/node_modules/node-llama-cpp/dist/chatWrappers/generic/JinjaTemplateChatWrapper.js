import { Template } from "@huggingface/jinja";
import { splitText } from "lifecycle-utils";
import { SpecialToken, LlamaText, SpecialTokensText } from "../../utils/LlamaText.js";
import { ChatWrapper } from "../../ChatWrapper.js";
import { fromChatHistoryToIntermediateOpenAiMessages, fromIntermediateToCompleteOpenAiMessages } from "../../utils/OpenAIFormat.js";
import { removeUndefinedFields } from "../../utils/removeNullFields.js";
import { jsonDumps } from "../utils/jsonDumps.js";
import { tryMatrix } from "../../utils/optionsMatrix.js";
import { parseFunctionCallMessageTemplate } from "./utils/chatHistoryFunctionCallMessageTemplate.js";
import { templateSegmentOptionsToChatWrapperSettings } from "./utils/templateSegmentOptionsToChatWrapperSettings.js";
import { UniqueIdGenerator } from "./utils/UniqueIdGenerator.js";
import { extractFunctionCallSettingsFromJinjaTemplate } from "./utils/extractFunctionCallSettingsFromJinjaTemplate.js";
import { squashChatHistoryItems } from "./utils/squashChatHistoryItems.js";
import { extractSegmentSettingsFromTokenizerAndChatTemplate } from "./utils/extractSegmentSettingsFromTokenizerAndChatTemplate.js";
const defaultConvertUnsupportedSystemMessagesToUserMessagesFormat = {
    format: "### System message\n\n{{message}}\n\n----"
};
/**
 * A chat wrapper based on a Jinja template.
 * Useful for using the original model's Jinja template as-is without any additional conversion work to chat with a model.
 *
 * If you want to create a new chat wrapper from scratch, using this chat wrapper is not recommended, and instead you better inherit
 * from the `ChatWrapper` class and implement a custom chat wrapper of your own in TypeScript.
 *
 * For a simpler way to create a chat wrapper, see the `TemplateChatWrapper` class.
 * @example
 * <span v-pre>
 *
 * ```ts
 * import {JinjaTemplateChatWrapper} from "node-llama-cpp";
 *
 * const chatWrapper = new JinjaTemplateChatWrapper({
 *     template: "<Jinja template here>",
 *     // functionCallMessageTemplate: { // optional
 *     //     call: "[[call: {{functionName}}({{functionParams}})]]",
 *     //     result: " [[result: {{functionCallResult}}]]"
 *     // },
 *     // segments: {
 *     //     thoughtTemplate: "<think>{{content}}</think>",
 *     //     reopenThoughtAfterFunctionCalls: true
 *     // }
 * });
 * ```
 *
 * </span>
 */
export class JinjaTemplateChatWrapper extends ChatWrapper {
    wrapperName = "JinjaTemplate";
    settings;
    template;
    modelRoleName;
    userRoleName;
    systemRoleName;
    convertUnsupportedSystemMessagesToUserMessages;
    joinAdjacentMessagesOfTheSameType;
    trimLeadingWhitespaceInResponses;
    additionalRenderParameters;
    /** @internal */ _jinjaTemplate;
    /** @internal */ _usingJinjaFunctionCallTemplate = false;
    /** @internal */ _stringifyFunctionParams = false;
    /** @internal */ _stringifyFunctionResult = false;
    /** @internal */ _combineJinjaModelMessageAndToolCalls = true;
    /** @internal */ _endJinjaMessagesWithUserMessage = false;
    /**
     * @param options
     */
    constructor(options) {
        super();
        const { template, modelRoleName = "assistant", userRoleName = "user", systemRoleName = "system", convertUnsupportedSystemMessagesToUserMessages = defaultConvertUnsupportedSystemMessagesToUserMessagesFormat, functionCallMessageTemplate = "auto", joinAdjacentMessagesOfTheSameType = true, trimLeadingWhitespaceInResponses = true, additionalRenderParameters, segments, tokenizer, _requireFunctionCallSettingsExtraction = false } = options;
        if (template == null)
            throw new Error("template cannot be null");
        this.template = template;
        this.modelRoleName = modelRoleName;
        this.userRoleName = userRoleName;
        this.systemRoleName = systemRoleName;
        this.convertUnsupportedSystemMessagesToUserMessages =
            resolveConvertUnsupportedSystemMessagesToUserMessagesOption(convertUnsupportedSystemMessagesToUserMessages);
        this.joinAdjacentMessagesOfTheSameType = joinAdjacentMessagesOfTheSameType;
        this.trimLeadingWhitespaceInResponses = trimLeadingWhitespaceInResponses;
        this.additionalRenderParameters = additionalRenderParameters;
        if (this.convertUnsupportedSystemMessagesToUserMessages != null && !this.convertUnsupportedSystemMessagesToUserMessages.format.includes("{{message}}"))
            throw new Error('convertUnsupportedSystemMessagesToUserMessages format must include "{{message}}"');
        this._jinjaTemplate = new Template(this.template);
        this.settings = {
            ...ChatWrapper.defaultSettings,
            segments: templateSegmentOptionsToChatWrapperSettings(segments)
        };
        const { supportsSystemMessages, needsToEndJinjaMessagesWithUserMessage } = this._runSanityTest();
        this.settings = {
            ...this.settings,
            supportsSystemMessages,
            segments: {
                ...this.settings.segments,
                ...extractSegmentSettingsFromTokenizerAndChatTemplate(this.template, tokenizer)
            }
        };
        if (needsToEndJinjaMessagesWithUserMessage)
            this._endJinjaMessagesWithUserMessage = true;
        let functionCallSettings = parseFunctionCallMessageTemplate((functionCallMessageTemplate === "auto" || functionCallMessageTemplate === "noJinja")
            ? undefined
            : functionCallMessageTemplate);
        if (functionCallSettings == null && functionCallMessageTemplate !== "noJinja") {
            try {
                const idsGenerator = new UniqueIdGenerator(this.template + this.modelRoleName + this.userRoleName + this.systemRoleName +
                    (this.convertUnsupportedSystemMessagesToUserMessages?.format ?? ""));
                const extractedSettings = extractFunctionCallSettingsFromJinjaTemplate({
                    idsGenerator,
                    renderTemplate: ({ chatHistory, functions, additionalParams, stringifyFunctionParams, stringifyFunctionResults, combineModelMessageAndToolCalls, squashModelTextResponses = true }) => {
                        const render = (convertSystemMessagesToUserMessagesFormat, wipeFunctionCallIds) => {
                            const { messages: intermediateMessages, tools } = fromChatHistoryToIntermediateOpenAiMessages({
                                chatHistory: this._transformChatHistory(chatHistory, {
                                    convertSystemMessagesToUserMessagesFormat,
                                    joinAdjacentMessagesOfTheSameType: !squashModelTextResponses
                                        ? false
                                        : undefined
                                }).transformedHistory,
                                chatWrapperSettings: this.settings,
                                useRawValues: false,
                                functions,
                                stringifyFunctionParams,
                                stringifyFunctionResults,
                                combineModelMessageAndToolCalls,
                                squashModelTextResponses
                            });
                            const messages = fromIntermediateToCompleteOpenAiMessages(intermediateMessages)
                                .map((item) => {
                                if (!wipeFunctionCallIds)
                                    return item;
                                if (item.role === "assistant" && item["tool_calls"] != null && item["tool_calls"].length > 0) {
                                    for (const toolCall of item["tool_calls"]) {
                                        if (wipeFunctionCallIds === "align")
                                            toolCall.id = "fc_1_0001";
                                        else
                                            delete toolCall.id;
                                    }
                                }
                                else if (item.role === "tool") {
                                    if (wipeFunctionCallIds === "align")
                                        item["tool_call_id"] = "fc_1_0001";
                                    else
                                        delete item["tool_call_id"];
                                }
                                return item;
                            });
                            const lastJinjaItem = messages.at(-1);
                            let eraseRenderedJinjaFromId;
                            if (this._endJinjaMessagesWithUserMessage && lastJinjaItem?.role === this.modelRoleName &&
                                typeof lastJinjaItem.content === "string" &&
                                lastJinjaItem.content.length > 0 &&
                                (lastJinjaItem["tool_calls"] == null ||
                                    lastJinjaItem["tool_calls"]?.length === 0)) {
                                eraseRenderedJinjaFromId = lastJinjaItem.content;
                                messages.push({
                                    role: this.userRoleName,
                                    content: idsGenerator.generateId()
                                });
                            }
                            let res = this._jinjaTemplate.render({
                                ...(this.additionalRenderParameters == null
                                    ? {}
                                    : structuredClone(this.additionalRenderParameters)),
                                ...additionalParams,
                                messages,
                                ...removeUndefinedFields({ tools })
                            });
                            if (eraseRenderedJinjaFromId != null) {
                                const eraseIndex = res.lastIndexOf(eraseRenderedJinjaFromId);
                                if (eraseIndex >= 0)
                                    res = res.slice(0, eraseIndex + eraseRenderedJinjaFromId.length);
                            }
                            // attempt to remove the ID pattern from the output
                            if (wipeFunctionCallIds === "align")
                                res = res
                                    .replaceAll(/,\s*"(tool_call_id|call_id|id)":\s*"fc_1_0001"/g, "")
                                    .replaceAll(/"(tool_call_id|call_id|id)":\s*"fc_1_0001"\s*,/g, "");
                            return res;
                        };
                        return tryMatrix({
                            convertSystemMessagesToUserMessagesFormat: getConvertUnsupportedSystemMessagesToUserMessagesTryOptions(this.convertUnsupportedSystemMessagesToUserMessages),
                            wipeFunctionCallIds: [true, "align", false]
                        }, ({ convertSystemMessagesToUserMessagesFormat, wipeFunctionCallIds }) => {
                            return render(convertSystemMessagesToUserMessagesFormat, wipeFunctionCallIds);
                        });
                    }
                });
                functionCallSettings = extractedSettings.settings;
                if (functionCallSettings != null) {
                    this._usingJinjaFunctionCallTemplate = true;
                    this._stringifyFunctionParams = extractedSettings.stringifyParams;
                    this._stringifyFunctionResult = extractedSettings.stringifyResult;
                }
            }
            catch (err) {
                // do nothing
            }
            if (functionCallSettings == null && _requireFunctionCallSettingsExtraction)
                throw new Error("failed to extract function call settings from the Jinja template");
        }
        this.settings = {
            ...this.settings,
            functions: functionCallSettings ?? ChatWrapper.defaultSettings.functions
        };
    }
    /**
     * Whether the function call syntax settings were extracted from the given Jinja template.
     *
     * The function call syntax settings can be accessed using the `.settings.functions` property.
     */
    get usingJinjaFunctionCallTemplate() {
        return this._usingJinjaFunctionCallTemplate;
    }
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }) {
        const { contextText, stopGenerationTriggers, ignoreStartText, functionCall, transformedSystemMessagesToUserMessages } = this._generateContextState({
            chatHistory, availableFunctions, documentFunctionParams,
            endJinjaMessagesWithUserMessage: this._endJinjaMessagesWithUserMessage
        });
        return { contextText, stopGenerationTriggers, ignoreStartText, functionCall, transformedSystemMessagesToUserMessages };
    }
    addAvailableFunctionsSystemMessageToHistory(history, availableFunctions, options = {}) {
        if (this._usingJinjaFunctionCallTemplate)
            return history;
        return super.addAvailableFunctionsSystemMessageToHistory(history, availableFunctions, options);
    }
    generateFunctionCall(name, params) {
        if (!this._stringifyFunctionParams)
            return super.generateFunctionCall(name, params);
        const emptyCallParamsPlaceholder = this.settings.functions.call.emptyCallParamsPlaceholder;
        return LlamaText([
            this.settings.functions.call.prefix,
            name,
            this.settings.functions.call.paramsPrefix,
            (params === undefined
                ? (emptyCallParamsPlaceholder === undefined || emptyCallParamsPlaceholder === "")
                    ? ""
                    : JSON.stringify(jsonDumps(emptyCallParamsPlaceholder))
                : JSON.stringify(jsonDumps(params))),
            this.settings.functions.call.suffix
        ]);
    }
    generateFunctionCallResult(functionName, functionParams, result) {
        const resolveParameters = (text) => {
            return LlamaText(text)
                .mapValues((value) => {
                if (typeof value !== "string")
                    return value;
                const funcParamsText = functionParams === undefined
                    ? ""
                    : jsonDumps(functionParams);
                return value
                    .replaceAll("{{functionName}}", functionName)
                    .replaceAll("{{functionParams}}", (this._stringifyFunctionParams && funcParamsText !== "")
                    ? JSON.stringify(funcParamsText)
                    : funcParamsText);
            });
        };
        const resultText = result === undefined
            ? "void"
            : jsonDumps(result);
        return LlamaText([
            resolveParameters(this.settings.functions.result.prefix),
            ((this._stringifyFunctionResult && result !== undefined)
                ? JSON.stringify(resultText)
                : resultText),
            resolveParameters(this.settings.functions.result.suffix)
        ]);
    }
    /** @internal */
    _generateContextState({ chatHistory, availableFunctions, documentFunctionParams, endJinjaMessagesWithUserMessage }) {
        return tryMatrix({
            convertSystemMessagesToUserMessagesFormat: getConvertUnsupportedSystemMessagesToUserMessagesTryOptions(this.convertUnsupportedSystemMessagesToUserMessages),
            endJinjaMessagesWithUserMessage: endJinjaMessagesWithUserMessage == null
                ? [false, true]
                : [endJinjaMessagesWithUserMessage],
            useMessagesWithEmbeddedTools: this._usingJinjaFunctionCallTemplate
                ? [undefined, true]
                : [undefined]
        }, ({ useMessagesWithEmbeddedTools, endJinjaMessagesWithUserMessage, convertSystemMessagesToUserMessagesFormat }) => {
            return this._generateContextText(chatHistory, {
                convertSystemMessagesToUserMessagesFormat, availableFunctions, documentFunctionParams,
                endJinjaMessagesWithUserMessage,
                useMessagesWithEmbeddedTools
            });
        });
    }
    /** @internal */
    _transformChatHistory(history, { convertSystemMessagesToUserMessagesFormat, availableFunctions, documentFunctionParams = true, joinAdjacentMessagesOfTheSameType = this.joinAdjacentMessagesOfTheSameType }) {
        const historyWithFunctions = this.addAvailableFunctionsSystemMessageToHistory(history, availableFunctions, {
            documentParams: documentFunctionParams
        });
        let transformedSystemMessagesToUserMessages = false;
        const transformedHistory = convertSystemMessagesToUserMessagesFormat == null
            ? historyWithFunctions
            : historyWithFunctions.map((item) => {
                if (item.type === "system") {
                    transformedSystemMessagesToUserMessages = true;
                    return {
                        type: "user",
                        text: LlamaText.joinValues(LlamaText.fromJSON(item.text), convertSystemMessagesToUserMessagesFormat.split("{{message}}")).toString()
                    };
                }
                return item;
            });
        return {
            transformedHistory: joinAdjacentMessagesOfTheSameType
                ? squashChatHistoryItems(transformedHistory)
                : transformedHistory,
            transformedSystemMessagesToUserMessages
        };
    }
    /** @internal */
    _generateContextText(history, { convertSystemMessagesToUserMessagesFormat, availableFunctions, documentFunctionParams = true, endJinjaMessagesWithUserMessage, useMessagesWithEmbeddedTools = false }) {
        const { transformedSystemMessagesToUserMessages, transformedHistory } = this._transformChatHistory(history, { convertSystemMessagesToUserMessagesFormat, availableFunctions, documentFunctionParams });
        const generateMessagesWithEmbeddedTools = (chatHistory) => ({
            messages: chatHistory.map((item) => {
                if (item.type === "system")
                    return {
                        role: "system",
                        content: LlamaText.fromJSON(item.text)
                    };
                else if (item.type === "user")
                    return {
                        role: "user",
                        content: LlamaText(item.text)
                    };
                else if (item.type === "model")
                    return {
                        role: "assistant",
                        content: this.generateModelResponseText(item.response)
                    };
                void item;
                return { role: "user", content: LlamaText("") };
            }),
            tools: undefined
        });
        const generateMessagesWithTools = (chatHistory) => (fromChatHistoryToIntermediateOpenAiMessages({
            chatHistory,
            chatWrapperSettings: this.settings,
            useRawValues: false,
            functions: (availableFunctions != null && !documentFunctionParams)
                ? Object.fromEntries(Object.entries(availableFunctions)
                    .map(([funcName, { description, ...func }]) => [funcName, func]))
                : availableFunctions,
            stringifyFunctionParams: this._stringifyFunctionParams,
            stringifyFunctionResults: this._stringifyFunctionResult,
            combineModelMessageAndToolCalls: this._combineJinjaModelMessageAndToolCalls
        }));
        const lastItemIsModelMessage = transformedHistory.at(-1)?.type === "model";
        const { messages: intermediateMessages, tools } = this._usingJinjaFunctionCallTemplate
            ? useMessagesWithEmbeddedTools
                ? {
                    messages: generateMessagesWithEmbeddedTools(transformedHistory).messages,
                    tools: generateMessagesWithTools(transformedHistory).tools
                }
                : generateMessagesWithTools(transformedHistory)
            : generateMessagesWithEmbeddedTools(transformedHistory);
        const idsGenerator = new UniqueIdGenerator(this.template + this.modelRoleName + this.userRoleName + this.systemRoleName +
            (convertSystemMessagesToUserMessagesFormat ?? "") +
            intermediateMessages.map(({ content }) => (content?.toString() ?? "")).join("\n\n"));
        const jinjaItems = [];
        const jinjaRoleMap = {
            system: this.systemRoleName,
            user: this.userRoleName,
            assistant: this.modelRoleName,
            tool: "tool"
        };
        const idToContent = new Map();
        const modelMessageIds = new Set();
        const messageIds = new Set();
        for (const intermediateMessage of intermediateMessages) {
            if (intermediateMessage.content == null) {
                jinjaItems.push({
                    ...intermediateMessage,
                    role: jinjaRoleMap[intermediateMessage.role] ?? intermediateMessage.role
                });
                continue;
            }
            const id = idsGenerator.generateId(intermediateMessage.role === "tool");
            messageIds.add(id);
            idToContent.set(id, LlamaText(intermediateMessage.content));
            jinjaItems.push({
                ...intermediateMessage,
                role: jinjaRoleMap[intermediateMessage.role] ?? intermediateMessage.role,
                content: id
            });
            if (intermediateMessage.role === "assistant" || intermediateMessage.role === "tool")
                modelMessageIds.add(id);
        }
        const bosTokenId = idsGenerator.generateId();
        const eosTokenId = idsGenerator.generateId();
        const eotTokenId = idsGenerator.generateId();
        idToContent.set(bosTokenId, new SpecialToken("BOS"));
        idToContent.set(eosTokenId, new SpecialToken("EOS"));
        idToContent.set(eotTokenId, new SpecialToken("EOT"));
        const lastJinjaItem = jinjaItems.at(-1);
        let eraseRenderedJinjaFromId;
        if (endJinjaMessagesWithUserMessage && lastJinjaItem?.role === this.modelRoleName &&
            typeof lastJinjaItem.content === "string" &&
            lastJinjaItem.content.length > 0 &&
            (lastJinjaItem["tool_calls"] == null ||
                lastJinjaItem["tool_calls"]?.length === 0)) {
            eraseRenderedJinjaFromId = lastJinjaItem.content;
            jinjaItems.push({
                role: this.userRoleName,
                content: idsGenerator.generateId()
            });
        }
        const renderJinjaText = () => {
            let res = tryMatrix({
                options: [{}, { "add_generation_prompt": true }]
            }, ({ options }) => (this._jinjaTemplate.render({
                ...(this.additionalRenderParameters == null
                    ? {}
                    : structuredClone(this.additionalRenderParameters)),
                messages: jinjaItems,
                ...removeUndefinedFields({ tools }),
                "bos_token": bosTokenId,
                "eos_token": eosTokenId,
                "eot_token": eotTokenId,
                ...options
            })));
            if (eraseRenderedJinjaFromId != null) {
                const eraseIndex = res.lastIndexOf(eraseRenderedJinjaFromId);
                if (eraseIndex >= 0)
                    res = res.slice(0, eraseIndex + eraseRenderedJinjaFromId.length);
            }
            return res;
        };
        const validateThatAllMessageIdsAreUsed = (parts) => {
            const messageIdsLeft = new Set(messageIds);
            for (const part of parts) {
                if (typeof part === "string")
                    continue;
                messageIdsLeft.delete(part.separator);
            }
            if (messageIdsLeft.size !== 0)
                throw new Error("Some input messages are not present in the generated Jinja template output");
        };
        const renderJinjaAndSplitIntoParts = () => {
            const splitJinjaParts = splitText(renderJinjaText(), [...idToContent.keys()]);
            if (lastItemIsModelMessage) {
                let lastModelResponseIndex = -1;
                for (let i = splitJinjaParts.length - 1; i >= 0; i--) {
                    const part = splitJinjaParts[i];
                    if (part == null || typeof part === "string")
                        continue;
                    if (modelMessageIds.has(part.separator)) {
                        lastModelResponseIndex = i;
                        break;
                    }
                    else if (messageIds.has(part.separator)) {
                        validateThatAllMessageIdsAreUsed(splitJinjaParts);
                        throw new Error("Last message was expected to be a model message, but it was not");
                    }
                }
                if (lastModelResponseIndex < 0) {
                    validateThatAllMessageIdsAreUsed(splitJinjaParts);
                    throw new Error("A model message was expected to be the last message, but it was not found");
                }
                return {
                    splitJinjaParts: splitJinjaParts.slice(0, lastModelResponseIndex + 1),
                    stopGenerationJinjaParts: splitJinjaParts.slice(lastModelResponseIndex + 1)
                };
            }
            return {
                splitJinjaParts,
                stopGenerationJinjaParts: []
            };
        };
        const { splitJinjaParts, stopGenerationJinjaParts } = renderJinjaAndSplitIntoParts();
        const messageIdsLeftToProcess = new Set(messageIds);
        const contextText = LlamaText(splitJinjaParts.map((part) => {
            if (typeof part === "string")
                return new SpecialTokensText(part); // things that are not message content can be tokenized with special tokens
            const message = idToContent.get(part.separator);
            if (message == null)
                throw new Error(`Message with id "${part.separator}" not found`);
            messageIdsLeftToProcess.delete(part.separator);
            return message;
        }));
        if (messageIdsLeftToProcess.size !== 0)
            throw new Error("Some input messages are not present in the generated Jinja template output");
        return {
            contextText,
            ignoreStartText: !this.trimLeadingWhitespaceInResponses
                ? []
                : [
                    // ignore up to 4 leading spaces
                    ...Array(4).fill(0)
                        .map((_, index) => LlamaText(" ".repeat(index + 1))),
                    LlamaText("\t"),
                    LlamaText("\t\t"),
                    LlamaText("\t "),
                    LlamaText(" \t")
                ],
            stopGenerationTriggers: [
                LlamaText(new SpecialToken("EOS")),
                ...(stopGenerationJinjaParts.length === 0
                    ? []
                    : [
                        LlamaText(stopGenerationJinjaParts.map((part) => {
                            if (typeof part === "string")
                                return new SpecialTokensText(part);
                            const message = idToContent.get(part.separator);
                            if (message == null)
                                throw new Error(`Message with id "${part.separator}" not found`);
                            return message;
                        }))
                    ])
            ],
            transformedSystemMessagesToUserMessages,
            endJinjaMessagesWithUserMessage
        };
    }
    /**
     * Validate that this Jinja template can be rendered
     * @internal
     */
    _runSanityTest(needsToEndJinjaMessagesWithUserMessage = false) {
        try {
            let supportsSystemMessages = true;
            for (const chatHistory of chatHistoriesForSanityTest) {
                const { transformedSystemMessagesToUserMessages, endJinjaMessagesWithUserMessage: endedJinjaMessagesWithUserMessage } = this._generateContextState({
                    chatHistory,
                    endJinjaMessagesWithUserMessage: needsToEndJinjaMessagesWithUserMessage
                        ? true
                        : undefined
                });
                if (transformedSystemMessagesToUserMessages)
                    supportsSystemMessages = false;
                if (!needsToEndJinjaMessagesWithUserMessage && endedJinjaMessagesWithUserMessage) {
                    if (chatHistory !== chatHistoriesForSanityTest[0])
                        // validate tha this doesn't break the template
                        return this._runSanityTest(true);
                    else
                        needsToEndJinjaMessagesWithUserMessage = true;
                }
            }
            return { supportsSystemMessages, needsToEndJinjaMessagesWithUserMessage };
        }
        catch (err) {
            throw new Error("The provided Jinja template failed the sanity test: " + String(err) + ". Inspect the Jinja template to find out what went wrong");
        }
    }
}
function resolveConvertUnsupportedSystemMessagesToUserMessagesOption(convertUnsupportedSystemMessagesToUserMessages) {
    if (convertUnsupportedSystemMessagesToUserMessages === false)
        return undefined;
    if (convertUnsupportedSystemMessagesToUserMessages === true)
        return {
            ...defaultConvertUnsupportedSystemMessagesToUserMessagesFormat,
            use: "always"
        };
    if (convertUnsupportedSystemMessagesToUserMessages === "auto")
        return {
            ...defaultConvertUnsupportedSystemMessagesToUserMessagesFormat,
            use: "ifNeeded"
        };
    if (typeof convertUnsupportedSystemMessagesToUserMessages === "object")
        return {
            ...convertUnsupportedSystemMessagesToUserMessages,
            use: convertUnsupportedSystemMessagesToUserMessages.use ?? "ifNeeded"
        };
    return { ...defaultConvertUnsupportedSystemMessagesToUserMessagesFormat, use: "ifNeeded" };
}
function getConvertUnsupportedSystemMessagesToUserMessagesTryOptions(convertUnsupportedSystemMessagesToUserMessages) {
    if (convertUnsupportedSystemMessagesToUserMessages == null)
        return [undefined];
    else if (convertUnsupportedSystemMessagesToUserMessages.use === "always")
        return [convertUnsupportedSystemMessagesToUserMessages.format];
    return [undefined, convertUnsupportedSystemMessagesToUserMessages.format];
}
const chatHistoriesForSanityTest = [
    [{
            type: "system",
            text: "System message ~!@#$%^&*()\n*"
        }, {
            type: "user",
            text: "Message 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
        }, {
            type: "model",
            response: [""]
        }],
    [{
            type: "system",
            text: "System message ~!@#$%^&*()\n*"
        }, {
            type: "user",
            text: "Message 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
        }, {
            type: "model",
            response: ["Result 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"]
        }],
    [{
            type: "system",
            text: "System message ~!@#$%^&*()\n*"
        }, {
            type: "user",
            text: "Message 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
        }, {
            type: "model",
            response: ["Result 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"]
        }, {
            type: "user",
            text: "Message2 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
        }, {
            type: "model",
            response: [""]
        }],
    [{
            type: "system",
            text: "System message ~!@#$%^&*()\n*"
        }, {
            type: "user",
            text: "Message 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
        }, {
            type: "model",
            response: ["Result 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"]
        }, {
            type: "user",
            text: "Message2 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"
        }, {
            type: "model",
            response: ["Result2 1234567890!@#$%^&*()_+-=[]{}|\\:;\"',./<>?`~"]
        }]
];
//# sourceMappingURL=JinjaTemplateChatWrapper.js.map