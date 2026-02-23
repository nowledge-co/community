"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAdapter = exports.itrToStream = exports.debug = void 0;
exports.baseFetchConfig = baseFetchConfig;
// === Needed imports
const http_1 = require("http");
const https_1 = require("https");
const stream_1 = require("stream");
// === Export debug
var debug_1 = require("debug");
Object.defineProperty(exports, "debug", { enumerable: true, get: function () { return debug_1.debug; } });
// === Export system-specific operations
// Turn an AsyncIterable<Uint8Array> into a stream
const itrToStream = (itr) => stream_1.Readable.from(itr, { objectMode: false });
exports.itrToStream = itrToStream;
// === Base configuration for `fetch` calls
const httpAgents = new Map();
const httpsAgents = new Map();
function getCached(map, key, otherwise) {
    let value = map.get(key);
    if (value === undefined) {
        value = otherwise();
        map.set(key, value);
    }
    return value;
}
function baseFetchConfig(apiRoot) {
    if (apiRoot.startsWith("https:")) {
        return {
            compress: true,
            agent: getCached(httpsAgents, apiRoot, () => new https_1.Agent({ keepAlive: true })),
        };
    }
    else if (apiRoot.startsWith("http:")) {
        return {
            agent: getCached(httpAgents, apiRoot, () => new http_1.Agent({ keepAlive: true })),
        };
    }
    else
        return {};
}
// === Default webhook adapter
exports.defaultAdapter = "express";
