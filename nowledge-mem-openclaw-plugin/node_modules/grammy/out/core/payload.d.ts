/**
 * Determines for a given payload if it may be sent as JSON, or if it has to be
 * uploaded via multipart/form-data. Returns `true` in the latter case and
 * `false` in the former.
 *
 * @param payload The payload to analyze
 */
export declare function requiresFormDataUpload(payload: unknown): boolean;
/**
 * Turns a payload into an options object that can be passed to a `fetch` call
 * by setting the necessary headers and method. May only be called for payloads
 * `P` that let `requiresFormDataUpload(P)` return `false`.
 *
 * @param payload The payload to wrap
 */
export declare function createJsonPayload(payload: Record<string, unknown>): {
    method: string;
    headers: {
        "content-type": string;
        connection: string;
    };
    body: string;
};
/**
 * Turns a payload into an options object that can be passed to a `fetch` call
 * by setting the necessary headers and method. Note that this method creates a
 * multipart/form-data stream under the hood. If possible, a JSON payload should
 * be created instead for performance reasons.
 *
 * @param payload The payload to wrap
 */
export declare function createFormDataPayload(payload: Record<string, unknown>, onError: (err: unknown) => void): {
    method: string;
    headers: {
        "content-type": string;
        connection: string;
    };
    body: import("stream").Readable;
};
