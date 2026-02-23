export type LlamaEmbeddingOptions = {
    vector: readonly number[];
};
export type LlamaEmbeddingJSON = {
    type: "embedding";
    vector: readonly number[];
};
export declare class LlamaEmbedding {
    readonly vector: readonly number[];
    constructor(options: LlamaEmbeddingOptions);
    toJSON(): LlamaEmbeddingJSON;
    /**
     * Calculates the cosine similarity between this embedding and another embedding.
     *
     * Note that you should only compare embeddings created by the exact same model file.
     * @returns A value between 0 and 1 representing the similarity between the embedding vectors,
     * where 1 means the embeddings are identical.
     */
    calculateCosineSimilarity(other: LlamaEmbedding | LlamaEmbeddingJSON | readonly number[]): number;
    static fromJSON(json: LlamaEmbeddingJSON): LlamaEmbedding;
}
