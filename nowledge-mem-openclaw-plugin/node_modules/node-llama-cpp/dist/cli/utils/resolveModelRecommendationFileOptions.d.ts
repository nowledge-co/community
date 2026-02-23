export type ModelURI = (`${`http://${string}/${string}` | `https://${string}/${string}` | `hf:${string}/${string}/${string}` | `huggingface:${string}/${string}/${string}`}${".gguf" | `.gguf.part${number}of${number}`}`) | (`hf:${string}/${string}:${string}` | `huggingface:${string}/${string}:${string}` | `hf.co/${string}/${string}:${string}` | `huggingface.co/${string}/${string}:${string}`);
export type ModelRecommendation = {
    name: string;
    abilities: ("code" | "chat" | "complete" | "infill" | "functionCalling" | "reasoning")[];
    description?: string;
    /**
     * Files ordered by quality.
     * The first file that has 100% compatibility with the current system
     * will be used (and the rest of the files won't even be tested),
     * otherwise, the file with the highest compatibility will be used.
     */
    fileOptions: ModelURI[];
};
export declare function resolveModelRecommendationFileOptions(modelRecommendation: ModelRecommendation): string[];
