"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = middleware;
const node_buffer_1 = require("node:buffer");
const exceptions_js_1 = require("./exceptions.js");
const Types = require("./types.js");
const validate_signature_js_1 = require("./validate-signature.js");
function isValidBody(body) {
    return (body && typeof body === "string") || node_buffer_1.Buffer.isBuffer(body);
}
const readRequestBody = async (req) => {
    var _a, e_1, _b, _c;
    const chunks = [];
    try {
        for (var _d = true, req_1 = __asyncValues(req), req_1_1; req_1_1 = await req_1.next(), _a = req_1_1.done, !_a; _d = true) {
            _c = req_1_1.value;
            _d = false;
            const chunk = _c;
            chunks.push(chunk);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_d && !_a && (_b = req_1.return)) await _b.call(req_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return node_buffer_1.Buffer.concat(chunks);
};
function middleware(config) {
    if (!config.channelSecret) {
        throw new Error("no channel secret");
    }
    const secret = config.channelSecret;
    const _middleware = async (req, res, next) => {
        // header names are lower-cased
        // https://nodejs.org/api/http.html#http_message_headers
        const signature = req.headers[Types.LINE_SIGNATURE_HTTP_HEADER_NAME];
        if (!signature) {
            next(new exceptions_js_1.SignatureValidationFailed("no signature"));
            return;
        }
        const body = await (async () => {
            if (isValidBody(req.rawBody)) {
                // rawBody is provided in Google Cloud Functions and others
                return req.rawBody;
            }
            else if (isValidBody(req.body)) {
                return req.body;
            }
            else {
                // body may not be parsed yet, parse it to a buffer
                const rawBody = await readRequestBody(req);
                if (isValidBody(rawBody)) {
                    return rawBody;
                }
                else {
                    throw new exceptions_js_1.JSONParseError("Invalid body", { raw: rawBody });
                }
            }
        })();
        const shouldSkipVerification = config.skipSignatureVerification && config.skipSignatureVerification();
        if (!shouldSkipVerification &&
            !(0, validate_signature_js_1.default)(body, secret, signature)) {
            next(new exceptions_js_1.SignatureValidationFailed("signature validation failed", {
                signature,
            }));
            return;
        }
        const strBody = node_buffer_1.Buffer.isBuffer(body) ? body.toString() : body;
        try {
            req.body = JSON.parse(strBody);
            next();
        }
        catch (err) {
            const { message } = err;
            next(new exceptions_js_1.JSONParseError(message, { raw: strBody }));
        }
    };
    return (req, res, next) => {
        _middleware(req, res, next).catch(next);
    };
}
//# sourceMappingURL=middleware.js.map