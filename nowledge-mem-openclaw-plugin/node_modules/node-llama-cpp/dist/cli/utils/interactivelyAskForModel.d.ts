import { Llama } from "../../bindings/Llama.js";
export declare function interactivelyAskForModel({ llama, modelsDirectory, allowLocalModels, downloadIntent, flashAttention, swaFullCache, useMmap }: {
    llama: Llama;
    modelsDirectory?: string;
    allowLocalModels?: boolean;
    downloadIntent?: boolean;
    flashAttention?: boolean;
    swaFullCache?: boolean;
    useMmap?: boolean;
}): Promise<string>;
