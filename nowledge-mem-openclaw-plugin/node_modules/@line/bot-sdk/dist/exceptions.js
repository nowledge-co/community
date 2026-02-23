export class SignatureValidationFailed extends Error {
    signature;
    constructor(message, { signature } = {}) {
        super(message);
        this.name = this.constructor.name;
        Object.assign(this, { signature });
    }
}
export class JSONParseError extends Error {
    raw;
    constructor(message, { raw } = {}) {
        super(message);
        this.name = this.constructor.name;
        Object.assign(this, { raw });
    }
}
/* Deprecated */
export class RequestError extends Error {
    code;
    originalError;
    constructor(message, { code, originalError }) {
        super(message);
        this.name = this.constructor.name;
        Object.assign(this, { code, originalError });
    }
}
export class ReadError extends Error {
    originalError;
    constructor(message, { originalError }) {
        super(message);
        this.name = this.constructor.name;
        Object.assign(this, { originalError });
    }
}
export class HTTPError extends Error {
    statusCode;
    statusMessage;
    originalError;
    constructor(message, { statusCode, statusMessage, originalError }) {
        super(message);
        this.name = this.constructor.name;
        Object.assign(this, { statusCode, statusMessage, originalError });
    }
}
export class HTTPFetchError extends Error {
    status;
    statusText;
    headers;
    body;
    constructor(message, { status, statusText, headers, body }) {
        super(message);
        this.name = this.constructor.name;
        Object.assign(this, { status, statusText, headers, body });
    }
}
//# sourceMappingURL=exceptions.js.map