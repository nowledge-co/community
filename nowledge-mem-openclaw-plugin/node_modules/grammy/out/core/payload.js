"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiresFormDataUpload = requiresFormDataUpload;
exports.createJsonPayload = createJsonPayload;
exports.createFormDataPayload = createFormDataPayload;
const platform_node_js_1 = require("../platform.node.js");
const types_js_1 = require("../types.js");
// === Payload types (JSON vs. form data)
/**
 * Determines for a given payload if it may be sent as JSON, or if it has to be
 * uploaded via multipart/form-data. Returns `true` in the latter case and
 * `false` in the former.
 *
 * @param payload The payload to analyze
 */
function requiresFormDataUpload(payload) {
    return payload instanceof types_js_1.InputFile || (typeof payload === "object" &&
        payload !== null &&
        Object.values(payload).some((v) => Array.isArray(v)
            ? v.some(requiresFormDataUpload)
            : v instanceof types_js_1.InputFile || requiresFormDataUpload(v)));
}
/**
 * Calls `JSON.stringify` but removes `null` values from objects before
 * serialization
 *
 * @param value value
 * @returns stringified value
 */
function str(value) {
    return JSON.stringify(value, (_, v) => v !== null && v !== void 0 ? v : undefined);
}
/**
 * Turns a payload into an options object that can be passed to a `fetch` call
 * by setting the necessary headers and method. May only be called for payloads
 * `P` that let `requiresFormDataUpload(P)` return `false`.
 *
 * @param payload The payload to wrap
 */
function createJsonPayload(payload) {
    return {
        method: "POST",
        headers: {
            "content-type": "application/json",
            connection: "keep-alive",
        },
        body: str(payload),
    };
}
async function* protectItr(itr, onError) {
    try {
        yield* itr;
    }
    catch (err) {
        onError(err);
    }
}
/**
 * Turns a payload into an options object that can be passed to a `fetch` call
 * by setting the necessary headers and method. Note that this method creates a
 * multipart/form-data stream under the hood. If possible, a JSON payload should
 * be created instead for performance reasons.
 *
 * @param payload The payload to wrap
 */
function createFormDataPayload(payload, onError) {
    const boundary = createBoundary();
    const itr = payloadToMultipartItr(payload, boundary);
    const safeItr = protectItr(itr, onError);
    const stream = (0, platform_node_js_1.itrToStream)(safeItr);
    return {
        method: "POST",
        headers: {
            "content-type": `multipart/form-data; boundary=${boundary}`,
            connection: "keep-alive",
        },
        body: stream,
    };
}
// === Form data creation
function createBoundary() {
    // Taken from Deno std lib
    return "----------" + randomId(32);
}
function randomId(length = 16) {
    return Array.from(Array(length))
        .map(() => Math.random().toString(36)[2] || 0)
        .join("");
}
const enc = new TextEncoder();
/**
 * Takes a payload object and produces a valid multipart/form-data stream. The
 * stream is an iterator of `Uint8Array` objects. You also need to specify the
 * boundary string that was used in the Content-Type header of the HTTP request.
 *
 * @param payload a payload object
 * @param boundary the boundary string to use between the parts
 */
async function* payloadToMultipartItr(payload, boundary) {
    const files = collectFiles(payload);
    // Start multipart/form-data protocol
    yield enc.encode(`--${boundary}\r\n`);
    // Send all payload fields
    const separator = enc.encode(`\r\n--${boundary}\r\n`);
    let first = true;
    for (const [key, value] of Object.entries(payload)) {
        if (value == null)
            continue;
        if (!first)
            yield separator;
        yield valuePart(key, value instanceof types_js_1.InputFile
            ? value.toJSON()
            : typeof value === "object"
                ? str(value)
                : value);
        first = false;
    }
    // Send all files
    for (const { id, origin, file } of files) {
        if (!first)
            yield separator;
        yield* filePart(id, origin, file);
        first = false;
    }
    // End multipart/form-data protocol
    yield enc.encode(`\r\n--${boundary}--\r\n`);
}
/**
 * Installs a `toJSON` implementation on each instance of `InputFile` contained
 * in the payload. They return attach:// strings under which the respective
 * instances should be sent. The modified payload can now be serialized to JSON.
 *
 * Returns the list of discovered `InputFile` instances along with the random
 * identifiers that were used in the corresponding attach:// strings, as well as
 * the origin keys of the original payload object.
 *
 * @param value a payload object, or a part of it
 * @returns the discovered `InputFile` instances with identifiers and origins
 */
function collectFiles(value) {
    if (typeof value !== "object" || value === null)
        return [];
    return Object.entries(value).flatMap(([k, v]) => {
        if (Array.isArray(v))
            return v.flatMap((p) => collectFiles(p));
        else if (v instanceof types_js_1.InputFile) {
            const id = randomId();
            // Serialize `InputFile` instance with attach:// string
            Object.assign(v, { toJSON: () => `attach://${id}` });
            const origin = k === "media" &&
                "type" in value && typeof value.type === "string"
                ? value.type // use `type` for `InputMedia*`
                : k; // use property key otherwise
            return { id, origin, file: v };
        }
        else
            return collectFiles(v);
    });
}
/** Turns a regular value into a `Uint8Array` */
function valuePart(key, value) {
    return enc.encode(`content-disposition:form-data;name="${key}"\r\n\r\n${value}`);
}
/** Turns an InputFile into a generator of `Uint8Array`s */
async function* filePart(id, origin, input) {
    const filename = input.filename || `${origin}.${getExt(origin)}`;
    if (filename.includes("\r") || filename.includes("\n")) {
        throw new Error(`File paths cannot contain carriage-return (\\r) \
or newline (\\n) characters! Filename for property '${origin}' was:
"""
${filename}
"""`);
    }
    yield enc.encode(`content-disposition:form-data;name="${id}";filename=${filename}\r\ncontent-type:application/octet-stream\r\n\r\n`);
    const data = await input.toRaw();
    if (data instanceof Uint8Array)
        yield data;
    else
        yield* data;
}
/** Returns the default file extension for an API property name */
function getExt(key) {
    switch (key) {
        case "certificate":
            return "pem";
        case "photo":
        case "thumbnail":
            return "jpg";
        case "voice":
            return "ogg";
        case "audio":
            return "mp3";
        case "animation":
        case "video":
        case "video_note":
            return "mp4";
        case "sticker":
            return "webp";
        default:
            return "dat";
    }
}
