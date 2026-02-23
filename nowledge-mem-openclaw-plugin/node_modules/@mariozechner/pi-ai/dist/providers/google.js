import { GoogleGenAI, } from "@google/genai";
import { getEnvApiKey } from "../env-api-keys.js";
import { calculateCost } from "../models.js";
import { AssistantMessageEventStream } from "../utils/event-stream.js";
import { sanitizeSurrogates } from "../utils/sanitize-unicode.js";
import { convertMessages, convertTools, isThinkingPart, mapStopReason, mapToolChoice, retainThoughtSignature, } from "./google-shared.js";
import { buildBaseOptions, clampReasoning } from "./simple-options.js";
// Counter for generating unique tool call IDs
let toolCallCounter = 0;
export const streamGoogle = (model, context, options) => {
    const stream = new AssistantMessageEventStream();
    (async () => {
        const output = {
            role: "assistant",
            content: [],
            api: "google-generative-ai",
            provider: model.provider,
            model: model.id,
            usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            stopReason: "stop",
            timestamp: Date.now(),
        };
        try {
            const apiKey = options?.apiKey || getEnvApiKey(model.provider) || "";
            const client = createClient(model, apiKey, options?.headers);
            const params = buildParams(model, context, options);
            options?.onPayload?.(params);
            const googleStream = await client.models.generateContentStream(params);
            stream.push({ type: "start", partial: output });
            let currentBlock = null;
            const blocks = output.content;
            const blockIndex = () => blocks.length - 1;
            for await (const chunk of googleStream) {
                const candidate = chunk.candidates?.[0];
                if (candidate?.content?.parts) {
                    for (const part of candidate.content.parts) {
                        if (part.text !== undefined) {
                            const isThinking = isThinkingPart(part);
                            if (!currentBlock ||
                                (isThinking && currentBlock.type !== "thinking") ||
                                (!isThinking && currentBlock.type !== "text")) {
                                if (currentBlock) {
                                    if (currentBlock.type === "text") {
                                        stream.push({
                                            type: "text_end",
                                            contentIndex: blocks.length - 1,
                                            content: currentBlock.text,
                                            partial: output,
                                        });
                                    }
                                    else {
                                        stream.push({
                                            type: "thinking_end",
                                            contentIndex: blockIndex(),
                                            content: currentBlock.thinking,
                                            partial: output,
                                        });
                                    }
                                }
                                if (isThinking) {
                                    currentBlock = { type: "thinking", thinking: "", thinkingSignature: undefined };
                                    output.content.push(currentBlock);
                                    stream.push({ type: "thinking_start", contentIndex: blockIndex(), partial: output });
                                }
                                else {
                                    currentBlock = { type: "text", text: "" };
                                    output.content.push(currentBlock);
                                    stream.push({ type: "text_start", contentIndex: blockIndex(), partial: output });
                                }
                            }
                            if (currentBlock.type === "thinking") {
                                currentBlock.thinking += part.text;
                                currentBlock.thinkingSignature = retainThoughtSignature(currentBlock.thinkingSignature, part.thoughtSignature);
                                stream.push({
                                    type: "thinking_delta",
                                    contentIndex: blockIndex(),
                                    delta: part.text,
                                    partial: output,
                                });
                            }
                            else {
                                currentBlock.text += part.text;
                                currentBlock.textSignature = retainThoughtSignature(currentBlock.textSignature, part.thoughtSignature);
                                stream.push({
                                    type: "text_delta",
                                    contentIndex: blockIndex(),
                                    delta: part.text,
                                    partial: output,
                                });
                            }
                        }
                        if (part.functionCall) {
                            if (currentBlock) {
                                if (currentBlock.type === "text") {
                                    stream.push({
                                        type: "text_end",
                                        contentIndex: blockIndex(),
                                        content: currentBlock.text,
                                        partial: output,
                                    });
                                }
                                else {
                                    stream.push({
                                        type: "thinking_end",
                                        contentIndex: blockIndex(),
                                        content: currentBlock.thinking,
                                        partial: output,
                                    });
                                }
                                currentBlock = null;
                            }
                            // Generate unique ID if not provided or if it's a duplicate
                            const providedId = part.functionCall.id;
                            const needsNewId = !providedId || output.content.some((b) => b.type === "toolCall" && b.id === providedId);
                            const toolCallId = needsNewId
                                ? `${part.functionCall.name}_${Date.now()}_${++toolCallCounter}`
                                : providedId;
                            const toolCall = {
                                type: "toolCall",
                                id: toolCallId,
                                name: part.functionCall.name || "",
                                arguments: part.functionCall.args ?? {},
                                ...(part.thoughtSignature && { thoughtSignature: part.thoughtSignature }),
                            };
                            output.content.push(toolCall);
                            stream.push({ type: "toolcall_start", contentIndex: blockIndex(), partial: output });
                            stream.push({
                                type: "toolcall_delta",
                                contentIndex: blockIndex(),
                                delta: JSON.stringify(toolCall.arguments),
                                partial: output,
                            });
                            stream.push({ type: "toolcall_end", contentIndex: blockIndex(), toolCall, partial: output });
                        }
                    }
                }
                if (candidate?.finishReason) {
                    output.stopReason = mapStopReason(candidate.finishReason);
                    if (output.content.some((b) => b.type === "toolCall")) {
                        output.stopReason = "toolUse";
                    }
                }
                if (chunk.usageMetadata) {
                    output.usage = {
                        input: chunk.usageMetadata.promptTokenCount || 0,
                        output: (chunk.usageMetadata.candidatesTokenCount || 0) + (chunk.usageMetadata.thoughtsTokenCount || 0),
                        cacheRead: chunk.usageMetadata.cachedContentTokenCount || 0,
                        cacheWrite: 0,
                        totalTokens: chunk.usageMetadata.totalTokenCount || 0,
                        cost: {
                            input: 0,
                            output: 0,
                            cacheRead: 0,
                            cacheWrite: 0,
                            total: 0,
                        },
                    };
                    calculateCost(model, output.usage);
                }
            }
            if (currentBlock) {
                if (currentBlock.type === "text") {
                    stream.push({
                        type: "text_end",
                        contentIndex: blockIndex(),
                        content: currentBlock.text,
                        partial: output,
                    });
                }
                else {
                    stream.push({
                        type: "thinking_end",
                        contentIndex: blockIndex(),
                        content: currentBlock.thinking,
                        partial: output,
                    });
                }
            }
            if (options?.signal?.aborted) {
                throw new Error("Request was aborted");
            }
            if (output.stopReason === "aborted" || output.stopReason === "error") {
                throw new Error("An unknown error occurred");
            }
            stream.push({ type: "done", reason: output.stopReason, message: output });
            stream.end();
        }
        catch (error) {
            // Remove internal index property used during streaming
            for (const block of output.content) {
                if ("index" in block) {
                    delete block.index;
                }
            }
            output.stopReason = options?.signal?.aborted ? "aborted" : "error";
            output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            stream.push({ type: "error", reason: output.stopReason, error: output });
            stream.end();
        }
    })();
    return stream;
};
export const streamSimpleGoogle = (model, context, options) => {
    const apiKey = options?.apiKey || getEnvApiKey(model.provider);
    if (!apiKey) {
        throw new Error(`No API key for provider: ${model.provider}`);
    }
    const base = buildBaseOptions(model, options, apiKey);
    if (!options?.reasoning) {
        return streamGoogle(model, context, { ...base, thinking: { enabled: false } });
    }
    const effort = clampReasoning(options.reasoning);
    const googleModel = model;
    if (isGemini3ProModel(googleModel) || isGemini3FlashModel(googleModel)) {
        return streamGoogle(model, context, {
            ...base,
            thinking: {
                enabled: true,
                level: getGemini3ThinkingLevel(effort, googleModel),
            },
        });
    }
    return streamGoogle(model, context, {
        ...base,
        thinking: {
            enabled: true,
            budgetTokens: getGoogleBudget(googleModel, effort, options.thinkingBudgets),
        },
    });
};
function createClient(model, apiKey, optionsHeaders) {
    const httpOptions = {};
    if (model.baseUrl) {
        httpOptions.baseUrl = model.baseUrl;
        httpOptions.apiVersion = ""; // baseUrl already includes version path, don't append
    }
    if (model.headers || optionsHeaders) {
        httpOptions.headers = { ...model.headers, ...optionsHeaders };
    }
    return new GoogleGenAI({
        apiKey,
        httpOptions: Object.keys(httpOptions).length > 0 ? httpOptions : undefined,
    });
}
function buildParams(model, context, options = {}) {
    const contents = convertMessages(model, context);
    const generationConfig = {};
    if (options.temperature !== undefined) {
        generationConfig.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
        generationConfig.maxOutputTokens = options.maxTokens;
    }
    const config = {
        ...(Object.keys(generationConfig).length > 0 && generationConfig),
        ...(context.systemPrompt && { systemInstruction: sanitizeSurrogates(context.systemPrompt) }),
        ...(context.tools && context.tools.length > 0 && { tools: convertTools(context.tools) }),
    };
    if (context.tools && context.tools.length > 0 && options.toolChoice) {
        config.toolConfig = {
            functionCallingConfig: {
                mode: mapToolChoice(options.toolChoice),
            },
        };
    }
    else {
        config.toolConfig = undefined;
    }
    if (options.thinking?.enabled && model.reasoning) {
        const thinkingConfig = { includeThoughts: true };
        if (options.thinking.level !== undefined) {
            // Cast to any since our GoogleThinkingLevel mirrors Google's ThinkingLevel enum values
            thinkingConfig.thinkingLevel = options.thinking.level;
        }
        else if (options.thinking.budgetTokens !== undefined) {
            thinkingConfig.thinkingBudget = options.thinking.budgetTokens;
        }
        config.thinkingConfig = thinkingConfig;
    }
    if (options.signal) {
        if (options.signal.aborted) {
            throw new Error("Request aborted");
        }
        config.abortSignal = options.signal;
    }
    const params = {
        model: model.id,
        contents,
        config,
    };
    return params;
}
function isGemini3ProModel(model) {
    return model.id.includes("3-pro");
}
function isGemini3FlashModel(model) {
    return model.id.includes("3-flash");
}
function getGemini3ThinkingLevel(effort, model) {
    if (isGemini3ProModel(model)) {
        switch (effort) {
            case "minimal":
            case "low":
                return "LOW";
            case "medium":
            case "high":
                return "HIGH";
        }
    }
    switch (effort) {
        case "minimal":
            return "MINIMAL";
        case "low":
            return "LOW";
        case "medium":
            return "MEDIUM";
        case "high":
            return "HIGH";
    }
}
function getGoogleBudget(model, effort, customBudgets) {
    if (customBudgets?.[effort] !== undefined) {
        return customBudgets[effort];
    }
    if (model.id.includes("2.5-pro")) {
        const budgets = {
            minimal: 128,
            low: 2048,
            medium: 8192,
            high: 32768,
        };
        return budgets[effort];
    }
    if (model.id.includes("2.5-flash")) {
        const budgets = {
            minimal: 128,
            low: 2048,
            medium: 8192,
            high: 24576,
        };
        return budgets[effort];
    }
    return -1;
}
//# sourceMappingURL=google.js.map