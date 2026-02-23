import { EventRelay } from "lifecycle-utils";
export declare class MemoryOrchestrator {
    readonly onMemoryReservationRelease: EventRelay<void>;
    constructor(getMemoryState: () => {
        free: number;
        total: number;
        unifiedSize: number;
    });
    reserveMemory(bytes: number): MemoryReservation;
    getMemoryState(): Promise<{
        free: number;
        total: number;
        unifiedSize: number;
    }>;
}
export declare class MemoryReservation {
    private constructor();
    get size(): number;
    get disposed(): boolean;
    [Symbol.dispose](): void;
    dispose(): void;
    static _create(bytes: number, dispose: () => void): MemoryReservation;
}
