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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPResponseAck = void 0;
const errors_1 = require("../errors");
const httpFunc = __importStar(require("./HTTPModuleFunctions"));
class HTTPResponseAck {
    logger;
    isAcknowledged;
    processBeforeResponse;
    unhandledRequestHandler;
    unhandledRequestTimeoutMillis;
    unhandledFunctionRequestTimeoutMillis;
    httpRequest;
    httpRequestBody;
    httpResponse;
    noAckTimeoutId;
    // biome-ignore lint/suspicious/noExplicitAny: response bodies can be anything
    storedResponse;
    constructor(args) {
        this.logger = args.logger;
        this.isAcknowledged = false;
        this.processBeforeResponse = args.processBeforeResponse;
        this.unhandledRequestHandler = args.unhandledRequestHandler ?? httpFunc.defaultUnhandledRequestHandler;
        this.unhandledFunctionRequestTimeoutMillis = 5001;
        this.unhandledRequestTimeoutMillis = args.unhandledRequestTimeoutMillis ?? 3001;
        this.httpRequest = args.httpRequest;
        this.httpRequestBody = args.httpRequestBody ?? {};
        this.httpResponse = args.httpResponse;
        this.storedResponse = undefined;
        this.noAckTimeoutId = undefined;
        this.init();
    }
    init() {
        /**
         * TODO: (semver:major) refactoring needed
         *
         * 1. For function_executed events, the acknowledgment timeout can vary from 3 to 15 seconds
         *    depending on the function context. Currently we only allow users to set a fixed
         *    timeout for all function_executed events, but this may not satisfy all use cases.
         *
         * 2. Refactor Bolt App and Receivers to implement proper Request and Response abstractions:
         *    - Receivers should translate their specific request types to standardized Bolt Requests/Responses
         *    - All acknowledgment behaviors and default routing should be handled by the App, not the receivers
         *    - Prevent multiple request body parsing happening both here and again in the App
         *
         * Goal: Define clear separation between protocol-specific and application-level concerns
         */
        const requestTimeout = this.determineRequestTimeout();
        this.noAckTimeoutId = setTimeout(() => {
            if (!this.isAcknowledged) {
                this.unhandledRequestHandler({
                    logger: this.logger,
                    request: this.httpRequest,
                    response: this.httpResponse,
                });
            }
        }, requestTimeout);
        return this;
    }
    determineRequestTimeout() {
        if (this.httpRequestBody?.event?.type === 'function_executed') {
            return this.unhandledFunctionRequestTimeoutMillis;
        }
        return this.unhandledRequestTimeoutMillis;
    }
    bind() {
        return async (responseBody) => {
            this.logger.debug(`ack() call begins (body: ${responseBody})`);
            if (this.isAcknowledged) {
                throw new errors_1.ReceiverMultipleAckError();
            }
            this.ack();
            if (this.processBeforeResponse) {
                // In the case where processBeforeResponse: true is enabled,
                // we don't send the HTTP response immediately. We hold off until the listener execution is completed.
                if (!responseBody) {
                    this.storedResponse = '';
                }
                else {
                    this.storedResponse = responseBody;
                }
                this.logger.debug(`ack() response stored (body: ${responseBody})`);
            }
            else {
                httpFunc.buildContentResponse(this.httpResponse, responseBody);
                this.logger.debug(`ack() response sent (body: ${responseBody})`);
            }
        };
    }
    ack() {
        this.isAcknowledged = true;
        if (this.noAckTimeoutId) {
            clearTimeout(this.noAckTimeoutId);
        }
    }
}
exports.HTTPResponseAck = HTTPResponseAck;
//# sourceMappingURL=HTTPResponseAck.js.map