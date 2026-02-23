/// <reference types="node" resolution-mode="require"/>
export declare class Terminal {
    #private;
    static readonly COLUMNS = 80;
    static readonly EOL = "\n";
    static readonly ROWS = 24;
    constructor(stdout: NodeJS.WriteStream);
    get width(): number;
    get height(): number;
    adapt(value: number): number;
}
