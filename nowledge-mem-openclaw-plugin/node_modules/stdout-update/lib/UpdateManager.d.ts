/// <reference types="node" resolution-mode="require"/>
export declare class UpdateManager {
    #private;
    private static instance?;
    private constructor();
    static getInstance(stdout?: NodeJS.WriteStream, stderr?: NodeJS.WriteStream): UpdateManager;
    get lastLength(): number;
    get outside(): number;
    get isHooked(): boolean;
    get isSuspended(): boolean;
    erase(count?: number): void;
    hook(): boolean;
    resume(eraseRowCount?: number): void;
    suspend(erase?: boolean): void;
    unhook(separateHistory?: boolean): boolean;
    update(rows: string[], from?: number): void;
    private clear;
}
export default UpdateManager;
