import { GbnfTerminal } from "../GbnfTerminal.js";
export declare class GbnfBooleanValue extends GbnfTerminal {
    readonly value: boolean;
    constructor(value: boolean);
    getGrammar(): string;
    resolve(): string;
}
