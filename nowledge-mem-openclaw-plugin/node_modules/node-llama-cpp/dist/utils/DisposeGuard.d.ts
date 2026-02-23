export declare class DisposeGuard {
    constructor(parentDisposeGuards?: DisposeGuard[]);
    addParentDisposeGuard(parent: DisposeGuard): void;
    removeParentDisposeGuard(parent: DisposeGuard): void;
    acquireDisposeLock(): Promise<void>;
    createPreventDisposalHandle(ignoreAwaitingDispose?: boolean): DisposalPreventionHandle;
}
export declare class DisposalPreventionHandle {
    private constructor();
    dispose(): void;
    [Symbol.dispose](): void;
    get disposed(): boolean;
}
