/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { BufferedIncomingMessage } from './receivers/BufferedIncomingMessage';
export interface CodedError extends Error {
    code: string;
    original?: Error;
    originals?: Error[];
    missingProperty?: string;
    req?: IncomingMessage | BufferedIncomingMessage;
    res?: ServerResponse;
}
export declare function isCodedError(err: any): err is CodedError;
export declare enum ErrorCode {
    AppInitializationError = "slack_bolt_app_initialization_error",
    AssistantInitializationError = "slack_bolt_assistant_initialization_error",
    AssistantMissingPropertyError = "slack_bolt_assistant_missing_property_error",
    AuthorizationError = "slack_bolt_authorization_error",
    ContextMissingPropertyError = "slack_bolt_context_missing_property_error",
    InvalidCustomPropertyError = "slack_bolt_context_invalid_custom_property_error",
    CustomRouteInitializationError = "slack_bolt_custom_route_initialization_error",
    ReceiverMultipleAckError = "slack_bolt_receiver_ack_multiple_error",
    ReceiverAuthenticityError = "slack_bolt_receiver_authenticity_error",
    ReceiverInconsistentStateError = "slack_bolt_receiver_inconsistent_state_error",
    MultipleListenerError = "slack_bolt_multiple_listener_error",
    HTTPReceiverDeferredRequestError = "slack_bolt_http_receiver_deferred_request_error",
    /**
     * This value is used to assign to errors that occur inside the framework but do not have a code, to keep interfaces
     * in terms of CodedError.
     */
    UnknownError = "slack_bolt_unknown_error",
    WorkflowStepInitializationError = "slack_bolt_workflow_step_initialization_error",
    CustomFunctionInitializationError = "slack_bolt_custom_function_initialization_error",
    CustomFunctionCompleteSuccessError = "slack_bolt_custom_function_complete_success_error",
    CustomFunctionCompleteFailError = "slack_bolt_custom_function_complete_fail_error"
}
export declare class UnknownError extends Error implements CodedError {
    code: ErrorCode;
    original: Error;
    constructor(original: Error);
}
export declare function asCodedError(error: CodedError | Error): CodedError;
export declare class AppInitializationError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class AssistantInitializationError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class AssistantMissingPropertyError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class AuthorizationError extends Error implements CodedError {
    code: ErrorCode;
    original: Error;
    constructor(message: string, original: Error);
}
export declare class ContextMissingPropertyError extends Error implements CodedError {
    code: ErrorCode;
    missingProperty: string;
    constructor(missingProperty: string, message: string);
}
export declare class InvalidCustomPropertyError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class CustomRouteInitializationError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class ReceiverMultipleAckError extends Error implements CodedError {
    code: ErrorCode;
    constructor();
}
export declare class ReceiverAuthenticityError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class ReceiverInconsistentStateError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class HTTPReceiverDeferredRequestError extends Error implements CodedError {
    code: ErrorCode;
    req: IncomingMessage | BufferedIncomingMessage;
    res: ServerResponse;
    constructor(message: string, req: IncomingMessage | BufferedIncomingMessage, res: ServerResponse);
}
export declare class MultipleListenerError extends Error implements CodedError {
    code: ErrorCode;
    originals: Error[];
    constructor(originals: Error[]);
}
/**
 * @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
export declare class WorkflowStepInitializationError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class CustomFunctionInitializationError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class CustomFunctionCompleteSuccessError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class CustomFunctionCompleteFailError extends Error implements CodedError {
    code: ErrorCode;
}
//# sourceMappingURL=errors.d.ts.map