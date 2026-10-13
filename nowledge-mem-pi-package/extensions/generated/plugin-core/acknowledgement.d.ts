export declare function isThreadAppendAck(data: unknown): boolean;
export declare function isCheckpointedAppendAck(data: unknown): boolean;
export declare function appendAcknowledgedRemoteCount(data: unknown): number | undefined;
export declare function isThreadCreateAck(data: unknown, expectedThreadId: string): boolean;
export declare function createAcknowledgedRemoteCount(data: unknown, expectedThreadId: string): number | undefined;
export declare function isCheckpointConflictResponse(data: unknown): boolean;
