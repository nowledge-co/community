"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookCallback = webhookCallback;
const platform_node_js_1 = require("../platform.node.js");
const frameworks_js_1 = require("./frameworks.js");
const debugErr = (0, platform_node_js_1.debug)("grammy:error");
const callbackAdapter = (update, callback, header, unauthorized = () => callback('"unauthorized"')) => ({
    update: Promise.resolve(update),
    respond: callback,
    header,
    unauthorized,
});
const adapters = { ...frameworks_js_1.adapters, callback: callbackAdapter };
/**
 * Performs a constant-time comparison of two strings to prevent timing attacks.
 * This function always compares all bytes regardless of early differences,
 * ensuring the comparison time does not leak information about the secret.
 *
 * @param header The header value from the request (X-Telegram-Bot-Api-Secret-Token)
 * @param token The expected secret token configured for the webhook
 * @returns true if strings are equal, false otherwise
 */
function compareSecretToken(header, token) {
    // If no token is configured, accept all requests
    if (token === undefined) {
        return true;
    }
    // If token is configured but no header provided, reject
    if (header === undefined) {
        return false;
    }
    // Convert strings to Uint8Array for byte-by-byte comparison
    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(header);
    const tokenBytes = encoder.encode(token);
    // If lengths differ, reject
    if (headerBytes.length !== tokenBytes.length) {
        return false;
    }
    let hasDifference = 0;
    // Always iterate exactly tokenBytes.length times to prevent timing attacks
    // that could reveal the secret token's length. The loop time is constant
    // relative to the secret token length, not the attacker's input length.
    for (let i = 0; i < tokenBytes.length; i++) {
        // If header is shorter than token, pad with 0 for comparison
        const headerByte = i < headerBytes.length ? headerBytes[i] : 0;
        const tokenByte = tokenBytes[i];
        // If bytes differ, mark that we found a difference
        // Using bitwise OR to maintain constant-time (no short-circuit evaluation)
        hasDifference |= headerByte ^ tokenByte;
    }
    // Return true only if no differences were found
    return hasDifference === 0;
}
function webhookCallback(bot, adapter = platform_node_js_1.defaultAdapter, onTimeout, timeoutMilliseconds, secretToken) {
    if (bot.isRunning()) {
        throw new Error("Bot is already running via long polling, the webhook setup won't receive any updates!");
    }
    else {
        bot.start = () => {
            throw new Error("You already started the bot via webhooks, calling `bot.start()` starts the bot with long polling and this will prevent your webhook setup from receiving any updates!");
        };
    }
    const { onTimeout: timeout = "throw", timeoutMilliseconds: ms = 10000, secretToken: token, } = typeof onTimeout === "object"
        ? onTimeout
        : { onTimeout, timeoutMilliseconds, secretToken };
    let initialized = false;
    const server = typeof adapter === "string"
        ? adapters[adapter]
        : adapter;
    return async (...args) => {
        var _a;
        const handler = server(...args);
        if (!initialized) {
            // Will dedupe concurrently incoming calls from several updates
            await bot.init();
            initialized = true;
        }
        if (!compareSecretToken(handler.header, token)) {
            await handler.unauthorized();
            return handler.handlerReturn;
        }
        let usedWebhookReply = false;
        const webhookReplyEnvelope = {
            async send(json) {
                usedWebhookReply = true;
                await handler.respond(json);
            },
        };
        await timeoutIfNecessary(bot.handleUpdate(await handler.update, webhookReplyEnvelope), typeof timeout === "function" ? () => timeout(...args) : timeout, ms);
        if (!usedWebhookReply)
            (_a = handler.end) === null || _a === void 0 ? void 0 : _a.call(handler);
        return handler.handlerReturn;
    };
}
function timeoutIfNecessary(task, onTimeout, timeout) {
    if (timeout === Infinity)
        return task;
    return new Promise((resolve, reject) => {
        const handle = setTimeout(() => {
            debugErr(`Request timed out after ${timeout} ms`);
            if (onTimeout === "throw") {
                reject(new Error(`Request timed out after ${timeout} ms`));
            }
            else {
                if (typeof onTimeout === "function")
                    onTimeout();
                resolve();
            }
            const now = Date.now();
            task.finally(() => {
                const diff = Date.now() - now;
                debugErr(`Request completed ${diff} ms after timeout!`);
            });
        }, timeout);
        task.then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(handle));
    });
}
