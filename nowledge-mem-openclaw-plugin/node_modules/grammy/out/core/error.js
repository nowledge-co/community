"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = exports.GrammyError = void 0;
exports.toGrammyError = toGrammyError;
exports.toHttpError = toHttpError;
const platform_node_js_1 = require("../platform.node.js");
const debug = (0, platform_node_js_1.debug)("grammy:warn");
/**
 * This class represents errors that are thrown by grammY because the Telegram
 * Bot API responded with an error.
 *
 * Instances of this class hold the information that the Telegram backend
 * returned.
 *
 * If this error is thrown, grammY could successfully communicate with the
 * Telegram Bot API servers, however, an error code was returned for the
 * respective method call.
 */
class GrammyError extends Error {
    constructor(message, err, 
    /** The called method name which caused this error to be thrown. */
    method, 
    /** The payload that was passed when calling the method. */
    payload) {
        var _a;
        super(`${message} (${err.error_code}: ${err.description})`);
        this.method = method;
        this.payload = payload;
        /** Flag that this request was unsuccessful. Always `false`. */
        this.ok = false;
        this.name = "GrammyError";
        this.error_code = err.error_code;
        this.description = err.description;
        this.parameters = (_a = err.parameters) !== null && _a !== void 0 ? _a : {};
    }
}
exports.GrammyError = GrammyError;
function toGrammyError(err, method, payload) {
    switch (err.error_code) {
        case 401:
            debug("Error 401 means that your bot token is wrong, talk to https://t.me/BotFather to check it.");
            break;
        case 409:
            debug("Error 409 means that you are running your bot several times on long polling. Consider revoking the bot token if you believe that no other instance is running.");
            break;
    }
    return new GrammyError(`Call to '${method}' failed!`, err, method, payload);
}
/**
 * This class represents errors that are thrown by grammY because an HTTP call
 * to the Telegram Bot API failed.
 *
 * Instances of this class hold the error object that was created because the
 * fetch call failed. It can be inspected to determine why exactly the network
 * request failed.
 *
 * If an [API transformer
 * function](https://grammy.dev/advanced/transformers) throws an error,
 * grammY will regard this as if the network request failed. The contained error
 * will then be the error that was thrown by the transformer function.
 */
class HttpError extends Error {
    constructor(message, 
    /** The thrown error object. */
    error) {
        super(message);
        this.error = error;
        this.name = "HttpError";
    }
}
exports.HttpError = HttpError;
function isTelegramError(err) {
    return (typeof err === "object" &&
        err !== null &&
        "status" in err &&
        "statusText" in err);
}
function toHttpError(method, sensitiveLogs) {
    return (err) => {
        let msg = `Network request for '${method}' failed!`;
        if (isTelegramError(err))
            msg += ` (${err.status}: ${err.statusText})`;
        if (sensitiveLogs && err instanceof Error)
            msg += ` ${err.message}`;
        throw new HttpError(msg, err);
    };
}
