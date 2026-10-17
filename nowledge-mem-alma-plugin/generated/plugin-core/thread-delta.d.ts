export type AcknowledgedCursor = {
    count: number;
    remoteCount: number;
    lastExternalId?: string;
    prefixFingerprint: string;
};
export type AcknowledgedDelta<T> = {
    start: number;
    end: number;
    messages: T[];
    next: AcknowledgedCursor;
    reset: boolean;
};
export declare function stableMessageFingerprint(message: unknown): string;
export declare function prefixFingerprint<T>(messages: readonly T[], end: number, messageFingerprint: (message: T) => string): string;
/** The returned cursor is a candidate; only persistence acknowledgement commits it. */
export declare function selectAcknowledgedDelta<T>(messages: readonly T[], cursor: AcknowledgedCursor | undefined, externalId: (message: T) => string, messageFingerprint?: (message: T) => string): AcknowledgedDelta<T>;
