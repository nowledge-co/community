/**
 * All errors produced by this package adhere to this interface
 */
export interface CodedError extends Error {
    code: string;
}
/**
 * A dictionary of codes for errors produced by this package
 */
export declare enum ErrorCode {
    SendWhileDisconnectedError = "slack_socket_mode_send_while_disconnected_error",
    SendWhileNotReadyError = "slack_socket_mode_send_while_not_ready_error",
    SendMessagePlatformError = "slack_socket_mode_send_message_platform_error",
    WebsocketError = "slack_socket_mode_websocket_error",
    NoReplyReceivedError = "slack_socket_mode_no_reply_received_error",
    InitializationError = "slack_socket_mode_initialization_error"
}
export type SMCallError = SMPlatformError | SMWebsocketError | SMNoReplyReceivedError | SMSendWhileDisconnectedError | SMSendWhileNotReadyError;
export interface SMPlatformError extends CodedError {
    code: ErrorCode.SendMessagePlatformError;
    data: any;
}
export interface SMWebsocketError extends CodedError {
    code: ErrorCode.WebsocketError;
    original: Error;
}
export interface SMNoReplyReceivedError extends CodedError {
    code: ErrorCode.NoReplyReceivedError;
}
export interface SMSendWhileDisconnectedError extends CodedError {
    code: ErrorCode.SendWhileDisconnectedError;
}
export interface SMSendWhileNotReadyError extends CodedError {
    code: ErrorCode.SendWhileNotReadyError;
}
/**
 * A factory to create SMWebsocketError objects.
 */
export declare function websocketErrorWithOriginal(original: Error): SMWebsocketError;
/**
 * A factory to create SMPlatformError objects.
 */
export declare function platformErrorFromEvent(event: any & {
    error: {
        msg: string;
    };
}): SMPlatformError;
/**
 * A factory to create SMNoReplyReceivedError objects.
 */
export declare function noReplyReceivedError(): SMNoReplyReceivedError;
/**
 * A factory to create SMSendWhileDisconnectedError objects.
 */
export declare function sendWhileDisconnectedError(): SMSendWhileDisconnectedError;
/**
 * A factory to create SMSendWhileNotReadyError objects.
 */
export declare function sendWhileNotReadyError(): SMSendWhileNotReadyError;
//# sourceMappingURL=errors.d.ts.map