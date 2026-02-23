export interface CodedError extends Error {
    code: string;
}
/**
 * A dictionary of codes for errors produced by this package.
 */
export declare enum ErrorCode {
    InstallerInitializationError = "slack_oauth_installer_initialization_error",
    AuthorizationError = "slack_oauth_installer_authorization_error",
    GenerateInstallUrlError = "slack_oauth_generate_url_error",
    MissingStateError = "slack_oauth_missing_state",
    InvalidStateError = "slack_oauth_invalid_state",
    MissingCodeError = "slack_oauth_missing_code",
    UnknownError = "slack_oauth_unknown_error"
}
export declare class InstallerInitializationError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class GenerateInstallUrlError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class MissingStateError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class InvalidStateError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class MissingCodeError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class UnknownError extends Error implements CodedError {
    code: ErrorCode;
}
export declare class AuthorizationError extends Error implements CodedError {
    code: ErrorCode;
    original: Error | undefined;
    constructor(message: string, original?: Error);
}
//# sourceMappingURL=errors.d.ts.map