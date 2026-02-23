"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = void 0;
exports.websocketErrorWithOriginal = websocketErrorWithOriginal;
exports.platformErrorFromEvent = platformErrorFromEvent;
exports.noReplyReceivedError = noReplyReceivedError;
exports.sendWhileDisconnectedError = sendWhileDisconnectedError;
exports.sendWhileNotReadyError = sendWhileNotReadyError;
/**
 * A dictionary of codes for errors produced by this package
 */
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["SendWhileDisconnectedError"] = "slack_socket_mode_send_while_disconnected_error";
    ErrorCode["SendWhileNotReadyError"] = "slack_socket_mode_send_while_not_ready_error";
    ErrorCode["SendMessagePlatformError"] = "slack_socket_mode_send_message_platform_error";
    ErrorCode["WebsocketError"] = "slack_socket_mode_websocket_error";
    ErrorCode["NoReplyReceivedError"] = "slack_socket_mode_no_reply_received_error";
    ErrorCode["InitializationError"] = "slack_socket_mode_initialization_error";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
/**
 * Factory for producing a {@link CodedError} from a generic error
 */
function errorWithCode(error, code) {
    // NOTE: might be able to return something more specific than a CodedError with conditional typing
    const codedError = error;
    codedError.code = code;
    return codedError;
}
/**
 * A factory to create SMWebsocketError objects.
 */
function websocketErrorWithOriginal(original) {
    const error = errorWithCode(new Error(original.message), ErrorCode.WebsocketError);
    error.original = original;
    return error;
}
/**
 * A factory to create SMPlatformError objects.
 */
function platformErrorFromEvent(
// biome-ignore lint/suspicious/noExplicitAny: errors can be anything
event) {
    const error = errorWithCode(new Error(`An API error occurred: ${event.error.msg}`), ErrorCode.SendMessagePlatformError);
    error.data = event;
    return error;
}
// TODO: Is the below factory needed still?
/**
 * A factory to create SMNoReplyReceivedError objects.
 */
function noReplyReceivedError() {
    return errorWithCode(new Error('Message sent but no server acknowledgement was received. This may be caused by the client ' +
        'changing connection state rather than any issue with the specific message. Check before resending.'), ErrorCode.NoReplyReceivedError);
}
/**
 * A factory to create SMSendWhileDisconnectedError objects.
 */
function sendWhileDisconnectedError() {
    return errorWithCode(new Error('Failed to send a WebSocket message as the client is not connected'), ErrorCode.NoReplyReceivedError);
}
/**
 * A factory to create SMSendWhileNotReadyError objects.
 */
function sendWhileNotReadyError() {
    return errorWithCode(new Error('Failed to send a WebSocket message as the client is not ready'), ErrorCode.NoReplyReceivedError);
}
//# sourceMappingURL=errors.js.map