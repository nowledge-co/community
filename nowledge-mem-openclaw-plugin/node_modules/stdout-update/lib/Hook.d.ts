/// <reference types="node" resolution-mode="require"/>
export declare class Hook {
    #private;
    static readonly DRAIN = true;
    constructor(stream: NodeJS.WriteStream);
    active(): void;
    erase(count: number): void;
    inactive(separateHistory?: boolean): void;
    renew(): void;
    write(msg: string): void;
}
