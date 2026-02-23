import { splitText } from "lifecycle-utils";
import { allSegmentTypes } from "../types.js";
import { jsonDumps } from "../chatWrappers/utils/jsonDumps.js";
import { TokenBias } from "../evaluator/TokenBias.js";
import { getChatWrapperSegmentDefinition } from "./getChatWrapperSegmentDefinition.js";
import { LlamaText } from "./LlamaText.js";
import { removeUndefinedFields } from "./removeNullFields.js";
// Note: this is a work in progress and is not yet complete.
// Will be exported through the main index.js file once this is complete and fully tested
export class OpenAIFormat {
    chatWrapper;
    constructor({ chatWrapper }) {
        this.chatWrapper = chatWrapper;
    }
    /**
     * Convert `node-llama-cpp`'s chat history to OpenAI format.
     *
     * Note that this conversion is lossy, as OpenAI's format is more limited than `node-llama-cpp`'s.
     */
    toOpenAiChat({ chatHistory, functionCalls, functions, useRawValues = true }) {
        const res = fromChatHistoryToIntermediateOpenAiMessages({
            chatHistory,
            chatWrapperSettings: this.chatWrapper.settings,
            functionCalls,
            functions,
            useRawValues
        });
        return {
            ...res,
            messages: fromIntermediateToCompleteOpenAiMessages(res.messages)
        };
    }
    async fromOpenAiChat(options, { llama, model } = {}) {
        const { messages, tools } = options;
        if ((options["response_format"]?.type === "json_schema" || options["response_format"]?.type === "json_object") &&
            tools != null && options["tool_choice"] !== "none")
            throw new Error("Using both JSON response format and tools is not supported yet");
        const { chatHistory, functionCalls: pendingFunctionCalls } = fromOpenAiMessagesToChatHistory({
            messages,
            chatWrapper: this.chatWrapper
        });
        const functions = {};
        for (const tool of tools ?? []) {
            functions[tool.function.name] = {
                description: tool.function.description,
                params: tool.function.parameters
            };
        }
        let tokenBias;
        if (options["logit_bias"] != null && model != null) {
            tokenBias = TokenBias.for(model);
            for (const [token, bias] of Object.entries(options["logit_bias"]))
                tokenBias.set(token, { logit: bias });
        }
        let grammar;
        if (options["response_format"]?.type === "json_schema" && llama != null) {
            const schema = options["response_format"]?.json_schema?.schema;
            if (schema != null)
                grammar = await llama.createGrammarForJsonSchema(schema);
            else
                grammar = await llama.getGrammarFor("json");
        }
        else if (options["response_format"]?.type === "json_object" && llama != null)
            grammar = await llama.getGrammarFor("json");
        return {
            chatHistory,
            functionCalls: pendingFunctionCalls,
            functions: Object.keys(functions).length === 0
                ? undefined
                : functions,
            tokenBias,
            maxTokens: options["max_completion_tokens"] ?? options["max_tokens"] ?? undefined,
            maxParallelFunctionCalls: options["parallel_tool_calls"] === false ? 1 : undefined,
            grammar,
            seed: options.seed ?? undefined,
            customStopTriggers: typeof options.stop === "string"
                ? [options.stop]
                : options.stop instanceof Array
                    ? options.stop.filter((item) => typeof item === "string")
                    : undefined,
            temperature: options.temperature ?? undefined,
            minP: options["min_p"] ?? undefined,
            topK: options["top_k"] ?? undefined,
            topP: options["top_p"] ?? undefined
        };
    }
}
export function fromIntermediateToCompleteOpenAiMessages(messages) {
    return messages.map((message) => {
        if (message.content != null && LlamaText.isLlamaText(message.content))
            return {
                ...message,
                content: message.content.toString()
            };
        return message;
    });
}
export function fromChatHistoryToIntermediateOpenAiMessages({ chatHistory, chatWrapperSettings, functionCalls, functions, useRawValues = true, combineModelMessageAndToolCalls = true, stringifyFunctionParams = true, stringifyFunctionResults = true, squashModelTextResponses = true }) {
    const messages = [];
    for (let i = 0; i < chatHistory.length; i++) {
        const item = chatHistory[i];
        if (item == null)
            continue;
        if (item.type === "system")
            messages.push({
                role: "system",
                content: LlamaText.fromJSON(item.text)
            });
        else if (item.type === "user")
            messages.push({
                role: "user",
                content: item.text
            });
        else if (item.type === "model") {
            let lastModelTextMessage = null;
            const segmentStack = [];
            let canUseLastAssistantMessage = squashModelTextResponses;
            const addResponseText = (text) => {
                const lastResItem = canUseLastAssistantMessage
                    ? messages.at(-1)
                    : undefined;
                if (lastResItem?.role === "assistant" && (lastResItem.tool_calls == null || lastResItem.tool_calls.length === 0)) {
                    if (lastResItem.content == null)
                        lastResItem.content = text;
                    else
                        lastResItem.content = LlamaText([lastResItem.content, text]);
                }
                else {
                    lastModelTextMessage = {
                        role: "assistant",
                        content: text
                    };
                    messages.push(lastModelTextMessage);
                    canUseLastAssistantMessage = true;
                }
            };
            for (let j = 0; j < item.response.length; j++) {
                const response = item.response[j];
                if (response == null)
                    continue;
                if (typeof response === "string")
                    addResponseText(response);
                else if (response.type === "segment") {
                    const segmentDefinition = getChatWrapperSegmentDefinition(chatWrapperSettings, response.segmentType);
                    if (response.raw != null && useRawValues)
                        addResponseText(LlamaText.fromJSON(response.raw));
                    else
                        addResponseText(LlamaText([
                            (segmentStack.length > 0 && segmentStack.at(-1) === response.segmentType)
                                ? ""
                                : segmentDefinition?.prefix ?? "",
                            response.text,
                            response.ended
                                ? (segmentDefinition?.suffix ?? "")
                                : ""
                        ]));
                    if (!response.ended && segmentStack.at(-1) !== response.segmentType)
                        segmentStack.push(response.segmentType);
                    else if (response.ended && segmentStack.at(-1) === response.segmentType) {
                        segmentStack.pop();
                        if (segmentStack.length === 0 && segmentDefinition?.suffix == null &&
                            chatWrapperSettings.segments?.closeAllSegments != null)
                            addResponseText(LlamaText(chatWrapperSettings.segments.closeAllSegments));
                    }
                }
                else if (response.type === "functionCall") {
                    const toolCallId = generateToolCallId(i, j);
                    if (lastModelTextMessage == null ||
                        (!combineModelMessageAndToolCalls && lastModelTextMessage.content != null && lastModelTextMessage.content !== "") ||
                        (response.startsNewChunk &&
                            lastModelTextMessage.tool_calls != null && lastModelTextMessage.tool_calls.length > 0)) {
                        lastModelTextMessage = {
                            role: "assistant"
                        };
                        messages.push(lastModelTextMessage);
                    }
                    lastModelTextMessage["tool_calls"] ||= [];
                    lastModelTextMessage["tool_calls"].push({
                        id: toolCallId,
                        type: "function",
                        function: {
                            name: response.name,
                            arguments: stringifyFunctionParams
                                ? response.params === undefined
                                    ? ""
                                    : jsonDumps(response.params)
                                : response.params
                        }
                    });
                    messages.push({
                        role: "tool",
                        "tool_call_id": toolCallId,
                        content: stringifyFunctionResults
                            ? response.result === undefined
                                ? ""
                                : jsonDumps(response.result)
                            : response.result
                    });
                }
            }
            addResponseText("");
        }
        else
            void item;
    }
    if (functionCalls != null && functionCalls.length > 0) {
        let modelMessage = messages.at(-1);
        const messageIndex = chatHistory.length - 1;
        const functionCallStartIndex = modelMessage?.role === "assistant"
            ? (modelMessage.tool_calls?.length ?? 0)
            : 0;
        if (modelMessage?.role !== "assistant" ||
            (!combineModelMessageAndToolCalls && modelMessage.content != null && modelMessage.content !== "")) {
            modelMessage = {
                role: "assistant"
            };
            messages.push(modelMessage);
        }
        modelMessage["tool_calls"] ||= [];
        for (let i = 0; i < functionCalls.length; i++) {
            const functionCall = functionCalls[i];
            if (functionCall == null)
                continue;
            const toolCallId = generateToolCallId(messageIndex, functionCallStartIndex + i);
            modelMessage["tool_calls"].push({
                id: toolCallId,
                type: "function",
                function: {
                    name: functionCall.functionName,
                    arguments: stringifyFunctionParams
                        ? functionCall.params === undefined
                            ? ""
                            : jsonDumps(functionCall.params)
                        : functionCall.params
                }
            });
        }
    }
    const tools = [];
    for (const [funcName, func] of Object.entries(functions ?? {}))
        tools.push({
            type: "function",
            function: {
                name: funcName,
                ...removeUndefinedFields({
                    description: func.description,
                    parameters: func.params
                })
            }
        });
    return removeUndefinedFields({
        messages,
        tools: tools.length > 0
            ? tools
            : undefined
    });
}
function fromOpenAiMessagesToChatHistory({ messages, chatWrapper }) {
    const chatHistory = [];
    const pendingFunctionCalls = [];
    const findToolCallResult = (startIndex, toolCallId, toolCallIndex) => {
        let foundToolIndex = 0;
        for (let i = startIndex; i < messages.length; i++) {
            const message = messages[i];
            if (message == null)
                continue;
            if (message.role === "user" || message.role === "assistant")
                break;
            if (message.role !== "tool")
                continue;
            if (toolCallId == null) {
                if (toolCallIndex === foundToolIndex)
                    return message;
                else if (foundToolIndex > foundToolIndex)
                    return undefined;
            }
            else if (message?.tool_call_id === toolCallId)
                return message;
            foundToolIndex++;
        }
        return undefined;
    };
    let lastUserOrAssistantMessageIndex = messages.length - 1;
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message == null)
            continue;
        if (message.role === "user" || message.role === "assistant") {
            lastUserOrAssistantMessageIndex = i;
            break;
        }
    }
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        if (message == null)
            continue;
        if (message.role === "system") {
            if (message.content != null)
                chatHistory.push({
                    type: "system",
                    text: LlamaText(resolveOpenAiText(message.content)).toJSON()
                });
        }
        else if (message.role === "user")
            chatHistory.push({
                type: "user",
                text: resolveOpenAiText(message.content) ?? ""
            });
        else if (message.role === "assistant") {
            const isLastAssistantMessage = i === lastUserOrAssistantMessageIndex;
            let chatItem = chatHistory.at(-1);
            if (chatItem?.type !== "model") {
                chatItem = {
                    type: "model",
                    response: []
                };
                chatHistory.push(chatItem);
            }
            const text = resolveOpenAiText(message.content);
            if (text != null && text !== "") {
                const segmentDefinitions = new Map();
                for (const segmentType of allSegmentTypes) {
                    const segmentDefinition = getChatWrapperSegmentDefinition(chatWrapper.settings, segmentType);
                    if (segmentDefinition != null)
                        segmentDefinitions.set(segmentType, {
                            prefix: LlamaText(segmentDefinition.prefix).toString(),
                            suffix: segmentDefinition.suffix != null
                                ? LlamaText(segmentDefinition.suffix).toString()
                                : undefined
                        });
                }
                const modelResponseSegments = segmentModelResponseText(text, {
                    segmentDefinitions,
                    closeAllSegments: chatWrapper.settings.segments?.closeAllSegments != null
                        ? LlamaText(chatWrapper.settings.segments.closeAllSegments).toString()
                        : undefined
                });
                for (const segment of modelResponseSegments) {
                    if (segment.type == null) {
                        if (typeof chatItem.response.at(-1) === "string")
                            chatItem.response[chatItem.response.length - 1] += segment.text;
                        else
                            chatItem.response.push(segment.text);
                    }
                    else
                        chatItem.response.push({
                            type: "segment",
                            segmentType: segment.type,
                            text: segment.text,
                            ended: segment.ended
                        });
                }
            }
            let toolCallIndex = 0;
            for (const toolCall of message.tool_calls ?? []) {
                const functionName = toolCall.function.name;
                const callParams = parseToolSerializedValue(toolCall.function.arguments);
                const toolCallResult = findToolCallResult(i + 1, toolCall.id, toolCallIndex);
                if (toolCallResult == null) {
                    pendingFunctionCalls.push({
                        functionName,
                        params: callParams,
                        raw: chatWrapper.generateFunctionCall(functionName, callParams).toJSON()
                    });
                }
                if (toolCallResult != null || !isLastAssistantMessage)
                    chatItem.response.push({
                        type: "functionCall",
                        name: functionName,
                        params: callParams,
                        result: parseToolSerializedValue(toolCallResult?.content),
                        startsNewChunk: toolCallIndex === 0
                            ? true
                            : undefined
                    });
                toolCallIndex++;
            }
        }
    }
    return {
        chatHistory,
        functionCalls: pendingFunctionCalls
    };
}
function generateToolCallId(messageIndex, callIndex) {
    const length = 9;
    const start = "fc_" + String(messageIndex) + "_";
    return start + String(callIndex).padStart(length - start.length, "0");
}
export function resolveOpenAiText(text) {
    if (typeof text === "string")
        return text;
    if (text instanceof Array)
        return text.map((item) => item?.text ?? "").join("");
    return null;
}
function parseToolSerializedValue(value) {
    const text = resolveOpenAiText(value);
    if (text == null || text === "")
        return undefined;
    try {
        return JSON.parse(text);
    }
    catch (err) {
        return text;
    }
}
function segmentModelResponseText(text, { segmentDefinitions, closeAllSegments }) {
    const separatorActions = new Map();
    for (const [segmentType, { prefix, suffix }] of segmentDefinitions) {
        separatorActions.set(prefix, { type: "prefix", segmentType });
        if (suffix != null)
            separatorActions.set(suffix, { type: "suffix", segmentType });
    }
    if (closeAllSegments != null)
        separatorActions.set(closeAllSegments, { type: "closeAll" });
    const textParts = splitText(text, [...separatorActions.keys()]);
    const segments = [];
    const stack = [];
    const stackSet = new Set();
    const pushTextToLastSegment = (text) => {
        const lastSegment = segments.at(-1);
        if (lastSegment != null && !lastSegment.ended)
            lastSegment.text += text;
        else
            segments.push({
                type: undefined,
                text,
                ended: false
            });
    };
    for (const item of textParts) {
        if (typeof item === "string" || !separatorActions.has(item.separator))
            pushTextToLastSegment(typeof item === "string"
                ? item
                : item.separator);
        else {
            const action = separatorActions.get(item.separator);
            if (action.type === "closeAll") {
                while (stack.length > 0) {
                    const segmentType = stack.pop();
                    stackSet.delete(segmentType);
                    const lastSegment = segments.at(-1);
                    if (lastSegment != null && lastSegment.type != undefined && lastSegment.type === segmentType)
                        lastSegment.ended = true;
                    else
                        segments.push({ type: segmentType, text: "", ended: true });
                }
            }
            else if (action.type === "prefix") {
                if (!stackSet.has(action.segmentType)) {
                    stack.push(action.segmentType);
                    stackSet.add(action.segmentType);
                    segments.push({ type: action.segmentType, text: "", ended: false });
                }
                else
                    pushTextToLastSegment(item.separator);
            }
            else if (action.type === "suffix") {
                const currentType = stack.at(-1);
                if (currentType != null && currentType === action.segmentType) {
                    const lastSegment = segments.at(-1);
                    if (lastSegment != null && lastSegment.type != null && lastSegment.type === action.segmentType) {
                        lastSegment.ended = true;
                        stack.pop();
                        stackSet.delete(action.segmentType);
                    }
                    else
                        segments.push({ type: action.segmentType, text: "", ended: true });
                }
                else {
                    const segmentTypeIndex = stack.lastIndexOf(action.segmentType);
                    if (segmentTypeIndex < 0)
                        pushTextToLastSegment(item.separator);
                    else {
                        for (let i = stack.length - 1; i >= segmentTypeIndex; i--) {
                            const segmentType = stack.pop();
                            stackSet.delete(segmentType);
                            segments.push({ type: segmentType, text: "", ended: true });
                        }
                    }
                }
            }
        }
    }
    return segments;
}
//# sourceMappingURL=OpenAIFormat.js.map