import { Llama } from "../../bindings/Llama.js";
export declare function resolveCommandGgufPath(ggufPath: string | undefined, llama: Llama, fetchHeaders?: Record<string, string>, { targetDirectory, flashAttention, swaFullCache, useMmap, consoleTitle }?: {
    targetDirectory?: string;
    flashAttention?: boolean;
    swaFullCache?: boolean;
    useMmap?: boolean;
    consoleTitle?: string;
}): Promise<string>;
export declare function tryCoercingModelUri(ggufPath: string): {
    uri: string;
    modifiedRegion: {
        start: number;
        end: number;
    };
} | undefined;
export declare function printDidYouMeanUri(ggufPath: string): void;
