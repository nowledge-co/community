import { AzureOpenAI } from "openai";
import { getEnvApiKey } from "../env-api-keys.js";
import { supportsXhigh } from "../models.js";
import { AssistantMessageEventStream } from "../utils/event-stream.js";
import { convertResponsesMessages, convertResponsesTools, processResponsesStream } from "./openai-responses-shared.js";
import { buildBaseOptions, clampReasoning } from "./simple-options.js";
const DEFAULT_AZURE_API_VERSION = "v1";
const AZURE_TOOL_CALL_PROVIDERS = new Set(["openai", "openai-codex", "opencode", "azure-openai-responses"]);
function parseDeploymentNameMap(value) {
    const map = new Map();
    if (!value)
        return map;
    for (const entry of value.split(",")) {
        const trimmed = entry.trim();
        if (!trimmed)
            continue;
        const [modelId, deploymentName] = trimmed.split("=", 2);
        if (!modelId || !deploymentName)
            continue;
        map.set(modelId.trim(), deploymentName.trim());
    }
    return map;
}
function resolveDeploymentName(model, options) {
    if (options?.azureDeploymentName) {
        return options.azureDeploymentName;
    }
    const mappedDeployment = parseDeploymentNameMap(process.env.AZURE_OPENAI_DEPLOYMENT_NAME_MAP).get(model.id);
    return mappedDeployment || model.id;
}
/**
 * Generate function for Azure OpenAI Responses API
 */
export const streamAzureOpenAIResponses = (model, context, options) => {
    const stream = new AssistantMessageEventStream();
    // Start async processing
    (async () => {
        const deploymentName = resolveDeploymentName(model, options);
        const output = {
            role: "assistant",
            content: [],
            api: "azure-openai-responses",
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
            // Create Azure OpenAI client
            const apiKey = options?.apiKey || getEnvApiKey(model.provider) || "";
            const client = createClient(model, apiKey, options);
            const params = buildParams(model, context, options, deploymentName);
            options?.onPayload?.(params);
            const openaiStream = await client.responses.create(params, options?.signal ? { signal: options.signal } : undefined);
            stream.push({ type: "start", partial: output });
            await processResponsesStream(openaiStream, output, stream, model);
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
            for (const block of output.content)
                delete block.index;
            output.stopReason = options?.signal?.aborted ? "aborted" : "error";
            output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            stream.push({ type: "error", reason: output.stopReason, error: output });
            stream.end();
        }
    })();
    return stream;
};
export const streamSimpleAzureOpenAIResponses = (model, context, options) => {
    const apiKey = options?.apiKey || getEnvApiKey(model.provider);
    if (!apiKey) {
        throw new Error(`No API key for provider: ${model.provider}`);
    }
    const base = buildBaseOptions(model, options, apiKey);
    const reasoningEffort = supportsXhigh(model) ? options?.reasoning : clampReasoning(options?.reasoning);
    return streamAzureOpenAIResponses(model, context, {
        ...base,
        reasoningEffort,
    });
};
function normalizeAzureBaseUrl(baseUrl) {
    return baseUrl.replace(/\/+$/, "");
}
function buildDefaultBaseUrl(resourceName) {
    return `https://${resourceName}.openai.azure.com/openai/v1`;
}
function resolveAzureConfig(model, options) {
    const apiVersion = options?.azureApiVersion || process.env.AZURE_OPENAI_API_VERSION || DEFAULT_AZURE_API_VERSION;
    const baseUrl = options?.azureBaseUrl?.trim() || process.env.AZURE_OPENAI_BASE_URL?.trim() || undefined;
    const resourceName = options?.azureResourceName || process.env.AZURE_OPENAI_RESOURCE_NAME;
    let resolvedBaseUrl = baseUrl;
    if (!resolvedBaseUrl && resourceName) {
        resolvedBaseUrl = buildDefaultBaseUrl(resourceName);
    }
    if (!resolvedBaseUrl && model.baseUrl) {
        resolvedBaseUrl = model.baseUrl;
    }
    if (!resolvedBaseUrl) {
        throw new Error("Azure OpenAI base URL is required. Set AZURE_OPENAI_BASE_URL or AZURE_OPENAI_RESOURCE_NAME, or pass azureBaseUrl, azureResourceName, or model.baseUrl.");
    }
    return {
        baseUrl: normalizeAzureBaseUrl(resolvedBaseUrl),
        apiVersion,
    };
}
function createClient(model, apiKey, options) {
    if (!apiKey) {
        if (!process.env.AZURE_OPENAI_API_KEY) {
            throw new Error("Azure OpenAI API key is required. Set AZURE_OPENAI_API_KEY environment variable or pass it as an argument.");
        }
        apiKey = process.env.AZURE_OPENAI_API_KEY;
    }
    const headers = { ...model.headers };
    if (options?.headers) {
        Object.assign(headers, options.headers);
    }
    const { baseUrl, apiVersion } = resolveAzureConfig(model, options);
    return new AzureOpenAI({
        apiKey,
        apiVersion,
        dangerouslyAllowBrowser: true,
        defaultHeaders: headers,
        baseURL: baseUrl,
    });
}
function buildParams(model, context, options, deploymentName) {
    const messages = convertResponsesMessages(model, context, AZURE_TOOL_CALL_PROVIDERS);
    const params = {
        model: deploymentName,
        input: messages,
        stream: true,
        prompt_cache_key: options?.sessionId,
    };
    if (options?.maxTokens) {
        params.max_output_tokens = options?.maxTokens;
    }
    if (options?.temperature !== undefined) {
        params.temperature = options?.temperature;
    }
    if (context.tools) {
        params.tools = convertResponsesTools(context.tools);
    }
    if (model.reasoning) {
        if (options?.reasoningEffort || options?.reasoningSummary) {
            params.reasoning = {
                effort: options?.reasoningEffort || "medium",
                summary: options?.reasoningSummary || "auto",
            };
            params.include = ["reasoning.encrypted_content"];
        }
        else {
            if (model.name.toLowerCase().startsWith("gpt-5")) {
                // Jesus Christ, see https://community.openai.com/t/need-reasoning-false-option-for-gpt-5/1351588/7
                messages.push({
                    role: "developer",
                    content: [
                        {
                            type: "input_text",
                            text: "# Juice: 0 !important",
                        },
                    ],
                });
            }
        }
    }
    return params;
}
//# sourceMappingURL=azure-openai-responses.js.map