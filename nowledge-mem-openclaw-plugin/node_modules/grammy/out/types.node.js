"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputFile = void 0;
const fs_1 = require("fs");
const node_fetch_1 = require("node-fetch");
const path_1 = require("path");
const platform_node_1 = require("./platform.node");
const debug = (0, platform_node_1.debug)("grammy:warn");
// === Export all API types
__exportStar(require("@grammyjs/types"), exports);
// === InputFile handling and File augmenting
/**
 * An `InputFile` wraps a number of different sources for [sending
 * files](https://grammy.dev/guide/files#uploading-your-own-files).
 *
 * It corresponds to the `InputFile` type in the [Telegram Bot API
 * Reference](https://core.telegram.org/bots/api#inputfile).
 */
class InputFile {
    /**
     * Constructs an `InputFile` that can be used in the API to send files.
     *
     * @param file A path to a local file or a `Buffer` or a `fs.ReadStream` that specifies the file data
     * @param filename Optional name of the file
     */
    constructor(file, filename) {
        this.consumed = false;
        this.fileData = file;
        filename !== null && filename !== void 0 ? filename : (filename = this.guessFilename(file));
        this.filename = filename;
        if (typeof file === "string" &&
            (file.startsWith("http:") || file.startsWith("https:"))) {
            debug(`InputFile received the local file path '${file}' that looks like a URL. Is this a mistake?`);
        }
    }
    guessFilename(file) {
        if (typeof file === "string")
            return (0, path_1.basename)(file);
        if ("url" in file)
            return (0, path_1.basename)(file.url);
        if (!(file instanceof URL))
            return undefined;
        if (file.pathname !== "/") {
            const filename = (0, path_1.basename)(file.pathname);
            if (filename)
                return filename;
        }
        return (0, path_1.basename)(file.hostname);
    }
    /**
     * Internal method. Do not use.
     *
     * Converts this instance into a binary representation that can be sent to
     * the Bot API server in the request body.
     */
    async toRaw() {
        if (this.consumed) {
            throw new Error("Cannot reuse InputFile data source!");
        }
        const data = this.fileData;
        // Handle local files
        if (typeof data === "string")
            return (0, fs_1.createReadStream)(data);
        // Handle URLs and URLLike objects
        if (data instanceof URL) {
            return data.protocol === "file" // node-fetch does not support file URLs
                ? (0, fs_1.createReadStream)(data.pathname)
                : fetchFile(data);
        }
        if ("url" in data)
            return fetchFile(data.url);
        // Return buffers as-is
        if (data instanceof Uint8Array)
            return data;
        // Unwrap supplier functions
        if (typeof data === "function") {
            return new InputFile(await data()).toRaw();
        }
        // Mark streams and iterators as consumed and return them as-is
        this.consumed = true;
        return data;
    }
    toJSON() {
        throw new Error("InputFile instances must be sent via grammY");
    }
}
exports.InputFile = InputFile;
async function* fetchFile(url) {
    const { body } = await (0, node_fetch_1.default)(url);
    for await (const chunk of body) {
        if (typeof chunk === "string") {
            throw new Error(`Could not transfer file, received string data instead of bytes from '${url}'`);
        }
        yield chunk;
    }
}
