import { GbnfTerminal } from "../GbnfTerminal.js";
export declare class GbnfNumber extends GbnfTerminal {
    readonly allowFractional: boolean;
    constructor({ allowFractional }: {
        allowFractional: boolean;
    });
    getGrammar(): string;
    protected getRuleName(): string;
}
