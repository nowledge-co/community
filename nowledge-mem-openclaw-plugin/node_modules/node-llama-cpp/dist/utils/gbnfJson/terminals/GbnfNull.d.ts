import { GbnfTerminal } from "../GbnfTerminal.js";
export declare class GbnfNull extends GbnfTerminal {
    getGrammar(): string;
    protected getRuleName(): string;
}
