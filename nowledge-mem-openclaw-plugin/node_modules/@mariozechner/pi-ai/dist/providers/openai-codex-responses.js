// NEVER convert to top-level import - breaks browser/Vite builds (web-ui)
let _os = null;
if (typeof process !== "undefined" && (process.versions?.node || process.versions?.bun)) {
    import("node:os").then((m) => {
        _os = m;
    });
}
import { getEnvApiKey } from "../env-api-keys.js";
import { supportsXhigh } from "../models.js";
import { AssistantMessageEventStream } from "../utils/event-stream.js";
import { convertResponsesMessages, convertResponsesTools, processResponsesStream } from "./openai-responses-shared.js";
import { buildBaseOptions, clampReasoning } from "./simple-options.js";
// ============================================================================
// Configuration
// ============================================================================
const DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api";
const JWT_CLAIM_PATH = "https://api.openai.com/auth";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const CODEX_TOOL_CALL_PROVIDERS = new Set(["openai", "openai-codex", "opencode"]);
const CODEX_RESPONSE_STATUSES = new Set([
    "completed",
    "incomplete",
    "failed",
    "cancelled",
    "queued",
    "in_progress",
]);
// ============================================================================
// Retry Helpers
// ============================================================================
function isRetryableError(status, errorText) {
    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
        return true;
    }
    return /rate.?limit|overloaded|service.?unavailable|upstream.?connect|connection.?refused/i.test(errorText);
}
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new Error("Request was aborted"));
            return;
        }
        const timeout = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => {
            clearTimeout(timeout);
            reject(new Error("Request was aborted"));
        });
    });
}
// ============================================================================
// Main Stream Function
// ============================================================================
export const streamOpenAICodexResponses = (model, context, options) => {
    const stream = new AssistantMessageEventStream();
    (async () => {
        const output = {
            role: "assistant",
            content: [],
            api: "openai-codex-responses",
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
            if (!apiKey) {
                throw new Error(`No API key for provider: ${model.provider}`);
            }
            const accountId = extractAccountId(apiKey);
            const body = buildRequestBody(model, context, options);
            options?.onPayload?.(body);
            const headers = buildHeaders(model.headers, options?.headers, accountId, apiKey, options?.sessionId);
            const bodyJson = JSON.stringify(body);
            const transport = options?.transport || "sse";
            if (transport !== "sse") {
                let websocketStarted = false;
                try {
                    await processWebSocketStream(resolveCodexWebSocketUrl(model.baseUrl), body, headers, output, stream, model, () => {
                        websocketStarted = true;
                    }, options);
                    if (options?.signal?.aborted) {
                        throw new Error("Request was aborted");
                    }
                    stream.push({
                        type: "done",
                        reason: output.stopReason,
                        message: output,
                    });
                    stream.end();
                    return;
                }
                catch (error) {
                    if (transport === "websocket" || websocketStarted) {
                        throw error;
                    }
                }
            }
            // Fetch with retry logic for rate limits and transient errors
            let response;
            let lastError;
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                if (options?.signal?.aborted) {
                    throw new Error("Request was aborted");
                }
                try {
                    response = await fetch(resolveCodexUrl(model.baseUrl), {
                        method: "POST",
                        headers,
                        body: bodyJson,
                        signal: options?.signal,
                    });
                    if (response.ok) {
                        break;
                    }
                    const errorText = await response.text();
                    if (attempt < MAX_RETRIES && isRetryableError(response.status, errorText)) {
                        const delayMs = BASE_DELAY_MS * 2 ** attempt;
                        await sleep(delayMs, options?.signal);
                        continue;
                    }
                    // Parse error for friendly message on final attempt or non-retryable error
                    const fakeResponse = new Response(errorText, {
                        status: response.status,
                        statusText: response.statusText,
                    });
                    const info = await parseErrorResponse(fakeResponse);
                    throw new Error(info.friendlyMessage || info.message);
                }
                catch (error) {
                    if (error instanceof Error) {
                        if (error.name === "AbortError" || error.message === "Request was aborted") {
                            throw new Error("Request was aborted");
                        }
                    }
                    lastError = error instanceof Error ? error : new Error(String(error));
                    // Network errors are retryable
                    if (attempt < MAX_RETRIES && !lastError.message.includes("usage limit")) {
                        const delayMs = BASE_DELAY_MS * 2 ** attempt;
                        await sleep(delayMs, options?.signal);
                        continue;
                    }
                    throw lastError;
                }
            }
            if (!response?.ok) {
                throw lastError ?? new Error("Failed after retries");
            }
            if (!response.body) {
                throw new Error("No response body");
            }
            stream.push({ type: "start", partial: output });
            await processStream(response, output, stream, model);
            if (options?.signal?.aborted) {
                throw new Error("Request was aborted");
            }
            stream.push({ type: "done", reason: output.stopReason, message: output });
            stream.end();
        }
        catch (error) {
            output.stopReason = options?.signal?.aborted ? "aborted" : "error";
            output.errorMessage = error instanceof Error ? error.message : String(error);
            stream.push({ type: "error", reason: output.stopReason, error: output });
            stream.end();
        }
    })();
    return stream;
};
export const streamSimpleOpenAICodexResponses = (model, context, options) => {
    const apiKey = options?.apiKey || getEnvApiKey(model.provider);
    if (!apiKey) {
        throw new Error(`No API key for provider: ${model.provider}`);
    }
    const base = buildBaseOptions(model, options, apiKey);
    const reasoningEffort = supportsXhigh(model) ? options?.reasoning : clampReasoning(options?.reasoning);
    return streamOpenAICodexResponses(model, context, {
        ...base,
        reasoningEffort,
    });
};
// ============================================================================
// Request Building
// ============================================================================
function buildRequestBody(model, context, options) {
    const messages = convertResponsesMessages(model, context, CODEX_TOOL_CALL_PROVIDERS, {
        includeSystemPrompt: false,
    });
    const body = {
        model: model.id,
        store: false,
        stream: true,
        instructions: context.systemPrompt,
        input: messages,
        text: { verbosity: options?.textVerbosity || "medium" },
        include: ["reasoning.encrypted_content"],
        prompt_cache_key: options?.sessionId,
        tool_choice: "auto",
        parallel_tool_calls: true,
    };
    if (options?.temperature !== undefined) {
        body.temperature = options.temperature;
    }
    if (context.tools) {
        body.tools = convertResponsesTools(context.tools, { strict: null });
    }
    if (options?.reasoningEffort !== undefined) {
        body.reasoning = {
            effort: clampReasoningEffort(model.id, options.reasoningEffort),
            summary: options.reasoningSummary ?? "auto",
        };
    }
    return body;
}
function clampReasoningEffort(modelId, effort) {
    const id = modelId.includes("/") ? modelId.split("/").pop() : modelId;
    if ((id.startsWith("gpt-5.2") || id.startsWith("gpt-5.3")) && effort === "minimal")
        return "low";
    if (id === "gpt-5.1" && effort === "xhigh")
        return "high";
    if (id === "gpt-5.1-codex-mini")
        return effort === "high" || effort === "xhigh" ? "high" : "medium";
    return effort;
}
function resolveCodexUrl(baseUrl) {
    const raw = baseUrl && baseUrl.trim().length > 0 ? baseUrl : DEFAULT_CODEX_BASE_URL;
    const normalized = raw.replace(/\/+$/, "");
    if (normalized.endsWith("/codex/responses"))
        return normalized;
    if (normalized.endsWith("/codex"))
        return `${normalized}/responses`;
    return `${normalized}/codex/responses`;
}
function resolveCodexWebSocketUrl(baseUrl) {
    const url = new URL(resolveCodexUrl(baseUrl));
    if (url.protocol === "https:")
        url.protocol = "wss:";
    if (url.protocol === "http:")
        url.protocol = "ws:";
    return url.toString();
}
// ============================================================================
// Response Processing
// ============================================================================
async function processStream(response, output, stream, model) {
    await processResponsesStream(mapCodexEvents(parseSSE(response)), output, stream, model);
}
async function* mapCodexEvents(events) {
    for await (const event of events) {
        const type = typeof event.type === "string" ? event.type : undefined;
        if (!type)
            continue;
        if (type === "error") {
            const code = event.code || "";
            const message = event.message || "";
            throw new Error(`Codex error: ${message || code || JSON.stringify(event)}`);
        }
        if (type === "response.failed") {
            const msg = event.response?.error?.message;
            throw new Error(msg || "Codex response failed");
        }
        if (type === "response.done" || type === "response.completed") {
            const response = event.response;
            const normalizedResponse = response
                ? { ...response, status: normalizeCodexStatus(response.status) }
                : response;
            yield { ...event, type: "response.completed", response: normalizedResponse };
            continue;
        }
        yield event;
    }
}
function normalizeCodexStatus(status) {
    if (typeof status !== "string")
        return undefined;
    return CODEX_RESPONSE_STATUSES.has(status) ? status : undefined;
}
// ============================================================================
// SSE Parsing
// ============================================================================
async function* parseSSE(response) {
    if (!response.body)
        return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        let idx = buffer.indexOf("\n\n");
        while (idx !== -1) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLines = chunk
                .split("\n")
                .filter((l) => l.startsWith("data:"))
                .map((l) => l.slice(5).trim());
            if (dataLines.length > 0) {
                const data = dataLines.join("\n").trim();
                if (data && data !== "[DONE]") {
                    try {
                        yield JSON.parse(data);
                    }
                    catch { }
                }
            }
            idx = buffer.indexOf("\n\n");
        }
    }
}
// ============================================================================
// WebSocket Parsing
// ============================================================================
const OPENAI_BETA_RESPONSES_WEBSOCKETS = "responses_websockets=2026-02-06";
const SESSION_WEBSOCKET_CACHE_TTL_MS = 5 * 60 * 1000;
const websocketSessionCache = new Map();
function getWebSocketConstructor() {
    const ctor = globalThis.WebSocket;
    if (typeof ctor !== "function")
        return null;
    return ctor;
}
function headersToRecord(headers) {
    const out = {};
    for (const [key, value] of headers.entries()) {
        out[key] = value;
    }
    return out;
}
function getWebSocketReadyState(socket) {
    const readyState = socket.readyState;
    return typeof readyState === "number" ? readyState : undefined;
}
function isWebSocketReusable(socket) {
    const readyState = getWebSocketReadyState(socket);
    // If readyState is unavailable, assume the runtime keeps it open/reusable.
    return readyState === undefined || readyState === 1;
}
function closeWebSocketSilently(socket, code = 1000, reason = "done") {
    try {
        socket.close(code, reason);
    }
    catch { }
}
function scheduleSessionWebSocketExpiry(sessionId, entry) {
    if (entry.idleTimer) {
        clearTimeout(entry.idleTimer);
    }
    entry.idleTimer = setTimeout(() => {
        if (entry.busy)
            return;
        closeWebSocketSilently(entry.socket, 1000, "idle_timeout");
        websocketSessionCache.delete(sessionId);
    }, SESSION_WEBSOCKET_CACHE_TTL_MS);
}
async function connectWebSocket(url, headers, signal) {
    const WebSocketCtor = getWebSocketConstructor();
    if (!WebSocketCtor) {
        throw new Error("WebSocket transport is not available in this runtime");
    }
    const wsHeaders = headersToRecord(headers);
    wsHeaders["OpenAI-Beta"] = OPENAI_BETA_RESPONSES_WEBSOCKETS;
    return new Promise((resolve, reject) => {
        let settled = false;
        let socket;
        try {
            socket = new WebSocketCtor(url, { headers: wsHeaders });
        }
        catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
            return;
        }
        const onOpen = () => {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve(socket);
        };
        const onError = (event) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(extractWebSocketError(event));
        };
        const onClose = (event) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(extractWebSocketCloseError(event));
        };
        const onAbort = () => {
            if (settled)
                return;
            settled = true;
            cleanup();
            socket.close(1000, "aborted");
            reject(new Error("Request was aborted"));
        };
        const cleanup = () => {
            socket.removeEventListener("open", onOpen);
            socket.removeEventListener("error", onError);
            socket.removeEventListener("close", onClose);
            signal?.removeEventListener("abort", onAbort);
        };
        socket.addEventListener("open", onOpen);
        socket.addEventListener("error", onError);
        socket.addEventListener("close", onClose);
        signal?.addEventListener("abort", onAbort);
    });
}
async function acquireWebSocket(url, headers, sessionId, signal) {
    if (!sessionId) {
        const socket = await connectWebSocket(url, headers, signal);
        return {
            socket,
            release: ({ keep } = {}) => {
                if (keep === false) {
                    closeWebSocketSilently(socket);
                    return;
                }
                closeWebSocketSilently(socket);
            },
        };
    }
    const cached = websocketSessionCache.get(sessionId);
    if (cached) {
        if (cached.idleTimer) {
            clearTimeout(cached.idleTimer);
            cached.idleTimer = undefined;
        }
        if (!cached.busy && isWebSocketReusable(cached.socket)) {
            cached.busy = true;
            return {
                socket: cached.socket,
                release: ({ keep } = {}) => {
                    if (!keep || !isWebSocketReusable(cached.socket)) {
                        closeWebSocketSilently(cached.socket);
                        websocketSessionCache.delete(sessionId);
                        return;
                    }
                    cached.busy = false;
                    scheduleSessionWebSocketExpiry(sessionId, cached);
                },
            };
        }
        if (cached.busy) {
            const socket = await connectWebSocket(url, headers, signal);
            return {
                socket,
                release: () => {
                    closeWebSocketSilently(socket);
                },
            };
        }
        if (!isWebSocketReusable(cached.socket)) {
            closeWebSocketSilently(cached.socket);
            websocketSessionCache.delete(sessionId);
        }
    }
    const socket = await connectWebSocket(url, headers, signal);
    const entry = { socket, busy: true };
    websocketSessionCache.set(sessionId, entry);
    return {
        socket,
        release: ({ keep } = {}) => {
            if (!keep || !isWebSocketReusable(entry.socket)) {
                closeWebSocketSilently(entry.socket);
                if (entry.idleTimer)
                    clearTimeout(entry.idleTimer);
                if (websocketSessionCache.get(sessionId) === entry) {
                    websocketSessionCache.delete(sessionId);
                }
                return;
            }
            entry.busy = false;
            scheduleSessionWebSocketExpiry(sessionId, entry);
        },
    };
}
function extractWebSocketError(event) {
    if (event && typeof event === "object" && "message" in event) {
        const message = event.message;
        if (typeof message === "string" && message.length > 0) {
            return new Error(message);
        }
    }
    return new Error("WebSocket error");
}
function extractWebSocketCloseError(event) {
    if (event && typeof event === "object") {
        const code = "code" in event ? event.code : undefined;
        const reason = "reason" in event ? event.reason : undefined;
        const codeText = typeof code === "number" ? ` ${code}` : "";
        const reasonText = typeof reason === "string" && reason.length > 0 ? ` ${reason}` : "";
        return new Error(`WebSocket closed${codeText}${reasonText}`.trim());
    }
    return new Error("WebSocket closed");
}
async function decodeWebSocketData(data) {
    if (typeof data === "string")
        return data;
    if (data instanceof ArrayBuffer) {
        return new TextDecoder().decode(new Uint8Array(data));
    }
    if (ArrayBuffer.isView(data)) {
        const view = data;
        return new TextDecoder().decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    }
    if (data && typeof data === "object" && "arrayBuffer" in data) {
        const blobLike = data;
        const arrayBuffer = await blobLike.arrayBuffer();
        return new TextDecoder().decode(new Uint8Array(arrayBuffer));
    }
    return null;
}
async function* parseWebSocket(socket, signal) {
    const queue = [];
    let pending = null;
    let done = false;
    let failed = null;
    let sawCompletion = false;
    const wake = () => {
        if (!pending)
            return;
        const resolve = pending;
        pending = null;
        resolve();
    };
    const onMessage = (event) => {
        void (async () => {
            if (!event || typeof event !== "object" || !("data" in event))
                return;
            const text = await decodeWebSocketData(event.data);
            if (!text)
                return;
            try {
                const parsed = JSON.parse(text);
                const type = typeof parsed.type === "string" ? parsed.type : "";
                if (type === "response.completed" || type === "response.done") {
                    sawCompletion = true;
                    done = true;
                }
                queue.push(parsed);
                wake();
            }
            catch { }
        })();
    };
    const onError = (event) => {
        failed = extractWebSocketError(event);
        done = true;
        wake();
    };
    const onClose = (event) => {
        if (sawCompletion) {
            done = true;
            wake();
            return;
        }
        if (!failed) {
            failed = extractWebSocketCloseError(event);
        }
        done = true;
        wake();
    };
    const onAbort = () => {
        failed = new Error("Request was aborted");
        done = true;
        wake();
    };
    socket.addEventListener("message", onMessage);
    socket.addEventListener("error", onError);
    socket.addEventListener("close", onClose);
    signal?.addEventListener("abort", onAbort);
    try {
        while (true) {
            if (signal?.aborted) {
                throw new Error("Request was aborted");
            }
            if (queue.length > 0) {
                yield queue.shift();
                continue;
            }
            if (done)
                break;
            await new Promise((resolve) => {
                pending = resolve;
            });
        }
        if (failed) {
            throw failed;
        }
        if (!sawCompletion) {
            throw new Error("WebSocket stream closed before response.completed");
        }
    }
    finally {
        socket.removeEventListener("message", onMessage);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
        signal?.removeEventListener("abort", onAbort);
    }
}
async function processWebSocketStream(url, body, headers, output, stream, model, onStart, options) {
    const { socket, release } = await acquireWebSocket(url, headers, options?.sessionId, options?.signal);
    let keepConnection = true;
    try {
        socket.send(JSON.stringify({ type: "response.create", ...body }));
        onStart();
        stream.push({ type: "start", partial: output });
        await processResponsesStream(mapCodexEvents(parseWebSocket(socket, options?.signal)), output, stream, model);
        if (options?.signal?.aborted) {
            keepConnection = false;
        }
    }
    catch (error) {
        keepConnection = false;
        throw error;
    }
    finally {
        release({ keep: keepConnection });
    }
}
// ============================================================================
// Error Handling
// ============================================================================
async function parseErrorResponse(response) {
    const raw = await response.text();
    let message = raw || response.statusText || "Request failed";
    let friendlyMessage;
    try {
        const parsed = JSON.parse(raw);
        const err = parsed?.error;
        if (err) {
            const code = err.code || err.type || "";
            if (/usage_limit_reached|usage_not_included|rate_limit_exceeded/i.test(code) || response.status === 429) {
                const plan = err.plan_type ? ` (${err.plan_type.toLowerCase()} plan)` : "";
                const mins = err.resets_at
                    ? Math.max(0, Math.round((err.resets_at * 1000 - Date.now()) / 60000))
                    : undefined;
                const when = mins !== undefined ? ` Try again in ~${mins} min.` : "";
                friendlyMessage = `You have hit your ChatGPT usage limit${plan}.${when}`.trim();
            }
            message = err.message || friendlyMessage || message;
        }
    }
    catch { }
    return { message, friendlyMessage };
}
// ============================================================================
// Auth & Headers
// ============================================================================
function extractAccountId(token) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3)
            throw new Error("Invalid token");
        const payload = JSON.parse(atob(parts[1]));
        const accountId = payload?.[JWT_CLAIM_PATH]?.chatgpt_account_id;
        if (!accountId)
            throw new Error("No account ID in token");
        return accountId;
    }
    catch {
        throw new Error("Failed to extract accountId from token");
    }
}
function buildHeaders(initHeaders, additionalHeaders, accountId, token, sessionId) {
    const headers = new Headers(initHeaders);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("chatgpt-account-id", accountId);
    headers.set("OpenAI-Beta", "responses=experimental");
    headers.set("originator", "pi");
    const userAgent = _os ? `pi (${_os.platform()} ${_os.release()}; ${_os.arch()})` : "pi (browser)";
    headers.set("User-Agent", userAgent);
    headers.set("accept", "text/event-stream");
    headers.set("content-type", "application/json");
    for (const [key, value] of Object.entries(additionalHeaders || {})) {
        headers.set(key, value);
    }
    if (sessionId) {
        headers.set("session_id", sessionId);
    }
    return headers;
}
//# sourceMappingURL=openai-codex-responses.js.map