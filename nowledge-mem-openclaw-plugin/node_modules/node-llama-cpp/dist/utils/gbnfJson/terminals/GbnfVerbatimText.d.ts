import { GbnfTerminal } from "../GbnfTerminal.js";
export declare class GbnfVerbatimText extends GbnfTerminal {
    readonly value: string;
    constructor(value: string);
    getGrammar(): string;
}
