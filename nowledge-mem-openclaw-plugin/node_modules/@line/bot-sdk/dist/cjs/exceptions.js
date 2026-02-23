"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPFetchError = exports.HTTPError = exports.ReadError = exports.RequestError = exports.JSONParseError = exports.SignatureValidationFailed = void 0;
class SignatureValidationFailed extends Error {
    constructor(message, { signature } = {}) {
        super(message);
        this.name = this.constructor.name;
        Object.assign(this, { signature });
    }
}
exports.SignatureValidationFailed = SignatureValidationFailed;
class JSONParseError extends Error {
    constructor(message, { raw } = {}) {
        super(message);
        this.name = this.constructor.name;
        Object.assign(this, { raw });
    }
}
exports.JSONParseError = JSONParseError;
/* Deprecated */
class RequestError extends Error {
    constructor(message, { code, originalError }) {
        super(message);
        this.name = this.constructor.name;
        Object.assign(this, { code, originalError });
    }
}
exports.RequestError = RequestError;
class ReadError extends Error {
    constructor(message, { originalError }) {
        super(message);
        this.name = this.constructor.name;
        Object.assign(this, { originalError });
    }
}
exports.ReadError = ReadError;
class HTTPError extends Error {
    constructor(message, { statusCode, statusMessage, originalError }) {
        super(message);
        this.name = this.constructor.name;
        Object.assign(this, { statusCode, statusMessage, originalError });
    }
}
exports.HTTPError = HTTPError;
class HTTPFetchError extends Error {
    constructor(message, { status, statusText, headers, body }) {
        super(message);
        this.name = this.constructor.name;
        Object.assign(this, { status, statusText, headers, body });
    }
}
exports.HTTPFetchError = HTTPFetchError;
//# sourceMappingURL=exceptions.js.map