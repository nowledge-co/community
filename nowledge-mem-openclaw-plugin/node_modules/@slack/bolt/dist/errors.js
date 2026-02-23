"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomFunctionCompleteFailError = exports.CustomFunctionCompleteSuccessError = exports.CustomFunctionInitializationError = exports.WorkflowStepInitializationError = exports.MultipleListenerError = exports.HTTPReceiverDeferredRequestError = exports.ReceiverInconsistentStateError = exports.ReceiverAuthenticityError = exports.ReceiverMultipleAckError = exports.CustomRouteInitializationError = exports.InvalidCustomPropertyError = exports.ContextMissingPropertyError = exports.AuthorizationError = exports.AssistantMissingPropertyError = exports.AssistantInitializationError = exports.AppInitializationError = exports.asCodedError = exports.UnknownError = exports.ErrorCode = exports.isCodedError = void 0;
// biome-ignore lint/suspicious/noExplicitAny: errors can be anything
function isCodedError(err) {
    return 'code' in err;
}
exports.isCodedError = isCodedError;
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["AppInitializationError"] = "slack_bolt_app_initialization_error";
    ErrorCode["AssistantInitializationError"] = "slack_bolt_assistant_initialization_error";
    ErrorCode["AssistantMissingPropertyError"] = "slack_bolt_assistant_missing_property_error";
    ErrorCode["AuthorizationError"] = "slack_bolt_authorization_error";
    ErrorCode["ContextMissingPropertyError"] = "slack_bolt_context_missing_property_error";
    ErrorCode["InvalidCustomPropertyError"] = "slack_bolt_context_invalid_custom_property_error";
    ErrorCode["CustomRouteInitializationError"] = "slack_bolt_custom_route_initialization_error";
    ErrorCode["ReceiverMultipleAckError"] = "slack_bolt_receiver_ack_multiple_error";
    ErrorCode["ReceiverAuthenticityError"] = "slack_bolt_receiver_authenticity_error";
    ErrorCode["ReceiverInconsistentStateError"] = "slack_bolt_receiver_inconsistent_state_error";
    ErrorCode["MultipleListenerError"] = "slack_bolt_multiple_listener_error";
    ErrorCode["HTTPReceiverDeferredRequestError"] = "slack_bolt_http_receiver_deferred_request_error";
    /**
     * This value is used to assign to errors that occur inside the framework but do not have a code, to keep interfaces
     * in terms of CodedError.
     */
    ErrorCode["UnknownError"] = "slack_bolt_unknown_error";
    // TODO: remove workflow step stuff in bolt v5
    ErrorCode["WorkflowStepInitializationError"] = "slack_bolt_workflow_step_initialization_error";
    ErrorCode["CustomFunctionInitializationError"] = "slack_bolt_custom_function_initialization_error";
    ErrorCode["CustomFunctionCompleteSuccessError"] = "slack_bolt_custom_function_complete_success_error";
    ErrorCode["CustomFunctionCompleteFailError"] = "slack_bolt_custom_function_complete_fail_error";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
class UnknownError extends Error {
    code = ErrorCode.UnknownError;
    original;
    constructor(original) {
        super(original.message);
        this.original = original;
    }
}
exports.UnknownError = UnknownError;
function asCodedError(error) {
    if (error.code !== undefined) {
        return error;
    }
    return new UnknownError(error);
}
exports.asCodedError = asCodedError;
class AppInitializationError extends Error {
    code = ErrorCode.AppInitializationError;
}
exports.AppInitializationError = AppInitializationError;
class AssistantInitializationError extends Error {
    code = ErrorCode.AssistantInitializationError;
}
exports.AssistantInitializationError = AssistantInitializationError;
class AssistantMissingPropertyError extends Error {
    code = ErrorCode.AssistantMissingPropertyError;
}
exports.AssistantMissingPropertyError = AssistantMissingPropertyError;
class AuthorizationError extends Error {
    code = ErrorCode.AuthorizationError;
    original;
    constructor(message, original) {
        super(message);
        this.original = original;
    }
}
exports.AuthorizationError = AuthorizationError;
class ContextMissingPropertyError extends Error {
    code = ErrorCode.ContextMissingPropertyError;
    missingProperty;
    constructor(missingProperty, message) {
        super(message);
        this.missingProperty = missingProperty;
    }
}
exports.ContextMissingPropertyError = ContextMissingPropertyError;
class InvalidCustomPropertyError extends Error {
    code = ErrorCode.AppInitializationError;
}
exports.InvalidCustomPropertyError = InvalidCustomPropertyError;
class CustomRouteInitializationError extends Error {
    code = ErrorCode.CustomRouteInitializationError;
}
exports.CustomRouteInitializationError = CustomRouteInitializationError;
class ReceiverMultipleAckError extends Error {
    code = ErrorCode.ReceiverMultipleAckError;
    constructor() {
        super("The receiver's `ack` function was called multiple times.");
    }
}
exports.ReceiverMultipleAckError = ReceiverMultipleAckError;
class ReceiverAuthenticityError extends Error {
    code = ErrorCode.ReceiverAuthenticityError;
}
exports.ReceiverAuthenticityError = ReceiverAuthenticityError;
class ReceiverInconsistentStateError extends Error {
    code = ErrorCode.ReceiverInconsistentStateError;
}
exports.ReceiverInconsistentStateError = ReceiverInconsistentStateError;
class HTTPReceiverDeferredRequestError extends Error {
    code = ErrorCode.HTTPReceiverDeferredRequestError;
    req;
    res;
    constructor(message, req, res) {
        super(message);
        this.req = req;
        this.res = res;
    }
}
exports.HTTPReceiverDeferredRequestError = HTTPReceiverDeferredRequestError;
class MultipleListenerError extends Error {
    code = ErrorCode.MultipleListenerError;
    originals;
    constructor(originals) {
        super('Multiple errors occurred while handling several listeners. The `originals` property contains an array of each error.');
        this.originals = originals;
    }
}
exports.MultipleListenerError = MultipleListenerError;
/**
 * @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
 * version.
 */
class WorkflowStepInitializationError extends Error {
    code = ErrorCode.WorkflowStepInitializationError;
}
exports.WorkflowStepInitializationError = WorkflowStepInitializationError;
class CustomFunctionInitializationError extends Error {
    code = ErrorCode.CustomFunctionInitializationError;
}
exports.CustomFunctionInitializationError = CustomFunctionInitializationError;
class CustomFunctionCompleteSuccessError extends Error {
    code = ErrorCode.CustomFunctionCompleteSuccessError;
}
exports.CustomFunctionCompleteSuccessError = CustomFunctionCompleteSuccessError;
class CustomFunctionCompleteFailError extends Error {
    code = ErrorCode.CustomFunctionCompleteFailError;
}
exports.CustomFunctionCompleteFailError = CustomFunctionCompleteFailError;
//# sourceMappingURL=errors.js.map