"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultUnhandledRequestHandler = exports.defaultProcessEventErrorHandler = exports.defaultAsyncDispatchErrorHandler = exports.defaultDispatchErrorHandler = exports.buildContentResponse = exports.buildSSLCheckResponse = exports.buildUrlVerificationResponse = exports.buildNoBodyResponse = exports.bufferIncomingMessage = exports.getHeader = exports.isBufferedIncomingMessage = exports.parseAndVerifyHTTPRequest = exports.parseHTTPRequestBody = exports.extractRetryReasonFromHTTPRequest = exports.extractRetryNumFromHTTPRequest = void 0;
const node_querystring_1 = require("node:querystring");
const raw_body_1 = __importDefault(require("raw-body"));
const errors_1 = require("../errors");
const verify_request_1 = require("./verify-request");
const verifyErrorPrefix = 'Failed to verify authenticity';
const extractRetryNumFromHTTPRequest = (req) => {
    let retryNum;
    const retryNumHeaderValue = req.headers['x-slack-retry-num'];
    if (retryNumHeaderValue === undefined) {
        retryNum = undefined;
    }
    else if (typeof retryNumHeaderValue === 'string') {
        retryNum = Number.parseInt(retryNumHeaderValue, 10);
    }
    else if (Array.isArray(retryNumHeaderValue) && retryNumHeaderValue.length > 0) {
        retryNum = Number.parseInt(retryNumHeaderValue[0], 10);
    }
    return retryNum;
};
exports.extractRetryNumFromHTTPRequest = extractRetryNumFromHTTPRequest;
const extractRetryReasonFromHTTPRequest = (req) => {
    let retryReason;
    const retryReasonHeaderValue = req.headers['x-slack-retry-reason'];
    if (retryReasonHeaderValue === undefined) {
        retryReason = undefined;
    }
    else if (typeof retryReasonHeaderValue === 'string') {
        retryReason = retryReasonHeaderValue;
    }
    else if (Array.isArray(retryReasonHeaderValue) && retryReasonHeaderValue.length > 0) {
        retryReason = retryReasonHeaderValue[0];
    }
    return retryReason;
};
exports.extractRetryReasonFromHTTPRequest = extractRetryReasonFromHTTPRequest;
// ------------------------------------------
// HTTP request parsing and verification
// ------------------------------------------
// biome-ignore lint/suspicious/noExplicitAny: HTTP request bodies could be anything
const parseHTTPRequestBody = (req) => {
    const bodyAsString = req.rawBody.toString();
    const contentType = req.headers['content-type'];
    if (contentType === 'application/x-www-form-urlencoded') {
        const parsedQs = (0, node_querystring_1.parse)(bodyAsString);
        const { payload } = parsedQs;
        if (typeof payload === 'string') {
            return JSON.parse(payload);
        }
        return parsedQs;
    }
    return JSON.parse(bodyAsString);
};
exports.parseHTTPRequestBody = parseHTTPRequestBody;
const parseAndVerifyHTTPRequest = async (options, req, _res) => {
    const { signingSecret } = options;
    // Consume the readable stream (or use the previously consumed readable stream)
    const bufferedReq = await (0, exports.bufferIncomingMessage)(req);
    if (options.enabled !== undefined && !options.enabled) {
        // As the validation is disabled, immediately return the buffered request
        return bufferedReq;
    }
    const textBody = bufferedReq.rawBody.toString();
    const contentType = req.headers['content-type'];
    if (contentType === 'application/x-www-form-urlencoded') {
        // `ssl_check=1` requests do not require x-slack-signature verification
        const parsedQs = (0, node_querystring_1.parse)(textBody);
        if (parsedQs?.ssl_check) {
            return bufferedReq;
        }
    }
    // Find the relevant request headers
    const signature = (0, exports.getHeader)(req, 'x-slack-signature');
    const requestTimestampSec = Number((0, exports.getHeader)(req, 'x-slack-request-timestamp'));
    (0, verify_request_1.verifySlackRequest)({
        signingSecret,
        body: textBody,
        headers: {
            'x-slack-signature': signature,
            'x-slack-request-timestamp': requestTimestampSec,
        },
        logger: options.logger,
    });
    // Checks have passed! Return the value that has a side effect (the buffered request)
    return bufferedReq;
};
exports.parseAndVerifyHTTPRequest = parseAndVerifyHTTPRequest;
const isBufferedIncomingMessage = (req) => {
    // TODO: why are we casting the argument if we're using this as a type guard?
    return Buffer.isBuffer(req.rawBody);
};
exports.isBufferedIncomingMessage = isBufferedIncomingMessage;
const getHeader = (req, header) => {
    const value = req.headers[header];
    if (value === undefined || Array.isArray(value)) {
        throw new Error(`${verifyErrorPrefix}: header ${header} did not have the expected type (received ${typeof value}, expected string)`);
    }
    return value;
};
exports.getHeader = getHeader;
const bufferIncomingMessage = async (req) => {
    if ((0, exports.isBufferedIncomingMessage)(req)) {
        return req;
    }
    const bufferedRequest = req;
    bufferedRequest.rawBody = await (0, raw_body_1.default)(req);
    return bufferedRequest;
};
exports.bufferIncomingMessage = bufferIncomingMessage;
// ------------------------------------------
// HTTP response builder methods
// ------------------------------------------
const buildNoBodyResponse = (res, status) => {
    res.writeHead(status);
    res.end();
};
exports.buildNoBodyResponse = buildNoBodyResponse;
// biome-ignore lint/suspicious/noExplicitAny: HTTP request bodies could be anything
const buildUrlVerificationResponse = (res, body) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ challenge: body.challenge }));
};
exports.buildUrlVerificationResponse = buildUrlVerificationResponse;
const buildSSLCheckResponse = (res) => {
    res.writeHead(200);
    res.end();
};
exports.buildSSLCheckResponse = buildSSLCheckResponse;
// biome-ignore lint/suspicious/noExplicitAny: HTTP request bodies could be anything
const buildContentResponse = (res, body) => {
    if (!body) {
        res.writeHead(200);
        res.end();
    }
    else if (typeof body === 'string') {
        res.writeHead(200);
        res.end(body);
    }
    else {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
    }
};
exports.buildContentResponse = buildContentResponse;
// ------------------------------------------
// Error handlers for event processing
// ------------------------------------------
// The default dispatchErrorHandler implementation:
// Developers can customize this behavior by passing dispatchErrorHandler to the constructor
// Note that it was not possible to make this function async due to the limitation of http module
const defaultDispatchErrorHandler = (args) => {
    const { error, logger, request, response } = args;
    if ('code' in error) {
        if (error.code === errors_1.ErrorCode.HTTPReceiverDeferredRequestError) {
            logger.info(`Unhandled HTTP request (${request.method}) made to ${request.url}`);
            response.writeHead(404);
            response.end();
            return;
        }
    }
    logger.error(`An unexpected error occurred during a request (${request.method}) made to ${request.url}`);
    logger.debug(`Error details: ${error}`);
    response.writeHead(500);
    response.end();
};
exports.defaultDispatchErrorHandler = defaultDispatchErrorHandler;
const defaultAsyncDispatchErrorHandler = async (args) => {
    return (0, exports.defaultDispatchErrorHandler)(args);
};
exports.defaultAsyncDispatchErrorHandler = defaultAsyncDispatchErrorHandler;
// The default processEventErrorHandler implementation:
// Developers can customize this behavior by passing processEventErrorHandler to the constructor
const defaultProcessEventErrorHandler = async (args) => {
    const { error, response, logger, storedResponse } = args;
    // Check if the response headers have already been sent
    if (response.headersSent) {
        logger.error('An unhandled error occurred after ack() called in a listener');
        logger.debug(`Error details: ${error}, storedResponse: ${storedResponse}`);
        return false;
    }
    if ('code' in error) {
        if (error.code === errors_1.ErrorCode.AuthorizationError) {
            // authorize function threw an exception, which means there is no valid installation data
            response.writeHead(401);
            response.end();
            return true;
        }
    }
    logger.error('An unhandled error occurred while Bolt processed an event');
    logger.debug(`Error details: ${error}, storedResponse: ${storedResponse}`);
    response.writeHead(500);
    response.end();
    return false;
};
exports.defaultProcessEventErrorHandler = defaultProcessEventErrorHandler;
// The default unhandledRequestHandler implementation:
// Developers can customize this behavior by passing unhandledRequestHandler to the constructor
// Note that this method cannot be an async function to align with the implementation using setTimeout
const defaultUnhandledRequestHandler = (args) => {
    const { logger, response } = args;
    logger.error('An incoming event was not acknowledged within 3 seconds. ' +
        'Ensure that the ack() argument is called in a listener.');
    // Check if the response has already been sent
    if (!response.headersSent) {
        // If not, set the status code and end the response to close the connection
        response.writeHead(404); // Not Found
        response.end();
    }
};
exports.defaultUnhandledRequestHandler = defaultUnhandledRequestHandler;
//# sourceMappingURL=HTTPModuleFunctions.js.map