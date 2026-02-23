export type TypingCallbacks = {
    onReplyStart: () => Promise<void>;
    onIdle?: () => void;
    /** Called when the typing controller is cleaned up (e.g., on NO_REPLY). */
    onCleanup?: () => void;
};
export declare function createTypingCallbacks(params: {
    start: () => Promise<void>;
    stop?: () => Promise<void>;
    onStartError: (err: unknown) => void;
    onStopError?: (err: unknown) => void;
}): TypingCallbacks;
